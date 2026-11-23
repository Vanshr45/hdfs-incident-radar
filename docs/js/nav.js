/*
 * nav.js: highlights the current section in the slim index on wide screens.
 * The current section is the last one whose top has passed 40% of the window.
 * Checked on scroll inside requestAnimationFrame.
 */
(function () {
  'use strict';

  Radar.register('nav', function () {
    var links = Array.prototype.slice.call(document.querySelectorAll('.rail a'));
    var sections = links.map(function (link) { return document.querySelector(link.getAttribute('href')); });
    var waiting = false;

    function update() {
      waiting = false;
      var line = window.innerHeight * 0.4;
      var current = -1;
      sections.forEach(function (section, index) {
        if (section.getBoundingClientRect().top < line) current = index;
      });
      links.forEach(function (link, index) {
        if (index === current) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
    }

    window.addEventListener('scroll', function () {
      if (waiting) return;
      waiting = true;
      window.requestAnimationFrame(update);
    }, { passive: true });
    update();
  });
})();
