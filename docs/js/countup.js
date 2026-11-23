/*
 * countup.js: the large pull-stat numbers count up to their real value the
 * first time they scroll into view. The final value is already in the page
 * (filled by main.js), and its width is reserved, so nothing shifts. With
 * prefers-reduced-motion the numbers simply stay as they are.
 */
(function () {
  'use strict';

  var DURATION = 900;

  Radar.register('countup', function () {
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var numbers = document.querySelectorAll('[data-countup]');
    if (reduce || !('IntersectionObserver' in window)) return;

    function run(node) {
      var finalText = node.textContent;
      var target = Number(finalText.replace(/[^0-9]/g, ''));
      node.style.display = 'inline-block';
      node.style.minWidth = node.getBoundingClientRect().width + 'px';
      var start = null;
      function frame(now) {
        if (start === null) start = now;
        var progress = Math.min((now - start) / DURATION, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        node.textContent = progress < 1 ? Radar.format.int(Math.round(target * eased)) : finalText;
        if (progress < 1) window.requestAnimationFrame(frame);
      }
      window.requestAnimationFrame(frame);
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        run(entry.target);
      });
    }, { threshold: 0.6 });
    numbers.forEach(function (node) { observer.observe(node); });
  });
})();
