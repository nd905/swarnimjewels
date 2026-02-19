// ============================================================
//  SWARNIM JEWELS  GOOGLE APPS SCRIPT  v3.0
//
//  REQUIRED SHEET TABS:
//    Products   A:ID  B:Name  C:Description  D:Price
//                E:CoverImage  F:GalleryImages  G:Category  H:VideoURLs
//    Categories  A:Name
//    Banners    A:ID  B:ImageUrl  C:Active  D:SortOrder  E:Title
//    Coupons    A:Code  B:DiscountPercent  C:Active(TRUE/FALSE)  D:ExpiryDate(YYYY-MM-DD)  E:MinimumAmount
//    Users      A:UserID  B:Name  C:Email  D:PasswordHash
//                E:Phone  F:CreatedAt  G:Cart(JSON)  H:Addresses(JSON)
//    Orders     A:OrderID  B:UserID  C:Date  D:Items  E:Total
//                F:Name  G:Phone  H:Address  I:Status
//
//  Deploy  New Deployment  Web App
//  Execute as: Me  |  Access: Anyone
// ============================================================

function out(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

//  doGet  products, categories, banners, coupons 
function doGet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  // Products  look up by name first, fallback to first sheet
  var ps = ss.getSheetByName('Products') || ss.getSheets()[0];
  var products = [];
  try {
    if (ps.getLastRow() > 1) {
      ps.getRange(2, 1, ps.getLastRow() - 1, 8).getValues().forEach(function(r) {
        if (!r[0]) return;
        products.push({ id:r[0], name:r[1], description:r[2], price:r[3],
          coverImage:r[4], galleryImages:r[5], category:r[6], videoURLs:r[7]||'' });
      });
    }
  } catch(e) {}

  var categories = [];
  try {
    var cs = ss.getSheetByName('Categories');
    if (cs && cs.getLastRow() > 0)
      cs.getRange(1,1,cs.getLastRow(),1).getValues().forEach(function(r){ if(r[0]) categories.push(r[0].toString().trim()); });
  } catch(e) {}

  var banners = [];
  try {
    var bs = ss.getSheetByName('Banners');
    if (bs && bs.getLastRow() > 0)
      bs.getRange(1,1,bs.getLastRow(),5).getValues().forEach(function(r){
        if(r[0]) banners.push({ id:r[0], imageUrl:r[1], active:(r[2]===true||r[2]==='TRUE'), sortOrder:r[3], title:r[4]||'' });
      });
  } catch(e) {}

  var coupons = [];
  try {
    var coup = ss.getSheetByName('Coupons');
    if (coup && coup.getLastRow() > 0)
      coup.getDataRange().getValues().forEach(function(r){
        if(r[0] && (r[2]===true||r[2]==='TRUE')) {
          var expVal = r[3];
          var expiryStr = '';
          if (expVal instanceof Date && !isNaN(expVal)) {
            var yy = expVal.getFullYear();
            var mm = ('0'+(expVal.getMonth()+1)).slice(-2);
            var dd = ('0'+expVal.getDate()).slice(-2);
            expiryStr = yy + '-' + mm + '-' + dd;
          } else if (expVal) {
            expiryStr = expVal.toString().trim();
          }
          coupons.push({ code:r[0].toString().toUpperCase().trim(), discount:Number(r[1]), expiryDate:expiryStr, minimumAmount:Number(r[4])||0 });
        }
      });
  } catch(e) {}

  return out({ products:products, categories:categories, banners:banners, coupons:coupons });
}

