// js/common.js

(function () {

  // 🔥 Firebase Config
  const CFG = {
    apiKey: "AIzaSyDBpprnuEhHMF8_pFKTdQI1J9lOMJwTa74",
    authDomain: "expense-tracker-c3176.firebaseapp.com",
    databaseURL: "https://expense-tracker-c3176-default-rtdb.asia-southeast1.firebasedatabase.app/",
    projectId: "expense-tracker-c3176",
    storageBucket: "expense-tracker-c3176.appspot.com",
    messagingSenderId: "924097427855",
    appId: "1:924097427855:web:f35b0dec7601de6e8c33fa"
  };

  if (!firebase.apps.length) firebase.initializeApp(CFG);

  window.fbAuth = firebase.auth();
  window.fbDB = firebase.database();
  window.fbFS = firebase.firestore();

  // 🌙 THEME SYSTEM
  function applyTheme(theme) {
    const isLight = theme === 'light';

    document.body.classList.toggle('light', isLight);
    document.documentElement.setAttribute('data-theme', theme);

    const btn = document.getElementById('themeBtn');
    if (btn) btn.textContent = isLight ? '🌙' : '☀️';

    const toggle = document.getElementById('themeToggleInput');
    if (toggle) toggle.checked = isLight;

    localStorage.setItem('wt', theme);
  }

  window.initTheme = function () {
    applyTheme(localStorage.getItem('wt') || 'dark');
  };

  window.toggleTheme = function () {
    applyTheme(document.body.classList.contains('light') ? 'dark' : 'light');
  };

  // 📱 SIDEBAR
  window.toggleSidebar = function () {
    document.getElementById('sidebar')?.classList.toggle('open');
  };

  document.addEventListener('click', function (e) {
    const sb = document.getElementById('sidebar');
    const mb = document.getElementById('menuBtn');

    if (sb && mb && !sb.contains(e.target) && !mb.contains(e.target)) {
      sb.classList.remove('open');
    }
  });

  // 🔔 TOAST
  window.showToast = function (msg, type) {
    const el = document.getElementById('toast');
    if (!el) return;

    el.textContent = msg;
    el.classList.add('show');
    if (type) el.classList.add(type);

    clearTimeout(el._t);
    el._t = setTimeout(() => {
      el.classList.remove('show');
      // Clean up specialty classes after fade out
      setTimeout(() => {
        if (type) el.classList.remove(type);
      }, 400);
    }, 4000); 
  };

  // 🔐 AUTH GUARD
  // window.requireAuth = function (cb) {
  //   fbAuth.onAuthStateChanged(async function (user) {

  //     if (!user) {
  //       window.location.href = 'index.html';
  //       return;
  //     }

  //     try {
  //       const doc = await fbFS.collection('users').doc(user.uid).get();

  //       if (!doc.exists) {
  //         window.location.href = 'setup.html';
  //         return;
  //       }

  //       const data = doc.data();

  //       // 👉 If no budget AND no group → go to setup
  //       if (!data.budget && !data.groupId) {
  //         window.location.href = 'setup.html';
  //         return;
  //       }

  //       // 🔔 Notifications
  //       if (typeof listenForNotifications === 'function') {
  //         listenForNotifications(user.uid);
  //       }

  //       // 👤 USER UI
  //       const name = data.name || user.email.split('@')[0];

  //       const av = document.getElementById('userAvatar');
  //       const un = document.getElementById('userName');

  //       if (av) av.textContent = name[0].toUpperCase();
  //       if (un) un.textContent = name;

  //       const ur = document.querySelector('.user-role');
  //       if (ur && enrichedData.role) {
  //         ur.textContent = enrichedData.role === 'admin' ? 'Owner' : 'Member';
  //       }

  //       // 🚪 Logout
  //       document.getElementById('logoutBtn')?.addEventListener('click', () => {
  //         fbAuth.signOut().then(() => {
  //           window.location.href = 'index.html';
  //         });
  //       });

  //       // 🌙 Theme button
  //       document.getElementById('themeBtn')?.addEventListener('click', window.toggleTheme);

  //       // 🎯 ROLE FIX (important for group logic)
  //       const enrichedData = {
  //         ...data,
  //         name: name,
  //         role: data.role || (data.groupId ? 'member' : null)
  //       };

  //       if (cb) cb(user, enrichedData);

  //     } catch (err) {
  //       console.error("Auth error:", err);

  //       if (err.code === 'permission-denied') {
  //         showToast('Permission error. Check Firestore rules.', 'error');
  //       } else {
  //         window.location.href = 'index.html';
  //       }
  //     }

  //   });
  // };

  // js/common.js

  window.requireAuth = function (callback) {
    fbAuth.onAuthStateChanged(function (user) {

      if (!user) {
        window.location.href = 'index.html';
        return;
      }

      fbFS.collection('users').doc(user.uid).get()
        .then(function (doc) {

          if (!doc.exists) {
            window.location.href = 'setup.html';
            return;
          }

          const data = doc.data();

          const enrichedData = {
            ...data,
            name: data.name || user.email.split('@')[0],
            role: data.role || (data.groupId ? 'member' : null)
          };

          if (!enrichedData.groupId && !enrichedData.budget) {
            window.location.href = 'setup.html';
            return;
          }

          // 👤 USER UI
          const av = document.getElementById('userAvatar');
          const un = document.getElementById('userName');
          const ur = document.querySelector('.user-role');
          
          if (un) un.textContent = enrichedData.name;
          if (av) av.textContent = enrichedData.name.charAt(0).toUpperCase();
          if (ur) ur.textContent = enrichedData.role === 'admin' ? 'Owner' : 'Member';

          // 🚪 Logout listeners and other common initializations
          const logoutBtn = document.getElementById('logoutBtn');
          if (logoutBtn && !logoutBtn._hasListener) {
            logoutBtn.addEventListener('click', function() {
              window.fbAuth.signOut().then(() => window.location.href = 'index.html');
            });
            logoutBtn._hasListener = true;
          }
          
          const themeBtn = document.getElementById('themeBtn');
          if (themeBtn && !themeBtn._hasListener) {
            themeBtn.addEventListener('click', window.toggleTheme);
            themeBtn._hasListener = true;
          }

          callback(user, enrichedData);
        }).catch(function(err) {
          console.error("Auth error:", err);
          window.location.href = 'index.html';
        });
    });
  };

  // 🔔 INVITE NOTIFICATIONS (FIXED FIELD)
  window.toggleNotifs = function() {
    const el = document.getElementById('notifDropdown');
    if (el) el.classList.toggle('show');
  };

  window.listenForNotifications = function (uid) {
    if (!uid) return;
    const body = document.getElementById('notifBody');
    const badge = document.getElementById('notifBadge');

    window.fbFS.collection('invitations')
      .where('inviteeEmail', '==', window.fbAuth.currentUser.email)
      .where('status', '==', 'pending')
      .onSnapshot(function (snap) {
        if (!body) return;
        body.innerHTML = '';
        const count = snap.size;
        
        if (badge) {
          badge.textContent = count;
          badge.style.display = count > 0 ? 'flex' : 'none';
        }

        if (count === 0) {
          body.innerHTML = '<div class="notif-empty">No new notifications</div>';
          return;
        }

        snap.forEach(function (doc) {
          const inv = doc.data();
          const id = doc.id;
          const item = document.createElement('div');
          item.className = 'notif-item';
          item.innerHTML = `
            <div class="notif-text"><strong>${inv.inviterName || 'Someone'}</strong> invited you to join the group <strong>${inv.groupName || 'Family'}</strong>.</div>
            <div class="notif-actions">
              <button class="notif-btn-accept" onclick="respondInvite('${id}', 'accepted', '${inv.groupId}')">Accept</button>
              <button class="notif-btn-decline" onclick="respondInvite('${id}', 'declined')">Decline</button>
            </div>
          `;
          body.appendChild(item);
        });
      });
  };

  window.initTheme();

})();