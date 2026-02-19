// ============================================================
//  SWARNIM JEWELS  USER SYSTEM  v3.0
//
//  Load order  place BEFORE </body>, NO defer/async:
//    <script src="shopping-cart.js"></script>
//    <script src="user-system.js"></script>
// ============================================================

const UserSystem = (function () {

  // -- CONFIG --------------------------------------------------
  const API_URL = 'https://script.google.com/macros/s/AKfycbz2sIsHwOqQPTwTLlsHZgm9D6k9fhH_dZeNxzGYrKfZvTSVfw8Mb0cZg0j8Guefh7MC/exec';
  const K = { USER: 'sj_user', TOKEN: 'sj_token', CART: 'swarnimCart', WISH: 'sj_wishlist' };

  // -- STORAGE -------------------------------------------------
  function lsGet(k)    { try { const v = localStorage.getItem(k);   return v ? JSON.parse(v) : null; } catch { return null; } }
  function ssGet(k)    { try { const v = sessionStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  function ssSet(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch {} }
  function del(k)      { try { localStorage.removeItem(k); sessionStorage.removeItem(k); } catch {} }

  // Which store holds the current session?
  function store() {
    if (lsGet(K.TOKEN) && lsGet(K.USER))   return 'ls';
    if (ssGet(K.TOKEN) && ssGet(K.USER))   return 'ss';
    return null;
  }

  // -- SHA-256 --------------------------------------------------
  async function sha256(msg) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(msg));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // -- API ------------------------------------------------------
  async function api(action, data = {}) {
    try {
      const res = await fetch(API_URL, {
        method:  'POST',
        redirect: 'follow',                       // required for Apps Script
        headers: { 'Content-Type': 'text/plain' },
        body:    JSON.stringify({ action, ...data })
      });
      if (!res.ok) return { success: false, error: 'Server error ' + res.status };
      return await res.json();
    } catch (e) {
      return { success: false, error: 'Network error. Check your connection.' };
    }
  }

  // -- TOKEN ----------------------------------------------------
  function makeToken(userId) {
    return userId + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 12);
  }

  // -- SAFE REDIRECT --------------------------------------------
  // Prevents open-redirect attacks via ?redirect= parameter
  function safeRedirect(fallback) {
    const raw = new URLSearchParams(window.location.search).get('redirect') || '';
    return (raw && !raw.startsWith('http') && !raw.startsWith('//')) ? raw : fallback;
  }

  // ==============================================================
  //  AUTH
  // ==============================================================

  async function register({ name, email, phone, password }) {
    name = (name || '').trim();
    email = (email || '').trim().toLowerCase();
    phone = (phone || '').trim();

    if (!name)  return { success: false, error: 'Full name is required.' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return { success: false, error: 'Enter a valid email address.' };
    if (!password || password.length < 6)
      return { success: false, error: 'Password must be at least 6 characters.' };

    const result = await api('registerUser', {
      name, email, phone, passwordHash: await sha256(password)
    });

    if (result.success) {
      const user = { userId: result.userId, name, email, phone };
      lsSet(K.TOKEN, makeToken(result.userId));
      lsSet(K.USER,  user);
      updateHeader();
    }
    return result;
  }

  async function login({ email, password, rememberMe = true }) {
    email = (email || '').trim().toLowerCase();
    if (!email || !password)
      return { success: false, error: 'Email and password are required.' };

    const result = await api('loginUser', {
      email, passwordHash: await sha256(password)
    });

    if (result.success) {
      const token = makeToken(result.user.userId);
      if (rememberMe) {
        lsSet(K.TOKEN, token);
        lsSet(K.USER,  result.user);
      } else {
        ssSet(K.TOKEN, token);
        ssSet(K.USER,  result.user);
      }
      try { await syncCart(result.user.userId); } catch (e) { /* non-fatal */ }
      updateHeader();
    }
    return result;
  }

  async function logout() {
    const user = getUser();
    if (user) {
      try {
        await api('saveCart', { userId: user.userId, cart: lsGet(K.CART) || [] });
      } catch (e) { /* non-fatal */ }
    }
    del(K.TOKEN);
    del(K.USER);
    updateHeader();
    window.location.href = 'index.html';
  }

  // -- GETTERS --------------------------------------------------
  function getUser()    { return lsGet(K.USER) || ssGet(K.USER) || null; }
  function getToken()   { return lsGet(K.TOKEN) || ssGet(K.TOKEN) || null; }
  function isLoggedIn() { return !!(getToken() && getUser()); }

  // -- PROFILE --------------------------------------------------
  async function updateProfile({ name, phone }) {
    const user = getUser();
    if (!user) return { success: false, error: 'Not logged in.' };
    name  = (name  || '').trim();
    phone = (phone || '').trim();
    if (!name) return { success: false, error: 'Name is required.' };

    const result = await api('updateUser', { userId: user.userId, name, phone });
    if (result.success) {
      const updated = { ...user, name, phone };
      store() === 'ss' ? ssSet(K.USER, updated) : lsSet(K.USER, updated);
      updateHeader();
    }
    return result;
  }

  async function changePassword({ currentPassword, newPassword }) {
    const user = getUser();
    if (!user) return { success: false, error: 'Not logged in.' };
    if (!currentPassword) return { success: false, error: 'Current password is required.' };
    if (!newPassword || newPassword.length < 6)
      return { success: false, error: 'New password must be at least 6 characters.' };
    if (currentPassword === newPassword)
      return { success: false, error: 'New password must be different.' };

    const [currentHash, newHash] = await Promise.all([sha256(currentPassword), sha256(newPassword)]);
    return api('changePassword', { userId: user.userId, currentHash, newHash });
  }

  // -- CART SYNC ------------------------------------------------
  async function syncCart(userId) {
    const local      = lsGet(K.CART) || [];
    const res        = await api('getCart', { userId });
    const server     = (res.success && Array.isArray(res.cart)) ? res.cart : [];
    const merged     = [...server];

    for (const item of local) {
      const idx = merged.findIndex(i => String(i.id) === String(item.id));
      if (idx > -1) merged[idx].quantity = (merged[idx].quantity || 1) + (item.quantity || 1);
      else merged.push(item);
    }

    lsSet(K.CART, merged);
    await api('saveCart', { userId, cart: merged });
    if (window.ShoppingCart?.updateCartCount) ShoppingCart.updateCartCount();
    return merged;
  }

  async function pushCart() {
    const user = getUser();
    if (!user) return;
    try { await api('saveCart', { userId: user.userId, cart: lsGet(K.CART) || [] }); } catch {}
  }

  // -- ORDERS ---------------------------------------------------
  async function saveOrder(order) {
    const user = getUser();
    return api('saveOrder', { userId: user ? user.userId : 'GUEST', order });
  }

  async function getOrders() {
    const user = getUser();
    if (!user) return { success: false, orders: [] };
    return api('getOrders', { userId: user.userId });
  }

  // -- ADDRESSES ------------------------------------------------
  async function saveAddress(address) {
    const user = getUser();
    if (!user) return { success: false, error: 'Not logged in.' };
    return api('saveAddress', { userId: user.userId, address });
  }

  async function replaceAddresses(addresses) {
    const user = getUser();
    if (!user) return { success: false, error: 'Not logged in.' };
    return api('replaceAddresses', { userId: user.userId, addresses });
  }

  async function getAddresses() {
    const user = getUser();
    if (!user) return { success: false, addresses: [] };
    return api('getAddresses', { userId: user.userId });
  }

  // -- WISHLIST -------------------------------------------------
  function getWishlist()     { return lsGet(K.WISH) || []; }
  function isWishlisted(id)  { return getWishlist().some(i => String(i.id) === String(id)); }
  function toggleWishlist(product) {
    const list = getWishlist();
    const idx  = list.findIndex(i => String(i.id) === String(product.id));
    if (idx > -1) list.splice(idx, 1);
    else          list.push(product);
    lsSet(K.WISH, list);
    return list;
  }

  // -- HEADER ---------------------------------------------------
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  
  function updateHeader() {
    const btn  = document.getElementById('accountNavBtn');
    const user = getUser();
    if (!btn) return;
    if (user) {
      const firstName = esc((user.name || 'Account').split(' ')[0]);
      btn.innerHTML = `<i class="fa-solid fa-user-check"></i> Hi, ${firstName}`;
      btn.href  = 'account.html';
      btn.title = 'My Account';
    } else {
      btn.innerHTML = `<i class="fa-solid fa-user"></i> Account`;
      btn.href  = 'login.html';
      btn.title = 'Login / Register';
    }
  }

  // -- INIT -----------------------------------------------------
  (function init() {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', updateHeader);
    else updateHeader();
    setInterval(() => { if (isLoggedIn()) pushCart(); }, 5 * 60 * 1000);
  })();

  return {
    register, login, logout,
    getUser, isLoggedIn, getToken,
    updateProfile, changePassword,
    syncCart, pushCart,
    saveOrder, getOrders,
    saveAddress, replaceAddresses, getAddresses,
    getWishlist, toggleWishlist, isWishlisted,
    updateHeader, safeRedirect
  };

})();

window.UserSystem = UserSystem;
