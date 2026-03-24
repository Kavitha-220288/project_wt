// js/dashboard.js — Bulletproof Edition
// Watches the entire 'expenses' collection and renders what belongs to this user.

var gUser = null;
var gData = {};
var gUserDoc = {}; // Original user data
var gGroupDoc = {}; // Original group data
var gExpenses   = [];   
var gMyExpenses = [];   
var gChart = null;
var gEditId = null;
var gDashboardInit = false; 
var gListener = null; // Store the current listener reference

var gViewMode = localStorage.getItem('viewMode') || 'personal'; 

window.toggleViewMode = function() {
  if (!gUserDoc || !gUserDoc.groupId) {
    showToast('Join a group first!', 'info');
    return;
  }
  
  window.gViewMode = (window.gViewMode === 'personal' ? 'group' : 'personal');
  gViewMode = window.gViewMode;
  localStorage.setItem('viewMode', window.gViewMode);
  showToast('Showing ' + window.gViewMode + ' dashboard', 'info');
  
  // Ensure we update global data and labels
  if (typeof syncDashboardData === 'function') {
    syncDashboardData();
  } else {
    updateModeUI();
    renderOverview();
  }

  // Relistens to expenses with the new filter
  loadExpenses();
  // Automatically switch back to Overview for a smoother transition
  switchTab('overview');
};

window.toggleProfileMenu = function(e, forceClose) {
  if (e && e.stopPropagation) e.stopPropagation();
  const menu = document.getElementById('profileMenu');
  if (!menu) return;
  if (forceClose) {
    menu.classList.remove('show');
  } else {
    menu.classList.toggle('show');
  }
};

function updateModeUI() {
  const badge = document.getElementById('viewModeBadge');
  const toggle = document.getElementById('modeToggle');
  const label = document.getElementById('modeLabel');
  const dot = document.getElementById('modeDot');
  
  if (badge) {
    badge.textContent = gViewMode;
    badge.className = 'page-mode-badge ' + gViewMode;
  }
  if (toggle) {
    toggle.style.display = (gUserDoc && gUserDoc.groupId) ? 'flex' : 'none';
  }
  if (label) {
    label.textContent = gViewMode === 'personal' ? 'Switch to Group' : 'Switch to Personal';
  }
  if (dot) {
    dot.className = 'mode-indicator ' + gViewMode;
  }

  // 👤 Ensure Sidebar Updates to reflect current Context (Group vs Personal)
  if (gData && gUser) {
    const un = document.getElementById('userName');
    const av = document.getElementById('userAvatar');
    const name = gData.name || gUser.email;
    if (un) un.textContent = name;
    if (av) av.textContent = (name || 'U').charAt(0).toUpperCase();
  }
}

// ─── Tab System ──────────────────────────────────────────────────────────────
window.switchTab = function (tabId) {
  document.querySelectorAll('.tab-btn').forEach(function (b) {
    b.classList.toggle('active', b.getAttribute('data-tab') === tabId);
  });
  document.querySelectorAll('.tab-pane').forEach(function (p) {
    p.classList.remove('active');
  });
  var pane = document.getElementById('tab-' + tabId);
  if (pane) pane.classList.add('active');

  if (tabId === 'overview')     renderOverview();
  if (tabId === 'all-expenses') renderAllExpenses();
  if (tabId === 'my-expenses')  renderMyExpenses();
  if (tabId === 'profile')      renderProfile();

  // 🧹 Ensure Sidebar Profile Menu closes whenever we switch tabs
  window.toggleProfileMenu(null, true);
};

window.toggleGroupSync = function(checkbox) {
  if (!gUser) return;
  const isEnabled = checkbox.checked;
  window.fbFS.collection('users').doc(gUser.uid).update({
    syncToGroup: isEnabled
  }).then(() => {
    showToast('Group sync ' + (isEnabled ? 'enabled' : 'disabled'), 'info');
  }).catch(e => showToast(e.message, 'error'));
};

