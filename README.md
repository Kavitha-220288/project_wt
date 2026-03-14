# 💳 Walletly — Premium Full-Stack Expense Tracker

A modern, professional personal finance tracker built with an Aurora Glassmorphism design system. 
It uses a Node.js backend to securely proxy AI requests and serving static files, while the frontend is built with vanilla HTML, CSS, and JS hooked directly into Firebase.

---

## 🛠️ Tech Stack

- **Frontend:** HTML, Vanilla CSS (Aurora Glass Design), JavaScript
- **Backend:** Node.js, Express (for secure API proxying)
- **Auth & Database:** Firebase (Email/Password + Google Sign-In, Realtime Database)
- **AI Integration:** OpenRouter API / Gemini Vision API (Proxy via backend)
- **Notifications:** EmailJS (for automated budget alerts)
- **Charts:** Chart.js v4
- **Fonts:** Sora + Playfair Display (Google Fonts)

---

## 📁 Project Structure

```
walletly/
├── client/              ← Frontend application
│   ├── landing.html     ← New! Animated SaaS Landing Page
│   ├── signin.html      ← Updated! Glassmorphism Authentication
│   ├── setup.html       ← Initial budget & profile setup
│   ├── dashboard.html   ← Main Expense tracker & AI Assistant
│   ├── analytics.html   ← Charts & trends
│   ├── reports.html     ← CSV data exports
│   ├── settings.html    ← Account configurations
│   ├── css/
│   │   ├── landing.css  ← Landing page styles
│   │   └── app.css      ← Main app Design System
│   └── js/
│       ├── landing.js   ← Landing page animations (GSAP)
│       ├── api_client.js ← Frontend client for backend APIs
│       ├── ai_service.js ← AI logic & prompt engineering
│       ├── common.js     ← Auth guard & global utilities
│       └── dashboard.js  ← Tracker UI & event handling
├── server/
│   ├── index.js         ← Application entry point
│   └── server.js        ← Express routes & AI proxying
├── .env                 ← Secure API Keys (Git ignored)
└── package.json         ← Scripts & dependencies
```

---

## 🚦 Application Flow

1. **Discovery**: User arrives at the high-end `landing.html`.
2. **Authentication**: User logs in or signs up via `signin.html` (Google/Email).
3. **Personalization**: New users are guided to `setup.html` to set their currency and budget.
4. **Operations**: User manages their finances on the `dashboard.html`.

---

## ⚡ Key Features

- **🌙 Aurora Glassmorphism:** A stunning, cinematic UI with dark/light mode toggling.
- **🤖 Walletly AI Assistant:** Context-aware chatbot powered by OpenRouter.
- **📸 Receipt Parsing:** Upload receipts and our AI vision model extracts exactly what you spent.
- **🎤 Voice Parsing:** Speak your expenses and let the AI log it.
- **📊 Real-time Analytics:** Interactive donut & line charts for your spending.
- **🔔 Smart Notifications & Alerts:** In-app notification system and automated budget limit emails via EmailJS.
- **🔒 Secure Architecture:** Backend Express server proxies all API calls so no AI keys are exposed on the frontend.
- **📄 Export & Reports:** Download your entire ledger in a clean CSV.

---

## 🚀 Setup & Installation

Please refer to the `QUICKSTART.md` file for step-by-step installation instructions.

---

_Track every cent, effortlessly, and let AI do the heavy lifting._
