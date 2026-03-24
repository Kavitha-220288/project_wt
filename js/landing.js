let currentMode = 'login';
const authModal = document.getElementById('authModal');
const toastEl = document.getElementById('toast');

// Ensure Firebase is ready
const getFS = () => window.fbFS;
const getAuth = () => window.fbAuth;

function showInsights() {
  const insights = document.getElementById('websiteInsights');
  insights.style.display = 'block';
  window.scrollTo({
    top: insights.offsetTop - 100,
    behavior: 'smooth'
  });
}

// Scroll revealing
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) entry.target.classList.add('visible');
  });
}, { threshold: 0.1 });

document.querySelectorAll('section').forEach(s => observer.observe(s));

window.onscroll = () => {
  const nav = document.getElementById('navbar');
  if (window.scrollY > 50) nav.classList.add('scrolled');
  else nav.classList.remove('scrolled');
};

// Theme Logic
function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
  const targetTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', targetTheme);
  localStorage.setItem('wt', targetTheme);
  updateThemeIcon(targetTheme);
}

function updateThemeIcon(theme) {
  const icon = document.getElementById('themeIcon');
  if (!icon) return;
  if (theme === 'light') {
    icon.innerHTML = '<path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.364l-.707-.707M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"></path>';
  } else {
    icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
  }
}

// Initial Theme Set
const savedTheme = localStorage.getItem('wt') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
updateThemeIcon(savedTheme);

function openAuth(mode) {
  currentMode = mode;
  updateAuthUI();
  authModal.classList.add('open');
}

function closeAuth() { authModal.classList.remove('open'); }

function toggleAuth(e) {
  e.preventDefault();
  currentMode = (currentMode === 'login' ? 'signup' : 'login');
  updateAuthUI();
}

function updateAuthUI() {
  const title = document.getElementById('modalTitle');
  const btn = document.getElementById('authBtn');
  const sw = document.getElementById('authSwitch');

  if (currentMode === 'login') {
    title.innerText = 'Welcome Back';
    btn.innerText = 'Log In';
    sw.innerHTML = 'New to FinBuddy? <a href="#" onclick="toggleAuth(event)" style="color: var(--accent); text-decoration: none; font-weight: 700;">Create Account</a>';
  } else {
    title.innerText = 'Create Account';
    btn.innerText = 'Sign Up Free';
    sw.innerHTML = 'Already have an account? <a href="#" onclick="toggleAuth(event)" style="color: var(--accent); text-decoration: none; font-weight: 700;">Log In</a>';
  }
}

function showToast(msg) {
  if (!toastEl) return;
  toastEl.innerText = msg;
  toastEl.style.transform = 'translateX(-50%) translateY(0)';
  setTimeout(() => toastEl.style.transform = 'translateX(-50%) translateY(100px)', 3000);
}

// Auth Actions
document.getElementById('authBtn').onclick = function () {
  const email = document.getElementById('authEmail').value.trim();
  const pass = document.getElementById('authPass').value;
  if (!email || !pass) { showToast('Please fill all fields'); return; }

  const btn = this;
  btn.disabled = true; btn.innerText = 'Processing...';

  if (currentMode === 'login') {
    window.fbAuth.signInWithEmailAndPassword(email, pass).then(res => {
      showToast('Success! 👋');
      checkUserAndRedirect(res.user);
    }).catch(err => {
      btn.disabled = false; btn.innerText = 'Log In';
      showToast(err.message);
    });
  } else {
    window.fbAuth.createUserWithEmailAndPassword(email, pass).then(res => {
      window.fbFS.collection('users').doc(res.user.uid).set({
        email: res.user.email,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      }).then(() => {
        showToast('Welcome to FinBuddy! 🎉');
        window.location.href = 'setup.html';
      });
    }).catch(err => {
      btn.disabled = false; btn.innerText = 'Sign Up Free';
      showToast(err.message);
    });
  }
};

// Google Sign-In
document.getElementById('googleBtn').onclick = function () {
  const auth = window.fbAuth || (window.firebase && firebase.auth());
  const fs = window.fbFS || (window.firebase && firebase.firestore());

  if (!auth) {
    showToast('Authentication system initializing...');
    return;
  }

  const provider = new firebase.auth.GoogleAuthProvider();
  auth.signInWithPopup(provider).then(result => {
    const user = result.user;

    if (!fs) {
      showToast('Database connection failed');
      return;
    }

    fs.collection('users').doc(user.uid).get().then(doc => {
      if (!doc.exists) {
        fs.collection('users').doc(user.uid).set({
          email: user.email,
          name: user.displayName,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
          window.location.href = 'setup.html';
        });
      } else {
        checkUserAndRedirect(user);
      }
    });
  }).catch(err => {
    console.error("Google Auth Error:", err);
    showToast(err.message);
  });
};

function checkUserAndRedirect(user) {
  if (!user) return;
  const fs = window.fbFS || (window.firebase && firebase.firestore());
  if (!fs) {
    setTimeout(() => checkUserAndRedirect(user), 200);
    return;
  }

  fs.collection('users').doc(user.uid).get().then(doc => {
    if (doc.exists) {
      const data = doc.data();
      if (data.budget || data.groupId) {
        window.location.href = 'dashboard.html';
      } else {
        window.location.href = 'setup.html';
      }
    } else {
      window.location.href = 'setup.html';
    }
  }).catch(err => {
    console.error("Redirect Error:", err);
    showToast("Error checking user status");
  });
}

window.fbAuth.onAuthStateChanged(user => { if (user) checkUserAndRedirect(user); });
