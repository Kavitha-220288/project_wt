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

// ── Global Session Sync ───────────────────────────────────
// Ensures flags are restored if Firebase remembers the session
fbAuth.onAuthStateChanged(function (user) {
  if (user) {
    localStorage.setItem('wt_logged_in', 'true');
    document.cookie = "wt_logged_in=true; path=/; max-age=86400";
  }
});

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
      localStorage.removeItem('wt_logged_in');
      document.cookie = "wt_logged_in=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
      window.location.href = 'signin.html';
      return;
    }
    
    // Set a flag for immediate head-script checking
    localStorage.setItem('wt_logged_in', 'true');
    // Set a cookie for server-side protection
    document.cookie = "wt_logged_in=true; path=/; max-age=86400"; // 24h

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
          localStorage.removeItem('wt_logged_in');
          document.cookie = "wt_logged_in=; path=/; expires=Thu, 01 Jan 1970 00:00:00 UTC;";
          window.location.href = 'signin.html';
        });
      };
    }

    // Show body now that we're authorized
    document.body.style.visibility = 'visible';
    document.body.style.opacity = '1';

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

// ── Image Compression Utility ─────────────────────────────
window.compressImage = function(file, maxWidth, maxHeight, quality) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = event => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        // ⚡ GPU-Accelerated Fast Processing (Instant)
        // Greyscale + slight contrast boost for OCR clarity
        ctx.filter = 'grayscale(100%) contrast(120%) brightness(105%)';
        ctx.drawImage(img, 0, 0, width, height);

        // Export as JPEG (0.65 is the sweet spot for file size vs text legibility)
        const dataUrl = canvas.toDataURL('image/jpeg', quality || 0.65);
        resolve(dataUrl.split(',')[1]); 
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};
