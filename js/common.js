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



  // 🎨 Multi-Group & Dropdown Styles
  const wtStyles = document.createElement('style');
  wtStyles.innerHTML = `
    .groups-submenu { display: none; flex-direction: column; gap: 4px; padding: 0.2rem 0.5rem 0.5rem 1.8rem; border-left: 1.5px solid var(--border); margin: 4px 0 8px 12px; animation: slideInSub .2s ease; }
    .groups-submenu.show { display: flex; }
    .submenu-item { padding: 0.5rem 0.8rem; border-radius: 8px; font-size: 0.78rem; color: var(--muted); cursor: pointer; transition: 0.2s; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 8px; }
    .submenu-item:hover { background: rgba(255,255,255,0.05); color: var(--accent); }
    .submenu-item.active { color: var(--accent); font-weight: 700; background: rgba(91,124,250,0.1); }
    .submenu-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
    @keyframes slideInSub { from { opacity:0; transform: translateY(-5px); } to { opacity:1; transform: translateY(0); } }
  `;
  document.head.appendChild(wtStyles);

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
        window.gUserDoc = data; // Store globally for common access
        
        // 🔄 AUTO-HEAL: Ensure current group is in groupsList
        if (data.groupId && data.groupName) {
            const inList = (data.groupsList || []).some(g => g.id === data.groupId);
            if (!inList) {
                fbFS.collection('users').doc(user.uid).update({
                    groupsList: firebase.firestore.FieldValue.arrayUnion({ id: data.groupId, name: data.groupName })
                });
            }
        }

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
        const avs = document.querySelectorAll('#userAvatar');
        const uns = document.querySelectorAll('#userName');
        const urs = document.querySelectorAll('.user-role');
        const viewMode = localStorage.getItem('viewMode') || 'personal';

        uns.forEach(u => u.textContent = (viewMode === 'group' && enrichedData.groupId) ? 'Family Account' : enrichedData.name);
        avs.forEach(a => a.textContent = ((viewMode === 'group' && enrichedData.groupId) ? 'F' : enrichedData.name.charAt(0)).toUpperCase());
        urs.forEach(r => r.textContent = viewMode === 'group' ? (enrichedData.role === 'admin' ? 'Group Owner' : 'Group Member') : 'Personal Account');

        // 🔄 HANDLER FOR MODE TOGGLE HTML (if present)
        const modeBtn = document.getElementById('modeToggle');
        if (modeBtn) {
          modeBtn.style.display = enrichedData.groupId ? 'flex' : 'none';
          
          // Inject/Update Groups Dropdown
          let sub = document.getElementById('groupsSubmenu');
          if (!sub) {
            sub = document.createElement('div');
            sub.id = 'groupsSubmenu';
            sub.className = 'groups-submenu';
            modeBtn.parentNode.insertBefore(sub, modeBtn.nextSibling);
          }
          const groups = enrichedData.groupsList || [];
          sub.innerHTML = groups.map(g => `
            <div class="submenu-item ${viewMode === 'group' && g.id === enrichedData.groupId ? 'active' : ''}" onclick="event.stopPropagation(); selectGroupProfile('${g.id}', '${g.name.replace(/'/g, "\\'")}')">
              <div class="submenu-dot"></div>
              <span>${g.name}</span>
            </div>
          `).join('') + (viewMode === 'group' ? `
            <div class="submenu-item" style="color:var(--text); font-weight:600; border-top: 1px dotted var(--border); margin-top:6px; padding-top:8px" onclick="event.stopPropagation(); localStorage.setItem('viewMode', 'personal'); window.location.href='dashboard.html'">
               <span>👤 Back to Personal</span>
            </div>
          ` : '');

          const label = document.getElementById('modeLabel');
          const dot = document.getElementById('modeDot');
          if (label) label.textContent = viewMode === 'personal' ? 'Switch to Group' : 'Family Profiles';
          if (dot) dot.className = 'mode-indicator ' + viewMode;
        }

        // 💬 Toggle Group Chat in Sidebar
        const chatNav = document.getElementById('navChat') || document.querySelector('.nav-item[href*="chat"]');
        if (chatNav) {
          chatNav.style.display = (viewMode === 'group' && enrichedData.groupId) ? 'flex' : 'none';
        }

        // 🚪 Logout listeners
        const logoutBtns = document.querySelectorAll('#logoutBtn');
        logoutBtns.forEach(btn => {
          if (!btn._hasListener) {
            btn.addEventListener('click', function () {
              window.fbAuth.signOut().then(() => window.location.href = 'index.html');
            });
            btn._hasListener = true;
          }
        });

        const themeBtn = document.getElementById('themeBtn');
        if (themeBtn && !themeBtn._hasListener) {
          themeBtn.addEventListener('click', window.toggleTheme);
          themeBtn._hasListener = true;
        }

        callback(user, enrichedData);
      }, function (err) {
        console.error("User sync error:", err);
        window.location.href = 'index.html';
      });
    });
  };

  // 👤 PROFILE MENU HELPER
  window.toggleProfileMenu = function (e, forceClose) {
    if (e && e.stopPropagation) e.stopPropagation();
    const menu = document.getElementById('profileMenu');
    if (!menu) return;
    if (forceClose) {
      menu.classList.remove('show');
    } else {
      menu.classList.toggle('show');
    }
  };

  // 🔄 GLOBAL VIEW MODE TOGGLE (DROPDOWN SUPPORT)
  window.toggleViewMode = function () {
    const groups = (window.gUserDoc && window.gUserDoc.groupsList) || [];
    const sub = document.getElementById('groupsSubmenu');
    
    // Always show/toggle the dropdown if any groups exist
    if (groups.length > 0) {
        if (sub) sub.classList.toggle('show');
    } else {
        if (window.showToast) window.showToast('Join or create a group first!', 'info');
    }
  };

  function selectGroupProfile(groupId, groupName) {
    const uid = window.fbAuth.currentUser?.uid;
    if (!uid) return;
    
    window.fbFS.collection('users').doc(uid).update({
      groupId: groupId,
      groupName: groupName
    }).then(() => {
      localStorage.setItem('viewMode', 'group');
      window.location.href = 'dashboard.html';
    }).catch(err => {
      if (window.showToast) window.showToast(err.message, 'error');
    });
  };

  window.selectGroupProfile = function (groupId, groupName) {
    const uid = window.fbAuth.currentUser?.uid;
    if (!uid) return;

    // Switch Active Group in DB so everything syncs
    window.fbFS.collection('users').doc(uid).update({
      groupId: groupId,
      groupName: groupName
    }).then(() => {
      localStorage.setItem('viewMode', 'group');
      window.location.href = 'dashboard.html';
    }).catch(err => {
      if (window.showToast) window.showToast(err.message, 'error');
    });
  };

  // Close menus on outside click
  document.addEventListener('click', function () {
    window.toggleProfileMenu(null, true);
  });

  // 🔔 INVITE NOTIFICATIONS (FIXED FIELD)
  window.toggleNotifs = function () {
    const el = document.getElementById('notifDropdown');
    if (el) el.classList.toggle('show');
  };

  window.listenForNotifications = function (uid) {
    if (!uid) return;
    const body = document.getElementById('notifBody');
    const badge = document.getElementById('notifBadge');
    let allItems = [];
    let lastSeenCount = parseInt(localStorage.getItem('wt_notif_seen') || '0');
    let isInitialLoad = true; // 🛡️ Prevent toasting old notifications on startup

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
      allItems.sort((a, b) => {
        const timeA = a.createdAt?.seconds || (a.createdAt instanceof Date ? a.createdAt.getTime() / 1000 : 0);
        const timeB = b.createdAt?.seconds || (b.createdAt instanceof Date ? b.createdAt.getTime() / 1000 : 0);
        return timeB - timeA;
      });

      // Calculate 'New' items for badge
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
              <div class="notif-title">Group Invitation</div>
              <div class="notif-text"><strong>${item.inviterName || 'Someone'}</strong> invited you to join <strong>${item.groupName || 'their group'}</strong>.</div>
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

        // 🔔 Toast for NEW invites
        if (!isInitialLoad) {
          snap.docChanges().forEach(change => {
            if (change.type === 'added') {
              const d = change.doc.data();
              window.showToast(`📩 New invite to ${d.groupName || 'a group'}`, 'info');
            }
          });
        }

        allItems = allItems.filter(i => i._type !== 'invite').concat(invites);
        render();
        isInitialLoad = false;
      });

    // Listen 2: Activity Notifications (spent, sync, etc)
    window.fbFS.collection('notifications')
      .where('userId', '==', uid)
      .orderBy('createdAt', 'desc').limit(15)
      .onSnapshot(snap => {
        const news = snap.docs.map(d => ({ ...d.data(), id: d.id, _type: 'notif' }));

        // 🔔 Toast for NEW notifications
        if (!isInitialLoad) {
          snap.docChanges().forEach(change => {
            if (change.type === 'added') {
              const d = change.doc.data();
              window.showToast(`${d.type === 'sync' ? '🔗 Sync: ' : '💸 '}${d.message}`, 'info');
            }
          });
        }

        allItems = allItems.filter(i => i._type !== 'notif').concat(news);
        render();
        isInitialLoad = false;
      }, err => {
        console.error('Notifications listener error:', err);
        if (err.message.includes('index')) {
          console.warn('Composite index required for notifications. Check Firestore console.');
          window.fbFS.collection('notifications').where('userId', '==', uid).limit(10).onSnapshot(s => {
            const n = s.docs.map(d => ({ ...d.data(), id: d.id, _type: 'notif' }));
            allItems = allItems.filter(i => i._type !== 'notif').concat(n);
            render();
          });
        }
      });
  };

  window.initTheme();

})();