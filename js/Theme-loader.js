/**
 * FinBuddy — Global Theme Manager
 * ================================
 * HOW TO USE: Add this ONE line inside <head> on EVERY page:
 *
 *   <script src="theme.js"></script>
 *
 * That's it. The theme toggle on the Preferences/Settings page
 * will automatically apply dark/light mode across ALL pages.
 *
 * The theme is stored in localStorage under key: 'finbuddy-theme'
 * Pages that are already open will also switch instantly.
 */

(function () {
    var KEY = 'finbuddy-theme';

    function apply(dark) {
        document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
        // Keep any toggle checkbox in sync (for the preferences page)
        var toggle = document.getElementById('themeToggle');
        if (toggle) toggle.checked = dark;
        var sl = document.getElementById('swatchLight');
        var sd = document.getElementById('swatchDark');
        if (sl) sl.classList.toggle('active', !dark);
        if (sd) sd.classList.toggle('active', dark);
    }

    // Apply saved preference immediately — before page renders — prevents flash
    apply(localStorage.getItem(KEY) === 'dark');

    // Expose global helpers so any page can call them
    window.FinBuddyTheme = {
        toggle: function (isDark) {
            localStorage.setItem(KEY, isDark ? 'dark' : 'light');
            apply(isDark);
        },
        load: function () {
            apply(localStorage.getItem(KEY) === 'dark');
        }
    };

    // Sync all OTHER open tabs/pages the instant the theme changes
    window.addEventListener('storage', function (e) {
        if (e.key === KEY) apply(e.newValue === 'dark');
    });
})();