//  doPost  routes all write actions 
function doPost(e) {
  var data;
  try { data = JSON.parse(e.postData.contents); }
  catch(err) { return out({ success:false, error:'Invalid request body.' }); }

  var action = (data.action || '').toString().trim();

  if (action === 'addProduct')       return addProduct(data);
  if (action === 'updateProduct')    return updateProduct(data);
  if (action === 'deleteProduct')    return deleteProduct(data);
  if (action === 'addCategory')      return addCategory(data);
  if (action === 'deleteCategory')   return deleteCategory(data);
  if (action === 'addBanner')        return addBanner(data);
  if (action === 'deleteBanner')     return deleteBanner(data);
  if (action === 'validateCoupon')   return validateCoupon(data);
  if (action === 'registerUser')     return registerUser(data);
  if (action === 'loginUser')        return loginUser(data);
  if (action === 'updateUser')       return updateUser(data);
  if (action === 'changePassword')   return changePassword(data);
  if (action === 'getCart')          return getCart(data);
  if (action === 'saveCart')         return saveCart(data);
  if (action === 'saveOrder')        return saveOrder(data);
  if (action === 'getOrders')        return getOrders(data);
  if (action === 'saveAddress')      return saveAddressAction(data);
  if (action === 'replaceAddresses') return replaceAddressesAction(data);
  if (action === 'getAddresses')     return getAddresses(data);

  return out({ success:false, error:'Unknown action: ' + action });
}

// 
//  PRODUCTS
// 
function _pSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName('Products') || ss.getSheets()[0];
}

function addProduct(d) {
  _pSheet().appendRow([d.id,d.name,d.description,d.price,d.coverImage||'',d.galleryImages||'',d.category||'',d.videoURLs||'']);
  return out({ success:true });
}

function updateProduct(d) {
  var sh = _pSheet(), last = sh.getLastRow();
  if (last < 2) return out({ success:false, error:'Product not found.' });
  var ids = sh.getRange(2,1,last-1,1).getValues();
  for (var i=0; i<ids.length; i++) {
    if (String(ids[i][0]) === String(d.id)) {
      sh.getRange(i+2,1,1,8).setValues([[d.id,d.name,d.description,d.price,d.coverImage||'',d.galleryImages||'',d.category||'',d.videoURLs||'']]);
      return out({ success:true });
    }
  }
  return out({ success:false, error:'Product not found.' });
}

function deleteProduct(d) {
  var sh = _pSheet(), last = sh.getLastRow();
  if (last < 2) return out({ success:false, error:'Product not found.' });
  var ids = sh.getRange(2,1,last-1,1).getValues();
  for (var i=0; i<ids.length; i++) {
    if (String(ids[i][0]) === String(d.id)) { sh.deleteRow(i+2); return out({ success:true }); }
  }
  return out({ success:false, error:'Product not found.' });
}

// 
//  CATEGORIES / BANNERS / COUPONS
// 
function addCategory(d) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var s  = ss.getSheetByName('Categories') || ss.insertSheet('Categories');
  s.appendRow([d.category]);
  return out({ success:true });
}

function deleteCategory(d) {
  var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Categories');
  if (!s) return out({ success:false, error:'Sheet not found.' });
  var vals = s.getRange(1,1,s.getLastRow(),1).getValues();
  for (var i=0; i<vals.length; i++) {
    if (vals[i][0].toString().trim() === (d.category||'').trim()) { s.deleteRow(i+1); return out({ success:true }); }
  }
  return out({ success:false, error:'Category not found.' });
}

function addBanner(d) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var s  = ss.getSheetByName('Banners') || ss.insertSheet('Banners');
  s.appendRow([d.id, d.imageUrl||'', d.active!==false, d.sortOrder||0, d.title||'']);
  return out({ success:true });
}

function deleteBanner(d) {
  var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Banners');
  if (!s) return out({ success:false, error:'Sheet not found.' });
  var ids = s.getRange(1,1,s.getLastRow(),1).getValues();
  for (var i=0; i<ids.length; i++) {
    if (String(ids[i][0]) === String(d.id)) { s.deleteRow(i+1); return out({ success:true }); }
  }
  return out({ success:false, error:'Banner not found.' });
}

