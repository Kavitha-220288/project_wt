// js/groups.js

// ── Create Group ──────────────────────────────────────────────────────────────
window.createGroup = function (name, budget) {
  if (!name || !name.trim()) {
    if (window.showToast) window.showToast('Please enter a group name', 'error');
    return;
  }

  if (!budget || Number(budget) <= 0) {
    if (window.showToast) window.showToast('Please enter a valid budget', 'error');
    return;
  }

  var user = window.fbAuth.currentUser;
  if (!user) return;

  var groupRef = window.fbFS.collection('groups').doc();
  var batch = window.fbFS.batch();

  batch.set(groupRef, {
    name: name.trim(),
    budget: Number(budget),
    currency: 'INR',
    symbol: '₹',
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    createdBy: user.uid
  });

  batch.set(groupRef.collection('members').doc(user.uid), {
    role: 'admin',
    joinedAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  return batch.commit().then(function () {
    return window.fbFS.collection('users').doc(user.uid).set({
      groupId: groupRef.id,
      groupName: name.trim(),
      role: 'admin'
    }, { merge: true });
  }).then(function () {
    if (window.showToast) window.showToast('Group created! 🎉', 'success');
    setTimeout(function () { window.location.href = 'dashboard.html'; }, 800);
  }).catch(function (err) {
    console.error('createGroup Error:', err);
    if (window.showToast) window.showToast('Error: ' + err.message, 'error');
  });
};

// ── Invite Member ───────────────────────────────────────────────────────────
window.inviteMember = function (identifier) {
  if (!identifier || !identifier.trim()) {
    if (window.showToast) window.showToast('Please enter an email or UID.', 'error');
    return;
  }

  var user = window.fbAuth.currentUser;
  if (!user) return;

  var idStr = identifier.trim().toLowerCase();
  var isEmail = idStr.includes('@');

  return window.fbFS.collection('users').doc(user.uid).get().then(function (doc) {
    var userData = doc.data();
    var groupId = userData.groupId;

    if (!groupId) {
      if (window.showToast) window.showToast('You must be in a group to invite members.', 'error');
      return;
    }

    var userLookup;
    if (isEmail) {
      userLookup = window.fbFS.collection('users').where('email', '==', idStr).get().then(function (snap) {
        if (snap.empty) throw new Error('User not found.');
        return snap.docs[0];
      });
    } else {
      userLookup = window.fbFS.collection('users').doc(identifier.trim()).get().then(function (uDoc) {
        if (!uDoc.exists) throw new Error('User UID not found.');
        return uDoc;
      });
    }

    return userLookup.then(function (targetUser) {
      var targetUid = targetUser.id;
      if (targetUid === user.uid) throw new Error('You cannot invite yourself.');

      var inviteId = targetUid + '_' + groupId;
      var inviteRef = window.fbFS.collection('invites').doc(inviteId);

      return inviteRef.get().then(function (existing) {
        if (existing.exists && existing.data().status === 'pending') {
          throw new Error('Invite already sent.');
        }

        return window.fbFS.collection('groups').doc(groupId).collection('members').doc(targetUid).get().then(function (mDoc) {
          if (mDoc.exists) throw new Error('User already in group.');

          return inviteRef.set({
            fromUid: user.uid,
            toUid: targetUid,
            groupId: groupId,
            status: 'pending',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            respondedAt: null
          });
        });
      });
    });
  }).then(function () {
    if (window.showToast) window.showToast('Invitation sent! 🎉', 'success');
    var input = document.getElementById('inviteEmail');
    if (input) input.value = '';
  }).catch(function (err) {
    console.error('Invite Error:', err);
    if (window.showToast) window.showToast(err.message, 'error');
  });
};

// ── Accept Invite ─────────────────────────────────────────────────────────────
window.acceptInvite = function (inviteId) {
  var user = window.fbAuth.currentUser;
  if (!user) return;

  if (window.showToast) window.showToast('Joining group…', '');

  var inviteRef = window.fbFS.collection('invites').doc(inviteId);

  return window.fbFS.runTransaction(function (tx) {
    return tx.get(inviteRef).then(function (inviteDoc) {
      if (!inviteDoc.exists) throw new Error('Invite not found.');
      var invite = inviteDoc.data();
      if (invite.toUid !== user.uid) throw new Error('Not your invite.');
      if (invite.status !== 'pending') throw new Error('Invite already handled.');

      var groupId = invite.groupId;
      var memberRef = window.fbFS.collection('groups').doc(groupId).collection('members').doc(user.uid);

      tx.set(memberRef, {
        role: 'member',
        joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
        invitedBy: invite.fromUid
      });

      tx.update(inviteRef, {
        status: 'accepted',
        respondedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      return groupId;
    });
  }).then(function (groupId) {
    return window.fbFS.collection('groups').doc(groupId).get().then(function (groupDoc) {
      var groupName = groupDoc.exists ? (groupDoc.data().name || 'Family Group') : 'Family Group';
      return window.fbFS.collection('users').doc(user.uid).set({
        groupId: groupId,
        groupName: groupName,
        role: 'member'
      }, { merge: true });
    });
  }).then(function () {
    if (window.showToast) window.showToast('Welcome to the group! 🚀', 'success');
    setTimeout(function () { window.location.href = 'dashboard.html'; }, 900);
  }).catch(function (err) {
    console.error('Accept invite error:', err);
    if (window.showToast) window.showToast('Error joining group: ' + err.message, 'error');
  });
};

// ── Decline Invite ────────────────────────────────────────────────────────────
window.declineInvite = function (inviteId) {
  return window.fbFS.collection('invites').doc(inviteId).update({
    status: 'declined',
    respondedAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(function () {
    if (window.showToast) window.showToast('Invitation declined.', '');
  });
};

// ── Cancel Invite (owner) ─────────────────────────────────────────────────────
window.cancelInvite = function (inviteId) {
  return window.fbFS.collection('invites').doc(inviteId).delete().then(function () {
    if (window.showToast) window.showToast('Invitation cancelled.', '');
  });
};

// ── Load Invites (received by current user) ───────────────────────────────────
window.loadInvites = function () {
  var user = window.fbAuth.currentUser;
  if (!user) return;

  window.fbFS.collection('invites')
    .where('toUid', '==', user.uid)
    .where('status', '==', 'pending')
    .onSnapshot(function (snap) {
      var card = document.getElementById('invitationsCard');
      if (card) card.style.display = snap.empty ? 'none' : 'block';

      var el = document.getElementById('inviteList');
      if (!el) return;
      el.innerHTML = '';

      if (snap.empty) {
        el.innerHTML = '<p style="color:var(--muted);font-size:.9rem">No pending invitations.</p>';
        return;
      }

      snap.forEach(function (doc) {
        var inv = doc.data();
        var div = document.createElement('div');
        div.className = 'invitation-item';
        var fromLabel = inv.fromUid || '—';
        var groupLabel = inv.groupId || '—';

        div.innerHTML =
          '<div class="inv-info">' +
          '<div style="font-size:.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;font-weight:700">Invited By</div>' +
          '<strong class="inv-from" style="font-size:1rem;color:var(--text)">' + fromLabel + '</strong>' +
          '<div style="font-size:.8rem;color:var(--accent);margin-top:3px">Group: <strong class="inv-group">' + groupLabel + '</strong></div>' +
          '</div>' +
          '<div style="display:flex;gap:10px;align-items:center">' +
          '<button class="btn-sm btn-accept" onclick="acceptInvite(\'' + doc.id + '\')">✓ Join Group</button>' +
          '<button class="btn-sm btn-decline" onclick="declineInvite(\'' + doc.id + '\')">✕ Decline</button>' +
          '</div>';
        el.appendChild(div);

        if (inv.fromUid) {
          window.fbFS.collection('users').doc(inv.fromUid).get().then(function (uDoc) {
            if (!uDoc.exists) return;
            var u = uDoc.data() || {};
            var label = u.name || u.displayName || u.email || inv.fromUid;
            var fromEl = div.querySelector('.inv-from');
            if (fromEl) fromEl.textContent = label;
          });
        }

        if (inv.groupId) {
          window.fbFS.collection('groups').doc(inv.groupId).get().then(function (gDoc) {
            if (!gDoc.exists) return;
            var g = gDoc.data() || {};
            var label = g.name || inv.groupId;
            var gEl = div.querySelector('.inv-group');
            if (gEl) gEl.textContent = label;
          });
        }
      });
    }, function (err) {
      console.error('loadInvites error:', err);
    });
};

// ── Load Notification Badge (for topbar bell) ─────────────────────────────────
// Removed: Duplicate of version in common.js to prevent overwriting correctly unified behavior.


// ── Load Group Members ────────────────────────────────────────────────────────
window.loadGroupMembers = function (groupId, currentUserId) {
  if (!groupId) return;
  var mList = document.getElementById('memberList');
  if (!mList) return;

  var groupRef = window.fbFS.collection('groups').doc(groupId);

  groupRef.onSnapshot(function (groupSnap) {
    var group = groupSnap.data();
    if (!group) return;
    var nameEl = document.getElementById('currentGroupName');
    if (nameEl) nameEl.textContent = group.name || 'Your Group';
  });

  groupRef.collection('members').onSnapshot(function (membersSnap) {
    var myMemberDoc = membersSnap.docs.find(function (d) { return d.id === currentUserId; });
    var myRole = (myMemberDoc && myMemberDoc.data()) ? myMemberDoc.data().role : null;
    var isAdmin = myRole === 'admin';

    var inviteSection = document.getElementById('inviteSection');
    if (inviteSection) inviteSection.style.display = isAdmin ? 'block' : 'none';

    var btnEditGroupName = document.getElementById('btnEditGroupName');
    if (btnEditGroupName) btnEditGroupName.style.display = isAdmin ? 'inline-block' : 'none';

    var btnLeaveGroup = document.getElementById('btnLeaveGroup');
    if (btnLeaveGroup) btnLeaveGroup.style.display = !isAdmin ? 'inline-block' : 'none';

    var btnDeleteGroup = document.getElementById('btnDeleteGroup');
    if (btnDeleteGroup) btnDeleteGroup.style.display = isAdmin ? 'inline-block' : 'none';

    var countBadge = document.getElementById('memberCountText');
    if (countBadge) countBadge.textContent = membersSnap.size + ' Members';

    mList.innerHTML = '';
    membersSnap.forEach(function (mDoc) {
      var uid = mDoc.id;
      var role = (mDoc.data() && mDoc.data().role) ? mDoc.data().role : 'member';
      var label = role === 'admin' ? 'Owner' : 'Member';
      var canRemove = isAdmin && uid !== currentUserId && role !== 'admin';

      window.fbFS.collection('users').doc(uid).get().then(function (uDoc) {
        var uData = uDoc.exists ? uDoc.data() : {};
        var email = uData.email || uid;
        var display = uData.name || uData.displayName || uData.email || uid;
        renderMemberRow(mList, email, display, label, 'joined', null, false, uid, canRemove);
      });
    });

    if (isAdmin) {
      window.fbFS.collection('invites')
        .where('groupId', '==', groupId)
        .where('fromUid', '==', currentUserId)
        .where('status', '==', 'pending')
        .onSnapshot(function (inviteSnap) {
          mList.querySelectorAll('.pending-invite-card').forEach(function (el) { el.remove(); });
          inviteSnap.forEach(function (invDoc) {
            var inv = invDoc.data() || {};
            var toUid = inv.toUid || '—';
            window.fbFS.collection('users').doc(toUid).get().then(function (uDoc) {
              var uData = uDoc.exists ? uDoc.data() : {};
              var email = uData.email || toUid;
              renderMemberRow(mList, email, email, 'Invited', 'pending', invDoc.id, true, toUid, false);
            });
          });
        });
    }
  }, function (err) {
    console.error('loadGroupMembers error:', err);
  });
};

function renderMemberRow(container, email, displayName, role, status, inviteId, canCancel, memberUid, canRemove) {
  var div = document.createElement('div');
  div.className = 'member-card' + (status === 'pending' ? ' pending-invite-card' : '');
  var initials = (displayName || email || '?').substring(0, 2).toUpperCase();
  var statusHtml = '';
  if (status === 'joined') {
    statusHtml = '<span class="status-badge joined">✓ Joined</span>';
    if (canRemove && memberUid) {
      statusHtml += '<button class="btn-cancel" style="margin-left:8px;display:inline-flex" onclick="removeMember(\'' + memberUid + '\')" title="Remove Member">🗑️</button>';
    }
  } else {
    statusHtml =
      '<div style="display:flex;align-items:center;gap:8px">' +
      '<span class="status-badge pending">Pending</span>' +
      (canCancel ? '<button class="btn-cancel" onclick="cancelInvite(\'' + inviteId + '\')" title="Cancel invite">×</button>' : '') +
      '</div>';
  }

  div.innerHTML =
    '<div class="member-info">' +
    '<div class="member-avatar">' + initials + '</div>' +
    '<div class="member-details">' +
    '<div class="member-email" title="' + email + '">' + (displayName || email) + '</div>' +
    '<div class="member-role' + (role.toLowerCase() === 'owner' ? ' owner' : '') + '">' + role + '</div>' +
    '</div>' +
    '</div>' +
    '<div style="display:flex;align-items:center;">' + statusHtml + '</div>';
  container.appendChild(div);
}

// ── Edit Group Name ──────────────────────────────────────────────────────────
window.editGroupName = function () {
  var user = window.fbAuth.currentUser;
  if (!user) return;
  window.fbFS.collection('users').doc(user.uid).get().then(function (doc) {
    var groupId = doc.data().groupId;
    var currentName = document.getElementById('currentGroupName').innerText;
    var newName = prompt('Enter new group name:', currentName);
    if (!newName || !newName.trim() || newName === currentName) return;
    return window.fbFS.collection('groups').doc(groupId).update({
      name: newName.trim()
    }).then(function () {
      return window.fbFS.collection('users').where('groupId', '==', groupId).get().then(function (snap) {
        var batch = window.fbFS.batch();
        snap.forEach(function (uDoc) {
          batch.update(window.fbFS.collection('users').doc(uDoc.id), { groupName: newName.trim() });
        });
        return batch.commit();
      });
    }).then(function () {
      if (window.showToast) window.showToast('Group name updated!', 'success');
    });
  }).catch(function (err) {
    console.error(err);
    if (window.showToast) window.showToast(err.message, 'error');
  });
};

// ── Remove Member ────────────────────────────────────────────────────────────
window.removeMember = function (memberUid) {
  if (!confirm('Are you sure you want to remove this member?')) return;
  var user = window.fbAuth.currentUser;
  if (!user) return;
  window.fbFS.collection('users').doc(user.uid).get().then(function (doc) {
    var groupId = doc.data().groupId;
    var batch = window.fbFS.batch();
    batch.delete(window.fbFS.collection('groups').doc(groupId).collection('members').doc(memberUid));
    batch.update(window.fbFS.collection('users').doc(memberUid), {
      groupId: null, groupName: null, role: null
    });
    return batch.commit();
  }).then(function () {
    if (window.showToast) window.showToast('Member removed', 'success');
  }).catch(function (err) {
    console.error(err);
    if (window.showToast) window.showToast(err.message, 'error');
  });
};

// ── Leave Group ──────────────────────────────────────────────────────────────
window.leaveGroup = function () {
  if (!confirm('Are you sure you want to leave this group?')) return;
  var user = window.fbAuth.currentUser;
  if (!user) return;
  window.fbFS.collection('users').doc(user.uid).get().then(function (doc) {
    var groupId = doc.data().groupId;
    var batch = window.fbFS.batch();
    batch.delete(window.fbFS.collection('groups').doc(groupId).collection('members').doc(user.uid));
    batch.update(window.fbFS.collection('users').doc(user.uid), {
      groupId: null, groupName: null, role: null
    });
    return batch.commit();
  }).then(function () {
    if (window.showToast) window.showToast('You left the group.', 'success');
    setTimeout(function() { window.location.reload(); }, 800);
  }).catch(function (err) {
    console.error(err);
    if (window.showToast) window.showToast(err.message, 'error');
  });
};

// ── Delete Group ─────────────────────────────────────────────────────────────
window.deleteGroup = function () {
  if (!confirm('Are you sure you want to delete the ENTIRE group? This cannot be undone.')) return;
  var user = window.fbAuth.currentUser;
  if (!user) return;
  
  window.fbFS.collection('users').doc(user.uid).get().then(function (doc) {
    var groupId = doc.data().groupId;
    return window.fbFS.collection('groups').doc(groupId).collection('members').get().then(function (snap) {
      if (snap.size > 1) {
        throw new Error('Please remove all other members before deleting the group.');
      }
      var batch = window.fbFS.batch();
      batch.delete(window.fbFS.collection('groups').doc(groupId).collection('members').doc(user.uid));
      batch.update(window.fbFS.collection('users').doc(user.uid), {
        groupId: null, groupName: null, role: null
      });
      batch.delete(window.fbFS.collection('groups').doc(groupId));
      return batch.commit();
    });
  }).then(function () {
    if (window.showToast) window.showToast('Group deleted.', 'success');
    setTimeout(function() { window.location.reload(); }, 800);
  }).catch(function (err) {
    console.error(err);
    if (window.showToast) window.showToast(err.message, 'error');
  });
};