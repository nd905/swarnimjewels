// ============================================================
//  SWARNIM JEWELS  USER SYSTEM  v3.0
//
//  Load order  place BEFORE </body>, NO defer/async:
//    <script src="shopping-cart.js"></script>
//    <script src="user-system.js"></script>
// ============================================================

const UserSystem = (function () {

  // -- CONFIG --------------------------------------------------
  const API_URL = 'https://script.google.com/macros/s/AKfycbwGDUDUHI8QgcyqG5idSiRWfOztJ1bktvaNEfxdEiBV09NuP6HunG_-9r5gbVo6UHY3/exec';
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
      // Automatically inject userId + token for authenticated calls
      const user  = getUser();
      const token = getToken();
      const auth  = (user && token) ? { userId: user.userId, token } : {};
      const res = await fetch(API_URL, {
        method:  'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain' },
        body:    JSON.stringify({ action, ...auth, ...data })
      });
      if (!res.ok) return { success: false, error: 'Server error ' + res.status };
      return await res.json();
    } catch (e) {
      return { success: false, error: 'Network error. Check your connection.' };
    }
  }

  // -- TOKEN ----------------------------------------------------
  // makeToken removed — session token is now issued by the server on login

  // -- SAFE REDIRECT --------------------------------------------
  // Prevents open-redirect attacks via ?redirect= parameter
  function safeRedirect(fallback) {
    const raw = (new URLSearchParams(window.location.search).get('redirect') || '').trim();
    // Block absolute URLs, protocol-relative, javascript:, data: and anything with a colon before first slash
    const unsafe = !raw || /^(https?:|\/\/|javascript:|data:|[a-z][a-z0-9+\-.]*:)/i.test(raw);
    return unsafe ? fallback : raw;
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
      name, email, phone, passwordHash: await sha256(email.toLowerCase() + ':' + password) // email-salted hash
    });

    if (result.success) {
      // After registration, auto-login to get a proper server-side token
      const loginResult = await login({ email, password, rememberMe: true });
      if (!loginResult.success) {
        // Edge case: registered OK but auto-login failed — redirect to login page
        return { success: true, needsLogin: true };
      }
    }
    return result;
  }

  async function login({ email, password, rememberMe = false }) { // A5: default false — explicit true required for persistence
    email = (email || '').trim().toLowerCase();
    if (!email || !password)
      return { success: false, error: 'Email and password are required.' };

    const result = await api('loginUser', {
      email, passwordHash: await sha256(email.toLowerCase() + ':' + password) // email-salted hash
    });

    if (result.success) {
      const token = result.token; // Server-issued session token
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
        // A7: save cart FIRST (awaited), THEN invalidate token — prevents cart leak on shared device
        await api('saveCart', { cart: lsGet(K.CART) || [] });
      } catch (e) { /* non-fatal */ }
      try { await api('logoutUser'); } catch (e) { /* non-fatal */ }
    }
    del(K.TOKEN);
    del(K.USER);
    del(K.WISH); // A6: clear wishlist on logout
    del(K.CART); // Bug 192: use del() to clear CART from both localStorage AND sessionStorage
    if (window.ShoppingCart?.updateCartCount) ShoppingCart.updateCartCount();
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

    const userEmail = (user.email || '').toLowerCase();
    const [currentHash, newHash] = await Promise.all([sha256(userEmail + ':' + currentPassword), sha256(userEmail + ':' + newPassword)]);
    const result = await api('changePassword', { userId: user.userId, currentHash, newHash });
    // Bug 178: server rotates session token on password change — update local storage
    if (result.success && result.newToken) {
      const userData = getUser();
      if (userData) {
        const s = store();
        const saveLocal = s === 'ls' ? (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
                                     : (k, v) => { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch {} };
        saveLocal(K.TOKEN, result.newToken);
      }
    }
    return result;
  }

  // -- CART SYNC ------------------------------------------------
  async function syncCart(userId) {
    const local      = lsGet(K.CART) || [];
    const res        = await api('getCart');
    const server     = (res.success && Array.isArray(res.cart)) ? res.cart : [];
    const merged     = [...server];

    for (const item of local) {
      const idx = merged.findIndex(i => String(i.id) === String(item.id));
      if (idx > -1) {
        // Take the MAX quantity rather than adding — prevents doubling on re-login
        merged[idx].quantity = Math.max(merged[idx].quantity || 1, item.quantity || 1);
      } else {
        merged.push(item);
      }
    }

    lsSet(K.CART, merged);
    await api('saveCart', { cart: merged });
    if (window.ShoppingCart?.updateCartCount) ShoppingCart.updateCartCount();
    return merged;
  }

  async function pushCart() {
    const user = getUser();
    if (!user) return;
    try { await api('saveCart', { cart: lsGet(K.CART) || [] }); } catch {}
  }

  // -- ORDERS ---------------------------------------------------
  async function saveOrder(order) {
    // userId auto-injected by api() for logged-in users; GUEST for anonymous
    const guestId = getUser() ? undefined : 'GUEST';
    return api('saveOrder', { ...(guestId ? { userId: guestId } : {}), order });
  }

  async function getOrders() {
    if (!isLoggedIn()) return { success: false, orders: [] };
    return api('getOrders');
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

  // -- WALLET -------------------------------------------------
  async function getWelcomeCoupon() {
    const user = getUser();
    if (!user) return { success:false, welcome:null };
    return api('getWelcomeCoupon');
  }

  return {
    _API_URL: API_URL,         // exposed so pages can reuse the URL without duplication
    register, login, logout, logoutUser: logout,
    getUser, isLoggedIn, getToken,
    updateProfile, changePassword,
    syncCart, pushCart,
    saveOrder, getOrders,
    saveAddress, replaceAddresses, getAddresses,
    getWishlist, toggleWishlist, isWishlisted,
    getWelcomeCoupon,
    updateHeader, safeRedirect
  };

})();

window.UserSystem = UserSystem;
