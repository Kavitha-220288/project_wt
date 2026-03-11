# 💳 Walletly — Expense Tracker

A personal finance tracker built with vanilla HTML/CSS/JS and Firebase. No frameworks, no build tools.

---

## Tech Stack

- **Frontend** — HTML, CSS, JavaScript
- **Auth & Database** — Firebase (Email/Password + Google Sign-In, Realtime Database)
- **Charts** — Chart.js v4
- **Fonts** — Sora + Playfair Display (Google Fonts)

---

## Project Structure

```
walletly/
├── index.html       ← Login / Sign up
├── setup.html       ← First-time budget setup
├── dashboard.html   ← Expense tracker
├── analytics.html   ← Charts & insights
├── reports.html     ← CSV & PDF downloads
├── settings.html    ← Account settings
├── css/app.css      ← All styles (dark + light mode)
└── js/
    ├── common.js    ← Firebase init, auth, theme, sidebar
    ├── dashboard.js ← Expense CRUD + charts
    ├── analytics.js ← All analytics charts
    ├── reports.js   ← CSV/PDF generation
    └── settings.js  ← Settings logic
```

---

## App Flow

```
Login / Signup
    ↓
Budget Setup (first time only)
    ↓
Dashboard → Add / Edit / Delete expenses
    ↓
Analytics → Charts, gauges, trends
    ↓
Reports → Download CSV or PDF
```

---

## Database Structure

```
users/
  {uid}/
    ├── email, name, budget, currency, symbol, createdAt
    └── expenses/
          {id}/
            ├── title, amount, category
            ├── date     "YYYY-MM-DD"
            └── note
```

**Firebase Rules:**

```json
{
  "rules": {
    "users": {
      "$uid": {
        ".read": "$uid === auth.uid",
        ".write": "$uid === auth.uid"
      }
    }
  }
}
```

---

## Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Email/Password** and **Google** sign-in methods
3. Create a **Realtime Database** and apply the rules above
4. Add `localhost` to **Authorized Domains**
5. Paste your Firebase config into `js/common.js` and `index.html`
6. Open with **VS Code Live Server** or run `python -m http.server 5500`

---

## Features

- 🌙 Dark / light mode (persisted in localStorage)
- 📊 Analytics with gauges, balance trend, donut, radar & bar charts
- 📄 Export reports as CSV or PDF
- 🔒 Per-user data isolation via Firebase Auth
- 📱 Responsive — works on mobile

---

_Track every rupee, effortlessly._
