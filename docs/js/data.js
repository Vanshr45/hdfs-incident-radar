/*
 * data.js: loads the six JSON files from docs/data/ and holds small helpers
 * shared by every section. Nothing here trains or invents data.
 *
 * If window.SITE_DATA is already set (the single-file preview.html does this),
 * it is used instead of fetching, so the page also works when opened from disk.
 */
(function () {
  'use strict';

  var FILES = ['facts', 'events', 'dial', 'models', 'blocks', 'rules', 'charts'];

  function fetchJson(name) {
    return fetch('data/' + name + '.json').then(function (response) {
      if (!response.ok) {
        throw new Error('Could not load data/' + name + '.json (' + response.status + ')');
      }
      return response.json();
    });
  }

  function loadSiteData() {
    if (window.SITE_DATA) {
      return Promise.resolve(window.SITE_DATA);
    }
    return Promise.all(FILES.map(fetchJson)).then(function (parts) {
      var data = {};
      FILES.forEach(function (name, index) {
        data[name] = parts[index];
      });
      return data;
    });
  }

  // ---------- Number formatting (en-US: 575,061) ----------
  var integer = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

  function formatInt(value) {
    return integer.format(Math.round(value));
  }

  function formatDecimal(value, digits) {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    }).format(value);
  }

  function formatPercent(share, digits) {
    return formatDecimal(share * 100, digits) + '%';
  }

  // Shares of blocks: tiny values must not read as "0.00%".
  function formatShare(share) {
    if (share === 0) return '0%';
    if (share === 1) return '100%';
    if (share < 0.0001) return 'under 0.01%';
    if (share < 0.01) return formatPercent(share, 2);
    if (share < 0.1) return formatPercent(share, 1);
    if (share > 0.999) return 'over 99.9%';
    return formatPercent(share, 0);
  }

  // Suspicion scores are shown with three decimals, like the chosen cut-off 0.135.
  function formatScore(score) {
    return formatDecimal(score, 3);
  }

  var WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
    'eleven', 'twelve'];

  function numberWord(count) {
    return count < WORDS.length ? WORDS[count] : formatInt(count);
  }

  function capitalise(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  // Small seeded random generator, so "random" layouts are the same on every visit.
  function seededRandom(seed) {
    var state = seed >>> 0;
    return function () {
      state = (state + 0x6D2B79F5) >>> 0;
      var t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  window.Radar = {
    loadSiteData: loadSiteData,
    sections: [],
    register: function (name, init) {
      this.sections.push({ name: name, init: init });
    },
    format: {
      int: formatInt,
      decimal: formatDecimal,
      percent: formatPercent,
      share: formatShare,
      score: formatScore,
      word: numberWord,
      capitalise: capitalise
    },
    seededRandom: seededRandom,
    element: element
  };
})();
