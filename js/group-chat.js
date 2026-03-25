// js/group-chat.js — Advanced Real-time Group Chat & AI Summary
var socket;
var gChatInit = false;

window.initGroupChat = function() {
  if (gChatInit) return;
  gChatInit = true;

  console.log('[Chat] Initializing Advanced Group Chat...');

  console.log('[Chat] Attempting connection...');

  // 🔌 Connect
  // If we are served from another host (like Live Server 5500), we point to 3002
  const serverUrl = window.location.port !== '3002' ? 'http://localhost:3002' : undefined;
  socket = io(serverUrl);

  const gid = (window.gUserDoc && window.gUserDoc.groupId) || null;
  if (!gid) return;

  // 🚪 Join Room
  socket.emit('join_group', gid);
  
  if (gGroupDoc && gGroupDoc.name) {
    const el = document.getElementById('chatGroupName');
    if (el) el.textContent = gGroupDoc.name + ' Message Board';
  }

  // 📥 Listen
  socket.on('receive_message', function(msg) {
    appendMessage(msg);
  });

  // 👥 Update online counter
  socket.on('update_member_count', function(count) {
    const el = document.getElementById('chatMemberCount');
    if (el) el.textContent = `${count} family members online`;
  });

  // ⌨️ Typing Indicator
  socket.on('user_typing_start', function(sid) {
    const el = document.getElementById('typingIndicator');
    if (el) {
       el.style.opacity = 1;
       el.textContent = 'Someone is typing...';
    }
  });

  socket.on('user_typing_stop', function() {
    const el = document.getElementById('typingIndicator');
    if (el) el.style.opacity = 0;
  });

  // 📜 Load History
  loadChatHistory(gid);

  // 😀 Emoji Picker Init
  document.querySelectorAll('#emojiPicker span').forEach(s => {
    s.onclick = () => {
      const input = document.getElementById('groupChatInput');
      input.value += s.textContent;
      input.focus();
      document.getElementById('emojiPicker').classList.remove('show');
    };
  });
};

window.toggleEmojiPicker = function() {
  const el = document.getElementById('emojiPicker');
  if (el) el.classList.toggle('show');
};

function loadChatHistory(gid) {
  const box = document.getElementById('groupMessages');
  if (!box) return;

  window.fbFS.collection('groups').doc(gid).collection('chat')
    .orderBy('serverTimestamp', 'desc').limit(40).get()
    .then(snap => {
      const msgs = [];
      snap.forEach(doc => msgs.push(doc.data()));
      msgs.reverse().forEach(m => appendMessage(m, true));
      box.scrollTop = box.scrollHeight;
    });
}

window.sendGroupMessage = function() {
  const input = document.getElementById('groupChatInput');
  const text = input.value.trim();
  if (!text) return;
  if (!socket) { console.warn('[Chat] Socket not connected.'); return; }

  // 🛡️ Enhanced Safety Check
  const gid = (window.gUserDoc && window.gUserDoc.groupId) || null;
  const uid = (window.fbAuth && window.fbAuth.currentUser) ? window.fbAuth.currentUser.uid : null;
  const uname = (window.gUserDoc && window.gUserDoc.name) || (window.fbAuth && window.fbAuth.currentUser && window.fbAuth.currentUser.email) || 'Member';

  if (!gid || !uid) {
    console.error('[Chat] Missing GID or UID. Cannot send.');
    return;
  }

  const payload = {
    groupId: gid,
    senderId: uid,
    senderName: uname,
    text: text,
    type: 'text',
    createdAt: new Date().toISOString()
  };

  console.log('[Chat] Sending:', text);
  socket.emit('send_message', payload);
  input.value = '';
  socket.emit('typing_stop', gid);
};

window.sendChatImage = async function(file) {
  if (!file || !socket) return;
  try {
     const base64 = await window.compressImage(file, 500, 500, 0.4);
     const gid = gUserDoc.groupId;
     const payload = {
       groupId: gid,
       senderId: window.fbAuth.currentUser.uid,
       senderName: gUserDoc.name || window.fbAuth.currentUser.email,
       image: base64,
       type: 'image',
       createdAt: new Date().toISOString()
     };
     socket.emit('send_message', payload);
  } catch(e) { console.error('Image attach failed', e); }
};