function validateCoupon(d) {
  var s = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Coupons');
  if (!s) return out({ success:false, error:'No coupons available.' });
  var code = (d.couponCode || d.code || '').toUpperCase().trim();
  if (!code) return out({ success:false, error:'Coupon code is required.' });
  var vals = s.getDataRange().getValues();
  for (var i=0; i<vals.length; i++) {
    if (vals[i][0].toString().toUpperCase().trim() === code) {
      // Check active flag
      if (vals[i][2] !== true && vals[i][2] !== 'TRUE')
        return out({ success:false, error:'This coupon is inactive.' });
      // Check expiry date (column D)
      var expRaw = vals[i][3];
      var expiry = '';
      if (expRaw instanceof Date && !isNaN(expRaw)) {
        var yy = expRaw.getFullYear();
        var mm = ('0'+(expRaw.getMonth()+1)).slice(-2);
        var dd = ('0'+expRaw.getDate()).slice(-2);
        expiry = yy + '-' + mm + '-' + dd;
      } else if (expRaw) {
        expiry = expRaw.toString().trim();
      }
      if (expiry) {
        var m = expiry.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (m) {
          var expiryDate = new Date(+m[1], +m[2]-1, +m[3], 23, 59, 59);
          if (new Date() > expiryDate)
            return out({ success:false, error:'This coupon has expired.' });
        }
      }
      return out({
        success: true,
        discount: Number(vals[i][1]),
        expiryDate: expiry,
        minimumAmount: Number(vals[i][4]) || 0
      });
    }
  }
  return out({ success:false, error:'Invalid coupon code.' });
}

// 
//  USER HELPERS
// 
function _uSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var s  = ss.getSheetByName('Users');
  if (!s) {
    s = ss.insertSheet('Users');
    s.appendRow(['UserID','Name','Email','PasswordHash','Phone','CreatedAt','Cart','Addresses']);
    s.setFrozenRows(1);
  }
  return s;
}

// Returns 1-based sheet row for userId, or -1
function _userRow(sh, userId) {
  var last = sh.getLastRow();
  if (last < 2) return -1;
  var ids = sh.getRange(2,1,last-1,1).getValues();
  for (var i=0; i<ids.length; i++)
    if (String(ids[i][0]) === String(userId)) return i+2;
  return -1;
}

// Collision-resistant ID: timestamp (base36) + 5-char random
function _id(prefix) {
  return prefix + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2,7).toUpperCase();
}

// 
//  REGISTER
// 
function registerUser(d) {
  var email = (d.email||'').toLowerCase().trim();
  if (!email || !d.passwordHash || !d.name)
    return out({ success:false, error:'Missing required fields.' });

  var sh = _uSheet(), last = sh.getLastRow();
  if (last > 1) {
    var emails = sh.getRange(2,3,last-1,1).getValues(); // col C only
    for (var i=0; i<emails.length; i++)
      if (emails[i][0].toString().toLowerCase() === email)
        return out({ success:false, error:'An account with this email already exists.' });
  }

  var userId = _id('U');
  sh.appendRow([userId, d.name.trim(), email, d.passwordHash, d.phone||'', new Date().toISOString(), '[]', '[]']);
  return out({ success:true, userId:userId });
}

// 
//  LOGIN
// 
function loginUser(d) {
  var email = (d.email||'').toLowerCase().trim();
  var sh    = _uSheet(), last = sh.getLastRow();
  if (last < 2) return out({ success:false, error:'Incorrect email or password.' });

  // Read cols A-E only (ID, Name, Email, Hash, Phone)
  var rows = sh.getRange(2,1,last-1,5).getValues();
  for (var i=0; i<rows.length; i++) {
    if (rows[i][2].toString().toLowerCase() === email && rows[i][3].toString() === d.passwordHash) {
      return out({ success:true, user:{
        userId: String(rows[i][0]),
        name:   String(rows[i][1]),
        email:  String(rows[i][2]),
        phone:  String(rows[i][4]||'')
      }});
    }
  }
  return out({ success:false, error:'Incorrect email or password.' });
}

// 
//  UPDATE PROFILE
// 
function updateUser(d) {
  var sh  = _uSheet();
  var row = _userRow(sh, d.userId);
  if (row < 0) return out({ success:false, error:'User not found.' });

  var cur = sh.getRange(row,1,1,5).getValues()[0]; // A-E
  // Only overwrite if new value is non-empty  preserves existing data
  var newName  = (d.name  && d.name.trim())  ? d.name.trim()  : cur[1];
  var newPhone = (d.phone !== undefined)       ? d.phone.trim() : cur[4];

  sh.getRange(row,2).setValue(newName);   // col B
  sh.getRange(row,5).setValue(newPhone);  // col E
  return out({ success:true });
}

