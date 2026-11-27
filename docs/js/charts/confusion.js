/*
 * charts/confusion.js: one small 2 x 2 confusion matrix per model, for the
 * validation set (all models) or the test set (the three tested), switched
 * with two buttons. The random forest's grid is outlined in orange.
 */
(function () {
  'use strict';

  var HIGHLIGHT = 'Logistic regression';
  var CELL = 72;       // one square of a matrix
  var NAME = 40;       // two lines of model name above each matrix
  var PANEL_GAP = 18;
  var SIDE = 26;       // room on the left for the "truth" labels

  Radar.register('confusion', function (data) {
    HIGHLIGHT = data.facts.best_model;
    var C = Radar.chart;
    var f = Radar.format;
    var sets = data.charts.confusion;
    var current = 'validation';
    var chart;

    function titleFor(setName) {
      var models = sets[setName];
      if (setName === 'test') {
        return 'On the test set the three models miss ' + models.map(function (m) { return f.int(m.fn); }).join(', ') +
          ' broken blocks and raise ' + models.map(function (m) { return f.int(m.fp); }).join(', ') + ' false alarms';
      }
      var real = models.filter(function (m) { return m.key !== 'PCA anomaly detector' && m.key !== 'Baseline (always normal)'; });
      var maxMissed = Math.max.apply(null, real.map(function (m) { return m.fn; }));
      var fps = real.map(function (m) { return m.fp; });
      return 'Apart from the PCA check and the baseline, no model misses more than ' + f.int(maxMissed) + ' of ' +
        f.int(real[0].fn + real[0].tp) + ' broken validation blocks; they differ in false alarms, from ' +
        f.int(Math.min.apply(null, fps)) + ' to ' + f.int(Math.max.apply(null, fps));
    }

    function altFor(setName) {
      return sets[setName].map(function (m) {
        return m.name + ': ' + m.tp + ' found, ' + m.fn + ' missed, ' + m.fp + ' false alarms, ' + m.tn + ' healthy left alone';
      }).join('. ') + '.';
    }

    chart = C.mount('chart-confusion', function (root, width) {
      var colours = C.colours();
      var models = sets[current];
      var panelWidth = SIDE + 2 * CELL;
      var perRow = Math.max(1, Math.floor((width + PANEL_GAP) / (panelWidth + PANEL_GAP)));
      var panelHeight = NAME + 18 + 2 * CELL + PANEL_GAP;
      var points = [];

      models.forEach(function (model, index) {
        var x0 = (index % perRow) * (panelWidth + PANEL_GAP);
        var y0 = Math.floor(index / perRow) * panelHeight;
        var mine = model.key === HIGHLIGHT;
        C.wrapWords(model.name, 20).slice(0, 2).forEach(function (line, lineIndex) {
          C.text(root, x0, y0 + 15 + lineIndex * 17, line, { class: mine ? 'hot' : 'ink' });
        });
        var gx = x0 + SIDE;
        var gy = y0 + NAME + 18;
        C.text(root, gx + CELL / 2, gy - 5, 'quiet', { 'text-anchor': 'middle' });
        C.text(root, gx + CELL * 1.5, gy - 5, 'alarm', { 'text-anchor': 'middle' });
        C.text(root, x0 + 16, gy + CELL / 2, 'healthy', { 'text-anchor': 'middle',
          transform: 'rotate(-90 ' + (x0 + 16) + ' ' + (gy + CELL / 2) + ')' });
        C.text(root, x0 + 16, gy + CELL * 1.5, 'broken', { 'text-anchor': 'middle',
          transform: 'rotate(-90 ' + (x0 + 16) + ' ' + (gy + CELL * 1.5) + ')' });

        var cells = [
          ['tn', 0, 0, 'healthy, left alone'], ['fp', 1, 0, 'false alarms'],
          ['fn', 0, 1, 'missed'], ['tp', 1, 1, 'found']
        ];
        cells.forEach(function (cell) {
          var value = model[cell[0]];
          var correct = cell[0] === 'tn' || cell[0] === 'tp';
          var cx = gx + cell[1] * CELL;
          var cy = gy + cell[2] * CELL;
          C.svg('rect', { x: cx, y: cy, width: CELL - 2, height: CELL - 2,
            fill: correct ? colours.healthySoft : colours.paper,
            stroke: correct ? 'none' : colours.ink, 'stroke-width': 1 }, root);
          C.text(root, cx + (CELL - 2) / 2, cy + CELL / 2 + 4, f.int(value), { 'text-anchor': 'middle',
            class: !correct && value > 0 ? 'hot' : 'ink' });
          points.push({ x: cx + CELL / 2, y: cy + CELL / 2, text: model.name + '\n' + cell[3] + ': ' + f.int(value) });
        });
        if (mine) {
          C.svg('rect', { x: gx - 4, y: gy - 4, width: 2 * CELL + 6, height: 2 * CELL + 6, fill: 'none',
            stroke: colours.broken, 'stroke-width': 2 }, root);
        }
      });

      C.resize(root, Math.ceil(models.length / perRow) * panelHeight);
      C.interact(root, points, { mode: 'xy', label: 'Confusion matrices, ' + current + ' set' });
      C.setTitle('chart-confusion', titleFor(current), altFor(current));
    });

    document.querySelectorAll('#chart-confusion .chart-toggle button').forEach(function (button) {
      button.addEventListener('click', function () {
        current = button.getAttribute('data-set');
        document.querySelectorAll('#chart-confusion .chart-toggle button').forEach(function (other) {
          other.setAttribute('aria-pressed', String(other === button));
        });
        chart.redraw();
      });
    });
  });
})();
