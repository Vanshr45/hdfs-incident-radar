/*
 * trap.js: the "lazy guard" button. The numbers in the table are filled by
 * main.js from facts.json; this file only shows and hides the table.
 */
(function () {
  'use strict';

  Radar.register('trap', function () {
    var button = document.getElementById('trap-toggle');
    var table = document.getElementById('trap-table');

    button.addEventListener('click', function () {
      var showing = button.getAttribute('aria-pressed') === 'true';
      button.setAttribute('aria-pressed', String(!showing));
      button.textContent = showing ? 'Show the lazy guard\'s score' : 'Hide the lazy guard\'s score';
      table.hidden = showing;
    });
  });
})();