// 🤖 AI RECAP FUNCTIONALITY
window.summarizeGroupChat = async function() {
  const btn = event.target.closest('button');
  if (btn) btn.disabled = true;
  
  // 1. Gather recent messages
  const items = Array.from(document.querySelectorAll('.chat-msg:not(.system)'));
  const conversation = items.map(el => {
     const name = el.querySelector('.msg-header')?.textContent || 'Member';
     const text = el.querySelector('.msg-text')?.textContent || '';
     return `${name}: ${text}`;
  }).filter(t => t.includes(': ')).slice(-20).join('\n');

  if (!conversation) {
     showToast('Not enough messages to summarize!', 'info');
     if (btn) btn.disabled = false;
     return;
  }

  appendMessage({ type: 'system', text: '🤖 Generating family recap...', id: 'ai-temp' });

  try {
     const prompt = `Following is a conversation snippet from a family group. Summarize the key discussion points or items mentioned in 2-3 short, friendly bullet points. 
     Conversation:\n${conversation}`;
     
     const reply = await callAIChat([{ role: 'user', content: prompt }]);
     
     // Remove temp
     const temp = document.getElementById('msg-ai-temp');
     if (temp) temp.remove();

     appendMessage({ 
       type: 'system', 
       text: `<b>📝 AI Recap:</b><br>${reply.replace(/\n/g, '<br>')}`, 
       id: 'ai-recap-' + Date.now() 
     });
  } catch (err) {
     console.error('Summary error', err);
     showToast('AI Summarization failed.', 'danger');
  } finally {
     if (btn) btn.disabled = false;
  }
};

function appendMessage(msg, isHistory) {
  const box = document.getElementById('groupMessages');
  if (!box) return;

  const welcome = box.querySelector('.chat-welcome');
  if (welcome) welcome.remove();

  const isMine = (msg.senderId === window.fbAuth.currentUser.uid);
  const isSystem = msg.type === 'system';
  
  if (!isHistory && msg.id && document.getElementById('msg-' + msg.id)) return;

  const div = document.createElement('div');
  if (msg.id) div.id = 'msg-' + msg.id;
  div.className = isSystem ? 'chat-msg system' : ('chat-msg ' + (isMine ? 'mine' : 'other'));

  if (isSystem) {
    div.innerHTML = `<p>${msg.text}</p>`;
  } else {
    const initial = (msg.senderName || 'U').charAt(0).toUpperCase();
    const avatarHtml = isMine ? '' : `<div class="msg-avatar">${initial}</div>`;
    
    // Time logic
    const dateObj = msg.serverTimestamp ? (msg.serverTimestamp.toDate ? msg.serverTimestamp.toDate() : new Date(msg.createdAt)) : new Date(msg.createdAt);
    const time = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let contentHtml = '';
    if (msg.type === 'image') {
       contentHtml = `<img src="data:image/jpeg;base64,${msg.image}" style="max-width:200px; border-radius:10px; margin-top:5px; border:1px solid var(--border)">`;
    } else {
       contentHtml = `<div class="msg-text">${msg.text}</div>`;
    }

    div.innerHTML = `
      ${avatarHtml}
      <div class="msg-content" style="max-width: 100%">
        <div class="msg-header">${isMine ? 'You' : msg.senderName}</div>
        ${contentHtml}
        <span class="msg-time">${time}</span>
      </div>
    `;
  }

  box.appendChild(div);
  
  if (!isHistory) {
     box.scrollTop = box.scrollHeight;
  }
}

// Typing indicators
let typingTimer;
document.addEventListener('input', e => {
  if (e.target.id === 'groupChatInput' && socket) {
    socket.emit('typing_start', gUserDoc.groupId);
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => { socket.emit('typing_stop', gUserDoc.groupId); }, 1500);
  }
});
