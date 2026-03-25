var gUser, gData;

// Sync theme toggle checkbox with current theme
function syncThemeToggle() {
  var isLight = document.body.classList.contains('light');
  var toggle  = document.getElementById('themeToggleInput');
  if (toggle) toggle.checked = isLight;
  var btn = document.getElementById('themeBtn');
  if (btn) btn.textContent = isLight ? '🌙' : '☀️';
}

// Called by the toggle switch
window.onThemeToggle = function(checkbox) {
  window.toggleTheme();
};

window.requireAuth(async function(user, data) {
  const viewMode = localStorage.getItem('viewMode') || 'personal';
  gUser = user; 
  // 🎯 Context-Aware Data
  gData = (viewMode === 'group' && data.groupData) ? data.groupData : data;
  
  syncThemeToggle();

  // Populate fields
  document.getElementById('nameInput').value  = data.name || '';
  document.getElementById('emailInput').value = user.email || '';
  document.getElementById('budgetInput').value = gData.budget || '';

  var curKey = (gData.currency||'INR')+'|'+(gData.symbol||'₹');
  var sel = document.getElementById('currencySelect');
  for (var i=0; i<sel.options.length; i++) {
    if (sel.options[i].value === curKey) { sel.selectedIndex = i; break; }
  }

  // Account info
  var memberSince = data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt)).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'}) : '—';
  document.getElementById('memberSince').textContent  = memberSince;
  document.getElementById('currentBudget').textContent = (gData.symbol||'₹') + Number(gData.budget||0).toLocaleString('en-IN');

  const budgetTitle = document.querySelector('.settings-card h3');
  if (budgetTitle && viewMode === 'group') {
     budgetTitle.textContent = '📉 ' + (gData.name || 'Group') + ' Budget';
  }

  // Load expenses for stats
  let query = fbFS.collection('expenses');
  if (viewMode === 'group' && data.groupId) {
    query = query.where('groupId', '==', data.groupId);
  } else {
    query = query.where('createdBy', '==', user.uid);
  }

  query.get().then(function(snap) {
    var total = 0;
    var count = 0;
    snap.forEach(function(doc){ 
      var exp = doc.data();
      // If personal mode, EXCLUDE group expenses
      if (viewMode === 'personal' && exp.groupId) return;
      
      total += Number(exp.amount || 0);
      count++;
    });
    document.getElementById('totalExpenses').textContent = count + ' transactions';
    document.getElementById('totalSpent').textContent    = (gData.symbol||'₹') + total.toLocaleString('en-IN');
  });
});

window.saveName = function() {
  var name = document.getElementById('nameInput').value.trim();
  if (!name) { showToast('Please enter a display name','error'); return; }
  fbFS.collection('users').doc(gUser.uid).update({ name: name }).then(function() {
    gData.name = name;
    var av = document.getElementById('userAvatar');
    var un = document.getElementById('userName');
    if (av) av.textContent = name[0].toUpperCase();
    if (un) un.textContent = name;
    showToast('Profile updated ✓','success');
  }).catch(function(e){ showToast('Error: '+e.message,'error'); });
};

window.saveBudget = function() {
  const viewMode = localStorage.getItem('viewMode') || 'personal';
  var budget = Number(document.getElementById('budgetInput').value);
  if (!budget || budget <= 0) { showToast('Please enter a valid budget','error'); return; }
  var curVal = document.getElementById('currencySelect').value.split('|');
  var currency = curVal[0], symbol = curVal[1];
  
  const updateData = { budget: budget, currency: currency, symbol: symbol };
  
  // Decide which account to update: Personal vs Group
  let p;
  if (viewMode === 'group' && gData.groupId) {
    p = fbFS.collection('groups').doc(gData.groupId).update({ budget: budget });
    showToast('Family Collective Budget updated ✓', 'success');
  } else {
    p = fbFS.collection('users').doc(gUser.uid).update(updateData);
    showToast('Personal Budget updated ✓', 'success');
  }

  p.then(function() {
    gData.budget = budget;
    if (viewMode === 'personal') {
      gData.currency = currency; 
      gData.symbol = symbol;
    }
    document.getElementById('currentBudget').textContent = (gData.symbol || symbol) + budget.toLocaleString('en-IN');
    
    // 🔥 Sync with dashboard state immediately if we were on the same tab
    if (window.gUserDoc) {
      window.gUserDoc.budget = budget;
      if (viewMode === 'personal') {
         window.gUserDoc.currency = currency;
         window.gUserDoc.symbol = symbol;
      }
    }
  }).catch(function(e){ showToast('Error: '+e.message,'error'); });
};

window.clearExpenses = function() {
  if (!confirm('Are you sure? This will permanently delete ALL your expense records and cannot be undone.')) return;
  
  let query = fbFS.collection('expenses');
  if (gData.groupId) {
    query = query.where('groupId', '==', gData.groupId);
  } else {
    query = query.where('createdBy', '==', gUser.uid);
  }

  query.get().then(function(snap) {
    const batch = fbFS.batch();
    snap.forEach(doc => batch.delete(doc.ref));
    return batch.commit();
  }).then(function() {
    document.getElementById('totalExpenses').textContent = '0 transactions';
    document.getElementById('totalSpent').textContent    = (gData.symbol||'₹') + '0';
    showToast('All expenses cleared','success');
  }).catch(function(e){ showToast('Error: '+e.message,'error'); });
};

window.deleteAccount = function() {
  var confirm1 = confirm('This will permanently delete your account and all data. This CANNOT be undone. Continue?');
  if (!confirm1) return;
  var confirm2 = prompt('Type DELETE to confirm:');
  if (confirm2 !== 'DELETE') { showToast('Account deletion cancelled',''); return; }
  
  fbFS.collection('users').doc(gUser.uid).delete().then(function() {
    return gUser.delete();
  }).then(function() {
    window.location.href = 'index.html';
  }).catch(function(e) {
    if (e.code === 'auth/requires-recent-login') {
      showToast('Please sign out and sign in again before deleting','error');
    } else {
      showToast('Error: '+e.message,'error');
    }
  });
};