function renderProfile() {
  if (!gUser || !gData) return;
  
  setTxt('profName',   gUserDoc.name || 'User');
  setTxt('profEmail',  gUser.email);
  setTxt('profBudget', (gData.symbol || '₹') + fmt(gData.budget || 0));

  const syncToggle = document.getElementById('syncToGroupToggle');
  if (syncToggle) {
    syncToggle.checked = !!gUserDoc.syncToGroup;
  }
  
  const av = document.getElementById('profAvatar');
  if (av) av.textContent = (gUserDoc.name || gUser.email || 'U').charAt(0).toUpperCase();

  const modeBadge = document.getElementById('profMode');
  if (modeBadge) {
    modeBadge.textContent = gViewMode.charAt(0).toUpperCase() + gViewMode.slice(1);
    modeBadge.className = 'page-mode-badge ' + gViewMode;
  }
  
  const switchBtn = document.getElementById('profSwitchBtn');
  if (switchBtn) {
    switchBtn.style.display = (gUserDoc && gUserDoc.groupId) ? 'inline-block' : 'none';
    switchBtn.textContent = gViewMode === 'personal' ? 'Switch to Group' : 'Switch to Personal';
  }

  // 🎯 Ensure Sidebar also reflects current user context
  const name = gUserDoc.name || gUser.email;
  const un = document.getElementById('userName');
  const uav = document.getElementById('userAvatar');
  if (un) un.textContent = name;
  if (uav) uav.textContent = name.charAt(0).toUpperCase();
}

// ─── Delete ──────────────────────────────────────────────────────────────────
window.deleteExpense = function (id) {
  if (!confirm('Delete this expense?')) return;
  window.fbFS.collection('expenses').doc(id).delete()
    .then(function () { showToast('Deleted ✓', ''); })
    .catch(function (e) { showToast(e.message, 'error'); });
};


// (toggleChat moved to ai-features.js)

// ─── Modal: open / close ─────────────────────────────────────────────────────
window.openModal = function (editId) {
  gEditId = editId || null;
  var overlay = document.getElementById('modalOverlay');
  if (!overlay) return;

  // Reset form fields
  ['expTitle', 'expAmount', 'expCat', 'expNote'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.value = '';
  });
  var df = document.getElementById('expDate');
  if (df) df.valueAsDate = new Date();

  if (gEditId) {
    var exp = gExpenses.find(function (e) { return e.id === gEditId; });
    if (exp) {
      document.getElementById('expTitle').value  = exp.title    || '';
      document.getElementById('expAmount').value = exp.amount   || '';
      document.getElementById('expCat').value    = exp.category || '';
      document.getElementById('expNote').value   = exp.note     || '';
      if (df) df.value = exp.date || '';
    }
    setTxt('modalTitle', 'Edit Expense');
    setTxt('saveExpBtn', 'Update Expense');
  } else {
    setTxt('modalTitle', 'Add Expense');
    setTxt('saveExpBtn', 'Save Expense');
  }
  
  // ALWAYS re-enable the button when opening
  var btn = document.getElementById('saveExpBtn');
  if (btn) btn.disabled = false;

  overlay.classList.add('open');
};

window.closeModal = function () {
  var overlay = document.getElementById('modalOverlay');
  if (overlay) overlay.classList.remove('open');
  gEditId = null;
};

