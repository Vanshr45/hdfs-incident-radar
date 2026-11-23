/*
 * theme.js: the light / dark toggle in the masthead.
 *
 * With no choice saved, the page follows the system setting
 * (prefers-color-scheme). Pressing the toggle saves the reader's choice in
 * localStorage and sets data-theme on <html>; the CSS swaps its colour tokens,
 * and a 'radar:theme' event tells the SVG charts to redraw in the new palette.
 * This file does not need the data files, so it works as soon as the page loads.
 */
(function () {
  'use strict';

  var root = document.documentElement;
  var button = document.getElementById('theme-toggle');
  var label = button.querySelector('.theme-label');
  var systemDark = window.matchMedia('(prefers-color-scheme: dark)');

  function isDark() {
    var chosen = root.getAttribute('data-theme');
    return chosen ? chosen === 'dark' : systemDark.matches;
  }

  function sync() {
    var dark = isDark();
    label.textContent = dark ? 'Light mode' : 'Dark mode';
    button.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
  }

  function announce() {
    sync();
    document.dispatchEvent(new CustomEvent('radar:theme', { detail: { dark: isDark() } }));
  }

  button.addEventListener('click', function () {
    var next = isDark() ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try {
      localStorage.setItem('radar-theme', next);
    } catch (error) {
      // Storage blocked: the choice lasts until the page is closed.
    }
    announce();
  });

  // If the reader never chose, follow the system when it switches (e.g. at sunset).
  systemDark.addEventListener('change', function () {
    if (!root.getAttribute('data-theme')) announce();
  });

  sync();
})();