// 
//  CHANGE PASSWORD
// 
function changePassword(d) {
  var sh  = _uSheet();
  var row = _userRow(sh, d.userId);
  if (row < 0) return out({ success:false, error:'User not found.' });
  if (sh.getRange(row,4).getValue().toString() !== d.currentHash)
    return out({ success:false, error:'Current password is incorrect.' });
  sh.getRange(row,4).setValue(d.newHash);
  return out({ success:true });
}

// 
//  CART
// 
function getCart(d) {
  var sh  = _uSheet();
  var row = _userRow(sh, d.userId);
  if (row < 0) return out({ success:true, cart:[] });
  var raw = sh.getRange(row,7).getValue()||'[]'; // col G
  var cart; try { cart = JSON.parse(raw); } catch(e){ cart=[]; }
  return out({ success:true, cart:cart });
}

function saveCart(d) {
  var sh  = _uSheet();
  var row = _userRow(sh, d.userId);
  if (row < 0) return out({ success:false, error:'User not found.' });
  var json = JSON.stringify(Array.isArray(d.cart)?d.cart:[]);
  if (json.length > 45000)
    return out({ success:false, error:'Cart is too large. Please remove some items.' });
  sh.getRange(row,7).setValue(json);
  return out({ success:true });
}

// 
//  ORDERS
// 
function _oSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var s  = ss.getSheetByName('Orders');
  if (!s) {
    s = ss.insertSheet('Orders');
    s.appendRow(['OrderID','UserID','Date','Items','Total','Name','Phone','Address','Status']);
    s.setFrozenRows(1);
  }
  return s;
}

function saveOrder(d) {
  var s     = _oSheet();
  var order = d.order || {};
  var orderId = _id('SJ');
  var date    = Utilities.formatDate(new Date(), 'Asia/Kolkata', 'dd/MM/yyyy HH:mm');
  var items   = Array.isArray(order.items)
    ? order.items.map(function(i){ return (i.name||'')+' x'+(i.quantity||1); }).join(', ')
    : String(order.items||'');
  s.appendRow([orderId, String(d.userId||'GUEST'), date, items, Number(order.total||0),
    String(order.name||''), String(order.phone||''), String(order.address||''), 'Pending']);
  return out({ success:true, orderId:orderId });
}

function getOrders(d) {
  var s    = _oSheet(), last = s.getLastRow();
  if (last < 2) return out({ success:true, orders:[] });
  var orders = [];
  s.getRange(2,1,last-1,9).getValues().forEach(function(r){
    if (String(r[1]) === String(d.userId))
      orders.push({ orderId:String(r[0]), date:String(r[2]), items:String(r[3]),
        total:Number(r[4]), name:String(r[5]), phone:String(r[6]),
        address:String(r[7]), status:String(r[8]||'Pending') });
  });
  orders.reverse(); // newest first
  return out({ success:true, orders:orders });
}

// 
//  ADDRESSES
// 
function saveAddressAction(d) {
  var sh  = _uSheet();
  var row = _userRow(sh, d.userId);
  if (row < 0) return out({ success:false, error:'User not found.' });
  var existing; try { existing = JSON.parse(sh.getRange(row,8).getValue()||'[]'); } catch(e){ existing=[]; }
  var updated = existing.concat([d.address]);
  sh.getRange(row,8).setValue(JSON.stringify(updated));
  return out({ success:true, addresses:updated });
}

function replaceAddressesAction(d) {
  var sh  = _uSheet();
  var row = _userRow(sh, d.userId);
  if (row < 0) return out({ success:false, error:'User not found.' });
  var updated = Array.isArray(d.addresses) ? d.addresses : [];
  sh.getRange(row,8).setValue(JSON.stringify(updated));
  return out({ success:true, addresses:updated });
}

function getAddresses(d) {
  var sh  = _uSheet();
  var row = _userRow(sh, d.userId);
  if (row < 0) return out({ success:true, addresses:[] });
  var addresses; try { addresses = JSON.parse(sh.getRange(row,8).getValue()||'[]'); } catch(e){ addresses=[]; }
  return out({ success:true, addresses:addresses });
}