// ─── Save Expense ─────────────────────────────────────────────────────────────
window.saveExpense = function () {
  if (!gUser) { showToast('Not signed in', 'error'); return; }

  var title  = (document.getElementById('expTitle').value  || '').trim();
  var amount = parseFloat(document.getElementById('expAmount').value);
  var cat    = document.getElementById('expCat').value;
  var date   = document.getElementById('expDate').value;
  var note   = (document.getElementById('expNote').value   || '').trim();

  if (!title || isNaN(amount) || amount <= 0 || !cat || !date) {
    showToast('Fill in all required fields', 'error');
    return;
  }

  var btn = document.getElementById('saveExpBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  var payload = {
    title:       title,
    amount:      amount,
    category:    cat,
    date:        date,
    note:        note,
    createdBy:   gUser.uid,
    userEmail:   gUser.email || '',
    addedByName: gUserDoc.name || (gUser.email || '').split('@')[0],
    groupId:     (gViewMode === 'group') ? (gData.id || null) : null,
    groupName:   (gViewMode === 'group') ? (gData.name || null) : null,
    createdAt:   firebase.firestore.FieldValue.serverTimestamp()
  };

  var col = window.fbFS.collection('expenses');

  if (gEditId) {
    delete payload.createdAt;
    payload.updatedAt = firebase.firestore.FieldValue.serverTimestamp();
    col.doc(gEditId).update(payload)
      .then(function () { 
        window.closeModal(); 
        showToast('Updated ✓', 'success'); 
        if(window.triggerBurst) window.triggerBurst(); 
      })
      .catch(function (e) {
        showToast(e.message, 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Update Expense'; }
      });
  } else {
    col.add(payload)
      .then(function (ref) {
        window.closeModal();
        showToast('Expense added ✓', 'success');
        if(window.triggerBurst) window.triggerBurst();
        
        // 🔔 Add Activity Notification
        window.fbFS.collection('notifications').add({
          userId: gUser.uid,
          title: 'Expense Added 🧾',
          message: `Recorded ₹${payload.amount} for ${payload.title}.`,
          type: 'expense',
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      })
      .catch(function (e) {
        console.error('Save error:', e);
        showToast(e.message, 'error');
        if (btn) { btn.disabled = false; btn.textContent = 'Save Expense'; }
      });
  }
};

// ─── Auth Entry Point ─────────────────────────────────────────────────────────
// ─── Auth Entry Point (Atomically managed state) ─────────────────────────────
var gGroupListener = null;
var gIsDashboardActive = false;

window.requireAuth(async function (user, data) {
  gUser = user;
  gUserDoc = data;

  // 🛡️ IDEMPOTENCY: Only run heavy initialization ONCE on load.
  if (gIsDashboardActive) {
     const syncFn = window.syncDashboardData; // Reference the existing sync logic
     if (typeof syncFn === 'function') syncFn();
     return;
  }
  gIsDashboardActive = true;

  // Initialize View Mode logic once
  window.gViewMode = localStorage.getItem('viewMode') || 'personal';
  if (window.gViewMode === 'group' && !gUserDoc.groupId) {
    window.gViewMode = 'personal';
    localStorage.setItem('viewMode', 'personal');
  }
  gViewMode = window.gViewMode;

  // Define Sync Function
  const syncDashboardData = () => {
    // 🛡️ DATA INTEGRITY CHECK: 
    // If we are in group mode, we MUST show group data or "Loading", NOT personal data.
    if (gViewMode === 'group') {
      if (gGroupDoc && gGroupDoc.name) {
        gData = { ...gGroupDoc, type: 'group' };
        const gl = document.getElementById('groupNameLabel');
        if (gl) { 
          gl.textContent = '👨‍👩‍👧‍👦 ' + (gData.name || 'Group'); 
          gl.style.display = 'inline-flex'; 
        }
      } else {
        // Still waiting for group data. Show placeholder.
        gData = { name: 'Loading...', type: 'group' };
        const gl = document.getElementById('groupNameLabel');
        if (gl) { 
          gl.textContent = '👨‍👩‍👧‍👦 Loading Group...'; 
          gl.style.display = 'inline-flex'; 
        }
      }
    } else {
      // Personal Mode
      gData = { ...gUserDoc, type: 'personal' };
      const gl = document.getElementById('groupNameLabel');
      if (gl) { gl.style.display = 'none'; gl.textContent = '👨‍👩‍👧‍👦 —'; }
    }

    updateModeUI();
    renderStats();
    
    // Only render full tab content after initial load completes
    if (gDashboardInit) {
      renderOverview();
      renderProfile();
    }
  };

  // 2. Attach Group Listener if required
  if (gUserDoc.groupId) {
    if (!gGroupListener) {
      console.log('[Dashboard] Initializing Group Listener...');
      gGroupListener = window.fbFS.collection('groups').doc(gUserDoc.groupId).onSnapshot(snap => {
        if (snap.exists) {
          gGroupDoc = { ...snap.data(), id: snap.id };
          syncDashboardData(); // Update when group changes
          
          // If this is the FIRST time we get group data and we are in group mode, finish init
          if (!gDashboardInit && gViewMode === 'group') {
             finishDashboardLoading();
          }
        }
      });
    }
  } else {
    // Cleanup if no longer in group
    if (gGroupListener) { gGroupListener(); gGroupListener = null; gGroupDoc = {}; }
  }

  // Centralized Initialization
  const finishDashboardLoading = () => {
    if (gDashboardInit) return;
    gDashboardInit = true;
    
    // Set date string
    var ds = document.getElementById('dateStr');
    if (ds) ds.textContent = new Date().toLocaleDateString('en-IN', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    // Re-bind common static interactions
    document.getElementById('logoutBtn')?.addEventListener('click', function () {
      window.fbAuth.signOut().then(() => window.location.href = 'index.html');
    });

    // UI Click listeners (dropdowns etc)
    window.addEventListener('click', function(e) {
      ['chatbotWrap', 'notifDropdown', 'profileMenu'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.classList.contains('show') && !el.contains(e.target)) {
          // Special exception for triggers
          const triggers = ['.chat-toggle', '.notif-btn', '.profile-trigger'];
          const isTrigger = triggers.some(t => e.target.closest(t));
          if (!isTrigger) el.classList.remove('show');
        }
      });
    });
    
    listenForInvitations(); // 🔔 Start notification sync on login
    loadExpenses(); // Start syncing data records
  };

  // 🎯 Execution Flow
  syncDashboardData();
  
  // If we are in Personal mode, we can finish init immediately
  if (gViewMode === 'personal') {
    finishDashboardLoading();
  } 
  // If we are in Group mode, finishDashboardLoading() will be called by the Group Snapshot listener above
});

// ─── Load Expenses (Atomic Filtered Sync) ───────────────────────────────────
function loadExpenses() {
  if (!gUser) return;
  
  // 🧹 CLEAN UP OLD LISTENER FIRST
  if (gListener) {
    console.log('[loadExpenses] Detaching old listener...');
    gListener();
    gListener = null;
  }

  console.log('[loadExpenses] Attaching listener. Mode =', gViewMode);

  // If in personal mode, filter by createdBy. If in group mode, filter by groupId.
  let query = window.fbFS.collection('expenses');
  if (gViewMode === 'group' && gUserDoc.groupId) {
    query = query.where('groupId', '==', gUserDoc.groupId);
  } else {
    query = query.where('createdBy', '==', gUser.uid);
  }

  // Store the unsubscribe function to gListener
  gListener = query.onSnapshot(
    function (snap) {
      gExpenses   = [];
      gMyExpenses = [];

      snap.forEach(function (doc) {
        var exp = Object.assign({ id: doc.id }, doc.data());

        var isMine   = exp.createdBy === gUser.uid;
        var inGroup  = !!(gData.groupId && exp.groupId && exp.groupId === gData.groupId);

        if (isMine || inGroup) {
          gExpenses.push(exp);
        }
        if (isMine) {
          gMyExpenses.push(exp);
        }
      });

      console.log('[loadExpenses] After filter → gExpenses:', gExpenses.length, ' gMyExpenses:', gMyExpenses.length);

      // Sort newest date first. If dates equal, use createdAt for sub-sort
      var byDate = function (a, b) { 
        var dateCompare = (b.date || '').localeCompare(a.date || '');
        if (dateCompare !== 0) return dateCompare;
        var timeA = a.createdAt?.seconds || 0;
        var timeB = b.createdAt?.seconds || 0;
        return timeB - timeA;
      };
      gExpenses.sort(byDate);
      gMyExpenses.sort(byDate);

      // Always re-render stats and overview
      renderStats();
      renderOverview();

      // Re-render whichever tab is active
      var activeBtn = document.querySelector('.tab-btn.active');
      if (activeBtn) {
        var tid = activeBtn.getAttribute('data-tab');
        if (tid === 'all-expenses') renderAllExpenses();
        if (tid === 'my-expenses')  renderMyExpenses();
      }
    },
    function (err) {
      console.error('[loadExpenses] Snapshot ERROR:', err.code, err.message);
      showToast('Could not load expenses: ' + err.message, 'error');
    }
  );
}

// ─── Render Stats ─────────────────────────────────────────────────────────────
function renderStats() {
  var sym    = gData.symbol || '₹';
  var budget = Number(gData.budget) || 0;
  var total  = gExpenses.reduce(function (s, e) { return s + Number(e.amount || 0); }, 0);
  var left   = budget - total;

  setTxt('sBudget',    sym + fmt(budget));
  setTxt('sSpent',     sym + fmt(total));
  setTxt('sRemaining', sym + fmt(Math.abs(left)));
  setTxt('sCount',     gExpenses.length);

  // 🚨 Exceed Label Logic
  const remValueEl = document.getElementById('sRemaining');
  if (remValueEl) {
    const remLabelEl = remValueEl.previousElementSibling;
    if (left < 0) {
      if (remLabelEl) remLabelEl.textContent = 'Exceeded';
      remValueEl.style.color = 'var(--danger)';
    } else {
      if (remLabelEl) remLabelEl.textContent = 'Remaining';
      remValueEl.style.color = '';
    }
  }

  var pct = budget > 0 ? Math.min((total / budget) * 100, 100) : 0;
  var pf  = document.getElementById('progressFill');
  var pb  = document.getElementById('pctBadge');
  if (pf) {
    pf.style.width = pct.toFixed(1) + '%';
    pf.classList.remove('warn', 'danger');
    if (pct >= 90) pf.classList.add('danger');
    else if (pct >= 75) pf.classList.add('warn');
  }
  if (pb) pb.textContent = Math.round(pct) + '%';

  // 🔔 Local Alert Banner (3s Auto-hide)
  var ab = document.getElementById('alertBanner');
  if (ab) {
    if (pct >= 90) {
      if (!ab.classList.contains('show')) {
        ab.classList.add('show');
        // Clear any existing timeout and set a new one for 3s
        if (window.alertTimer) clearTimeout(window.alertTimer);
        window.alertTimer = setTimeout(function() {
          ab.classList.remove('show');
        }, 3000);
      }
    } else {
      ab.classList.remove('show');
      if (window.alertTimer) clearTimeout(window.alertTimer);
    }
  }

  setTxt('pSpent', sym + fmt(total) + ' spent');
  setTxt('pLeft',  sym + fmt(Math.max(0, left)) + ' left');

  // Check AI Alerts (90% threshold, reports, etc)
  if (typeof window.checkEmailAlerts === 'function') {
    window.checkEmailAlerts();
  }
}

// ─── Render Overview Tab ──────────────────────────────────────────────────────
function renderOverview() {
  var catTotals = {};
  gExpenses.forEach(function (e) {
    var c = e.category || 'Other';
    catTotals[c] = (catTotals[c] || 0) + Number(e.amount || 0);
  });

  renderCatBreakdown(catTotals);
  updateDonutChart(catTotals);
  renderList('overviewExpenseList', gExpenses.slice(0, 5)); // 📉 Limited to 5 for cleaner UI

  var rc = document.getElementById('recentCount');
  if (rc) rc.textContent = gExpenses.length + ' total';
}

// ─── Render All Expenses Tab ──────────────────────────────────────────────────
function renderAllExpenses() {
  if (window.filterList) window.filterList('all');
  else renderList('allExpenseList', gExpenses);
  
  var el = document.getElementById('allExpTotal');
  if (el) el.textContent = (gData.symbol || '₹') + fmt(gExpenses.reduce(function (s, e) { return s + Number(e.amount || 0); }, 0));
}

// ─── Render My Expenses Tab ──────────────────────────────────────────────────
function renderMyExpenses() {
  if (window.filterList) window.filterList('my');
  else renderList('myExpenseList', gMyExpenses);

  var el = document.getElementById('myExpTotal');
  if (el) el.textContent = (gData.symbol || '₹') + fmt(gMyExpenses.reduce(function (s, e) { return s + Number(e.amount || 0); }, 0));
}

// ─── Filter Lists ─────────────────────────────────────────────────────────────
window.filterList = function(type) {
  var searchText = '';
  var catValue = '';
  var listToFilter = [];
  var listContainerId = '';
  
  if (type === 'all') {
    searchText = (document.getElementById('searchAll').value || '').toLowerCase().trim();
    catValue = document.getElementById('catFilterAll').value || '';
    listToFilter = gExpenses;
    listContainerId = 'allExpenseList';
  } else if (type === 'my') {
    searchText = (document.getElementById('searchMy').value || '').toLowerCase().trim();
    catValue = document.getElementById('catFilterMy').value || '';
    listToFilter = gMyExpenses;
    listContainerId = 'myExpenseList';
  } else {
    return;
  }

  var filtered = listToFilter.filter(function(e) {
    if (catValue && e.category !== catValue) return false;
    if (searchText && !(e.title || '').toLowerCase().includes(searchText)) return false;
    return true;
  });

  renderList(listContainerId, filtered);
};

// ─── Core List Renderer ───────────────────────────────────────────────────────
function renderList(containerId, items) {
  var box = document.getElementById(containerId);
  if (!box) { console.warn('[renderList] container not found:', containerId); return; }

  box.innerHTML = '';

  if (!items || items.length === 0) {
    box.innerHTML =
      '<div class="empty-state">' +
        '<div class="empty-icon">🧾</div>' +
        '<p>No expenses yet.<br>Tap <strong>+ Add Expense</strong> to get started.</p>' +
      '</div>';
    return;
  }

  var sym = gData.symbol || '₹';

  items.forEach(function (e) {
    var isSync = !!e.isSync;
    var row = document.createElement('div');
    row.className = 'expense-item' + (isSync ? ' is-synced' : '');
    row.innerHTML =
      '<div class="exp-icon">' + catIcon(e.category) + '</div>' +
      '<div class="exp-info">' +
        '<div class="exp-title">' + 
          esc(e.title) + 
          (isSync ? ' <span class="sync-pill">Synced</span>' : '') + 
        '</div>' +
        '<div class="exp-meta">' +
          esc(e.category || 'Other') + ' &bull; ' + (e.date || '—') +
          (e.addedByName ? ' &bull; ' + esc(e.addedByName) : '') +
          (isSync ? ' &bull; 🔗 Sync' : '') +
        '</div>' +
      '</div>' +
      '<div class="exp-amount">' + sym + fmt(e.amount) + '</div>' +
      '<div class="exp-actions">' +
        '<button class="exp-btn"     onclick="openModal(\'' + e.id + '\')" title="Edit">✏️</button>' +
        '<button class="exp-btn del" onclick="deleteExpense(\'' + e.id + '\')" title="Delete">🗑️</button>' +
      '</div>';
    box.appendChild(row);
  });
}

// ─── Category Breakdown Bars ──────────────────────────────────────────────────
function renderCatBreakdown(totals) {
  var container = document.getElementById('catBreakdown');
  if (!container) return;
  container.innerHTML = '';

  var cats = Object.keys(totals);
  if (!cats.length) return;

  var grandTotal = cats.reduce(function (s, c) { return s + totals[c]; }, 0);
  var palette    = ['#6366f1', '#f87171', '#34d399', '#f0b429', '#a78bfa', '#fb923c'];

  cats.forEach(function (cat, i) {
    var pct   = grandTotal > 0 ? Math.round(totals[cat] / grandTotal * 100) : 0;
    var color = palette[i % palette.length];
    var row   = document.createElement('div');
    row.className = 'cat-bar-item';
    row.innerHTML =
      '<div class="cat-bar-label">' +
        '<span>' + catIcon(cat) + ' ' + cat + '</span>' +
        '<span class="cat-amt">₹' + fmt(totals[cat]) + '</span>' +
      '</div>' +
      '<div class="cat-mini-bg">' +
        '<div class="cat-mini-fill" style="width:' + pct + '%;background:' + color + '"></div>' +
      '</div>';
    container.appendChild(row);
  });
}

// ─── Doughnut Chart ───────────────────────────────────────────────────────────
function updateDonutChart(totals) {
  var ctx = document.getElementById('donutChart');
  if (!ctx || !window.Chart) return;
  if (gChart) { gChart.destroy(); gChart = null; }

  var labels = Object.keys(totals);
  if (!labels.length) return;

  gChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: labels,
      datasets: [{
        data: Object.values(totals),
        backgroundColor: ['#6366f1','#f87171','#34d399','#f0b429','#a78bfa','#fb923c'],
        borderWidth: 0
      }]
    },
    options: { cutout: '70%', plugins: { legend: { display: false } } }
  });
}

