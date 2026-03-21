// js/settings.js
var gUser, gData;

window.initTheme();

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

window.requireAuth(function(user, data) {
  gUser = user; gData = data;
  syncThemeToggle();

  // Populate fields
  document.getElementById('nameInput').value  = data.name || '';
  document.getElementById('emailInput').value = user.email || '';
  document.getElementById('budgetInput').value = data.budget || '';

  var curKey = (data.currency||'INR')+'|'+(data.symbol||'₹');
  var sel = document.getElementById('currencySelect');
  for (var i=0; i<sel.options.length; i++) {
    if (sel.options[i].value === curKey) { sel.selectedIndex = i; break; }
  }

  // Account info
  var memberSince = data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt)).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'}) : '—';
  document.getElementById('memberSince').textContent  = memberSince;
  document.getElementById('currentBudget').textContent = (data.symbol||'₹') + Number(data.budget||0).toLocaleString('en-IN');

  // Load expenses for stats
  const path = data.groupId ? 'groups/' + data.groupId + '/expenses' : 'users/' + user.uid + '/expenses';
  fbFS.collection(path).get().then(function(snap) {
    var exps = [];
    snap.forEach(function(doc){ exps.push(doc.data()); });
    var total = exps.reduce(function(s,e){return s+Number(e.amount);},0);
    document.getElementById('totalExpenses').textContent = exps.length + ' transactions';
    document.getElementById('totalSpent').textContent    = (data.symbol||'₹') + total.toLocaleString('en-IN');
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
  var budget = Number(document.getElementById('budgetInput').value);
  if (!budget || budget <= 0) { showToast('Please enter a valid budget','error'); return; }
  var curVal = document.getElementById('currencySelect').value.split('|');
  var currency = curVal[0], symbol = curVal[1];
  
  const updateData = { budget: budget, currency: currency, symbol: symbol };
  
  // If in a group, update group budget too
  const p1 = fbFS.collection('users').doc(gUser.uid).update(updateData);
  const p2 = gData.groupId ? fbFS.collection('groups').doc(gData.groupId).update({ budget: budget }) : Promise.resolve();

  Promise.all([p1, p2]).then(function() {
    gData.budget = budget; gData.currency = currency; gData.symbol = symbol;
    document.getElementById('currentBudget').textContent = symbol + budget.toLocaleString('en-IN');
    showToast('Budget updated ✓','success');
  }).catch(function(e){ showToast('Error: '+e.message,'error'); });
};

window.clearExpenses = function() {
  if (!confirm('Are you sure? This will permanently delete ALL your expense records and cannot be undone.')) return;
  const path = gData.groupId ? 'groups/' + gData.groupId + '/expenses' : 'users/' + gUser.uid + '/expenses';
  
  fbFS.collection(path).get().then(function(snap) {
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