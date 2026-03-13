// js/common.js — shared across all pages
// ── Firebase config ──────────────────────────────────────
var fbDefault = {
  apiKey:            "AIzaSyDBpprnuEhHMF8_pFKTdQI1J9lOMJwTa74",
  authDomain:        "expense-tracker-c3176.firebaseapp.com",
  databaseURL:       "https://expense-tracker-c3176-default-rtdb.asia-southeast1.firebasedatabase.app/",
  projectId:         "expense-tracker-c3176",
  storageBucket:     "expense-tracker-c3176.appspot.com",
  messagingSenderId: "924097427855",
  appId:             "1:924097427855:web:f35b0dec7601de6e8c33fa"
};
var fbApp = firebase.initializeApp(window.FB_CONFIG || fbDefault);
var fbAuth = firebase.auth();
var fbDB   = firebase.database();

// ── Theme ─────────────────────────────────────────────────
window.initTheme = function () {
  if (localStorage.getItem('wt_theme') === 'light') {
    document.body.classList.add('light');
  }
  var btn = document.getElementById('themeBtn');
  if (btn) btn.textContent = document.body.classList.contains('light') ? '🌙' : '☀️';
};

window.toggleTheme = function () {
  document.body.classList.toggle('light');
  var isLight = document.body.classList.contains('light');
  localStorage.setItem('wt_theme', isLight ? 'light' : 'dark');
  var btn = document.getElementById('themeBtn');
  if (btn) btn.textContent = isLight ? '🌙' : '☀️';
};

// ── Toast notification ────────────────────────────────────
window.showToast = function (msg, type) {
  var el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;
  el.className   = 'toast show' + (type ? ' ' + type : '');
  clearTimeout(el._t);
  el._t = setTimeout(function () { el.classList.remove('show'); }, 3500);
};

// ── Sidebar toggle (dashboard) ────────────────────────────
window.toggleSidebar = function () {
  var sb = document.getElementById('sidebar');
  if (sb) sb.classList.toggle('open');
};

// ── Auth guard ────────────────────────────────────────────
// Usage: window.requireAuth(function(user, userData) { … });
window.requireAuth = function (callback) {
  fbAuth.onAuthStateChanged(function (user) {
    if (!user) {
      window.location.href = 'signin.html';
      return;
    }
    // Populate user UI elements if they exist
    var avatarEl = document.getElementById('userAvatar');
    var nameEl   = document.getElementById('userName');
    if (avatarEl) avatarEl.textContent = (user.email || 'U')[0].toUpperCase();
    if (nameEl)   nameEl.textContent   = user.displayName || user.email || 'User';

    // Logout button
    var logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.onclick = function () {
        fbAuth.signOut().then(function () {
          window.location.href = 'signin.html';
        });
      };
    }

    // Theme button in dashboard
    var themeBtn = document.getElementById('themeBtn');
    if (themeBtn) themeBtn.onclick = window.toggleTheme;

    // Fetch user data then run callback
    fbDB.ref('users/' + user.uid).get().then(function (snap) {
      var data = snap.val() || {};
      callback(user, data);
    }).catch(function () {
      callback(user, {});
    });
  });
};
