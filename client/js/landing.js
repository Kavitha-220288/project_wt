// js/light_landing.js — Walletly Marketing Page Logic

document.addEventListener('DOMContentLoaded', function() {
    initGSAP();
    initCharts();
});

// ── GSAP Scroll Animations ─────────────────────────────────
function initGSAP() {
    gsap.registerPlugin(ScrollTrigger);

    // Initial Reveal for Hero
    gsap.to('.reveal', {
        opacity: 1,
        y: 0,
        duration: 1,
        stagger: 0.2,
        ease: "power2.out"
    });

    // Reveal on Scroll
    const reveals = document.querySelectorAll('.reveal');
    reveals.forEach(el => {
        gsap.from(el, {
            scrollTrigger: {
                trigger: el,
                start: "top 90%",
                toggleActions: "play none none reverse"
            },
            opacity: 0,
            y: 30,
            duration: 0.8,
            ease: "power2.out"
        });
    });

    // Problem Icons Animation
    gsap.from('.p-icon', {
        scrollTrigger: {
            trigger: '.problem-icons',
            start: "top 80%"
        },
        scale: 0.5,
        opacity: 0,
        duration: 1,
        stagger: 0.1,
        ease: "back.out(1.7)"
    });

    // Dashboard Mockup Fill
    gsap.to('.m-box', {
        scrollTrigger: {
            trigger: '.solution',
            start: "top 70%"
        },
        height: '80px',
        opacity: 1,
        duration: 1,
        stagger: 0.2
    });

    // Navbar Scroll Effect
    window.addEventListener('scroll', () => {
        const nav = document.querySelector('.navbar');
        if (window.scrollY > 50) {
            nav.classList.add('scrolled');
            gsap.to(nav, { backgroundColor: 'rgba(255, 255, 255, 0.95)', boxShadow: '0 4px 20px rgba(0,0,0,0.05)', duration: 0.3 });
        } else {
            nav.classList.remove('scrolled');
            gsap.to(nav, { backgroundColor: 'rgba(255, 255, 255, 0.85)', boxShadow: 'none', duration: 0.3 });
        }
    });
}

// ── Chart.js Visualization ────────────────────────────────
function initCharts() {
    // Hero Mini Chart
    const heroCtx = document.getElementById('heroMiniChart');
    if (heroCtx) {
        new Chart(heroCtx, {
            type: 'line',
            data: {
                labels: ['M', 'T', 'W', 'T', 'F', 'S', 'S'],
                datasets: [{
                    data: [12, 19, 3, 5, 2, 3, 15],
                    borderColor: '#5f259f',
                    borderWidth: 3,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { x: { display: false }, y: { display: false } }
            }
        });
    }

    // Insights Section Chart
    const mainCtx = document.getElementById('insightsChart');
    if (mainCtx) {
        new Chart(mainCtx, {
            type: 'bar',
            data: {
                labels: ['Food', 'Travel', 'Shopping', 'Bills', 'Ent.', 'Rent'],
                datasets: [{
                    label: 'Spent',
                    data: [4200, 2100, 3500, 1200, 800, 15000],
                    backgroundColor: [
                        '#5f259f', '#9b6ef3', '#5f259fcc', '#9b6ef3cc', '#5f259f99', '#9b6ef399'
                    ],
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false }, ticks: { font: { weight: '600' } } },
                    y: { grid: { color: '#f1f5f9' }, ticks: { callback: v => '₹' + v/1000 + 'k' } }
                }
            }
        });
    }
}

// Mobile Menu Toggle
const menuBtn = document.querySelector('.mobile-menu-btn');
if (menuBtn) {
    menuBtn.addEventListener('click', () => {
        alert('Mobile menu selection would slide in here!');
    });
}