// ─── Notifications ────────────────────────────────────────────────────────────
function listenForInvitations() {
  if (typeof window.listenForNotifications === 'function') {
    window.listenForNotifications(gUser.uid);
  }
}

// ─── Respond to Invite ───────────────────────────────────────────────────────
window.respondInvite = function (invId, status, groupId) {
  if (!gUser) return;
  const invRef = window.fbFS.collection('invites').doc(invId);

  invRef.update({ status: status })
    .then(async function () {
      if (status === 'accepted' && groupId) {
        // Update user profile to join group
        await window.fbFS.collection('users').doc(gUser.uid).update({
          groupId: groupId
        });
        showToast('You joined the group! 🎉', 'success');
        setTimeout(() => location.reload(), 1500);
      } else {
        showToast('Invite ' + status, '');
      }
      
      // Close dropdown
      const d = document.getElementById('notifDropdown');
      if (d) d.classList.remove('show');
    })
    .catch(function (e) {
      console.error('Invite error:', e);
      showToast('Error: ' + e.message, 'error');
    });
};

// ─── Tiny helpers ─────────────────────────────────────────────────────────────
function setTxt(id, val) {
  var el = document.getElementById(id);
  if (el) el.textContent = val;
}

function fmt(n) {
  return Number(n || 0).toLocaleString('en-IN');
}

function esc(s) {
  if (!s) return '';
  var d = document.createElement('div');
  d.textContent = String(s);
  return d.innerHTML;
}

function catIcon(cat) {
  var m = { Food:'🍔', Travel:'🚗', Shopping:'🛍', Bills:'💡', Entertainment:'🎬', Health:'❤️', Education:'📚', Other:'📦' };
  return m[cat] || '📦';
}