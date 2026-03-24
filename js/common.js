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
    }, 5000); 
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

      // 🔄 Real-time User Doc Listener
      fbFS.collection('users').doc(user.uid).onSnapshot(function (doc) {
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

        // 👤 UPDATE USER UI (INSTANT SYNC)
        const av = document.getElementById('userAvatar');
        const un = document.getElementById('userName');
        const ur = document.querySelector('.user-role');
        
        // If we are on dashboard.html, let dashboard.js handle context-aware name/avatar
        const isDashboard = /dashboard(\.html)?$/.test(window.location.pathname);
        if (!isDashboard) {
          if (un) un.textContent = enrichedData.name;
          if (av) av.textContent = enrichedData.name.charAt(0).toUpperCase();
        }
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
      }, function(err) {
        console.error("User sync error:", err);
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
    let allItems = [];
    let lastSeenCount = parseInt(localStorage.getItem('wt_notif_seen') || '0');

    // 🔥 Reset Badge on Open
    const btn = document.getElementById('notifBtn');
    if (btn && !btn._notifObs) {
      btn._notifObs = true;
      btn.addEventListener('click', () => {
        lastSeenCount = allItems.length;
        localStorage.setItem('wt_notif_seen', lastSeenCount);
        if (badge) {
          badge.style.display = 'none';
          badge.textContent = '0';
        }
      });
    }

    const render = () => {
      if (!body) return;
      body.innerHTML = '';
      
      // Sort newest date first
      allItems.sort((a,b) => {
        const timeA = a.createdAt?.seconds || (a.createdAt instanceof Date ? a.createdAt.getTime()/1000 : 0);
        const timeB = b.createdAt?.seconds || (b.createdAt instanceof Date ? b.createdAt.getTime()/1000 : 0);
        return timeB - timeA;
      });
      
      // Calculate 'New' items (those arrived since we last clicked)
      const newItemsCount = allItems.length - lastSeenCount;
      if (badge && newItemsCount > 0) {
        badge.textContent = newItemsCount;
        badge.style.display = 'flex';
      }

      if (allItems.length === 0) {
        body.innerHTML = '<div class="notif-empty">No activity yet.</div>';
        return;
      }

      allItems.forEach(item => {
        const div = document.createElement('div');
        div.className = 'notif-item';
        
        if (item._type === 'invite') {
          div.innerHTML = `
            <div class="notif-icon-circle blue">📩</div>
            <div class="notif-content">
              <div class="notif-text"><strong>${item.inviterName || 'Someone'}</strong> invited you to <strong>${item.groupName || 'Group'}</strong>.</div>
              <div class="notif-actions">
                <button class="notif-btn-accept" onclick="respondInvite('${item.id}', 'accepted', '${item.groupId}')">Accept</button>
                <button class="notif-btn-decline" onclick="respondInvite('${item.id}', 'declined')">Decline</button>
              </div>
            </div>
          `;
        } else {
          const isSync = item.type === 'sync';
          div.innerHTML = `
            <div class="notif-icon-circle ${isSync ? 'purple' : 'green'}">${isSync ? '🔗' : '💸'}</div>
            <div class="notif-content">
              <div class="notif-title">${item.title}</div>
              <div class="notif-message">${item.message}</div>
            </div>
          `;
        }
        body.appendChild(div);
      });
    };

    // Listen 1: Invitations (Case-insensitive support)
    const emailStr = (window.fbAuth.currentUser.email || '').toLowerCase();
    window.fbFS.collection('invites')
      .where('inviteeEmail', '==', emailStr)
      .where('status', '==', 'pending')
      .onSnapshot(snap => {
        const invites = snap.docs.map(d => ({ ...d.data(), id: d.id, _type: 'invite' }));
        allItems = allItems.filter(i => i._type !== 'invite').concat(invites);
        render();
      });

    // Listen 2: Activity Notifications (spent, sync, etc)
    window.fbFS.collection('notifications')
      .where('userId', '==', uid)
      .orderBy('createdAt', 'desc').limit(10)
      .onSnapshot(snap => {
        const news = snap.docs.map(d => ({ ...d.data(), id: d.id, _type: 'notif' }));
        allItems = allItems.filter(i => i._type !== 'notif').concat(news);
        render();
      }, err => {
        console.error('Notifications listener error:', err);
        if (err.message.includes('index')) {
          console.warn('Composite index required for notifications. Check Firestore console.');
          // Fallback: try without orderBy if it fails?
          window.fbFS.collection('notifications')
            .where('userId', '==', uid)
            .limit(10)
            .onSnapshot(s => {
               const n = s.docs.map(d => ({ ...d.data(), id: d.id, _type: 'notif' }));
               allItems = allItems.filter(i => i._type !== 'notif').concat(n);
               render();
            });
        }
      });
  };

  window.initTheme();

})();