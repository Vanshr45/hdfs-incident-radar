/*
 * main.js: loads the data, fills every [data-fact] placeholder in the HTML,
 * then starts each section in page order.
 */
(function () {
  'use strict';

  var GRID_SQUARES = 1000; // the haystack grid is 40 x 25 squares

  // Facts that are simple arithmetic on the exported files.
  function derivedFacts(data) {
    var facts = data.facts;
    var e9 = data.events.events.filter(function (event) { return event.id === 'E9'; })[0];
    var modelCount = data.models.validation.filter(function (model) { return !model.is_baseline; }).length;
    return {
      grid_squares: GRID_SQUARES,
      blocks_per_square: Math.round(facts.total_blocks / GRID_SQUARES),
      broken_squares: Math.round(facts.anomaly_ratio * GRID_SQUARES),
      typical_copies: e9.healthy_median,
      healthy_training_blocks: data.events.healthy_training_blocks,
      broken_training_blocks: data.events.broken_training_blocks,
      sample_size: data.blocks.sample_size,
      mistakes: data.blocks.mistakes,
      model_count_word: Radar.format.capitalise(Radar.format.word(modelCount)),
      rule_tree_depth: data.rules.tree_depth,
      kmeans_fit_blocks: data.charts.kmeans.fitted_on_normal_blocks,
      log_year: facts.log_start.slice(0, 4)
    };
  }

  function formatFact(value, format) {
    var f = Radar.format;
    switch (format) {
      case 'pct0': return f.percent(value, 0);
      case 'pct2': return f.percent(value, 2);
      case 'decimal1': return f.decimal(value, 1);
      case 'per100': return f.decimal(value * 100, 2);
      case 'lower': return String(value).toLowerCase();
      case 'word': return f.word(value);
      case 'text': return String(value);
      default: return typeof value === 'number' ? f.int(value) : String(value);
    }
  }

  function fillFacts(data) {
    var all = Object.assign({}, data.facts, derivedFacts(data));
    data.derived = all;
    document.querySelectorAll('[data-fact]').forEach(function (node) {
      var key = node.getAttribute('data-fact');
      if (!(key in all)) {
        console.warn('No value for data-fact="' + key + '"');
        return;
      }
      node.textContent = formatFact(all[key], node.getAttribute('data-format'));
    });
  }

  function reveal() {
    document.documentElement.classList.remove('loading');
  }

  function showLoadError(error) {
    reveal();
    var box = document.getElementById('load-error');
    box.hidden = false;
    box.textContent = 'The data files could not be loaded, so the numbers and charts are missing. ' +
      'Open the page through a local web server (python -m http.server, run inside docs/) or use preview.html. ' +
      'Details: ' + error.message;
  }

  function start() {
    Radar.loadSiteData().then(function (data) {
      fillFacts(data);
      Radar.sections.forEach(function (section) {
        try {
          section.init(data);
        } catch (error) {
          console.error('Section "' + section.name + '" failed:', error);
        }
      });
      reveal();
    }).catch(showLoadError);
  }

  // Scripts are deferred, so the document is parsed by the time this runs.
  start();
})();
