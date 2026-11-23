/*
 * charts/depth.js: the decision-tree depth sweep from notebook 03, training F1
 * against validation F1, annotated at the depth I chose.
 */
(function () {
  'use strict';

  var FIRST_DEPTH = 5;   // shallower trees score below the zoomed view
  var Y_MIN = 0.993;
  var Y_MAX = 0.9995;

  Radar.register('depth', function (data) {
    var C = Radar.chart;
    var sweep = data.charts.depth;
    var rows = sweep.depth.map(function (depth, index) {
      return { depth: depth, train: sweep.train_f1[index], validation: sweep.validation_f1[index] };
    }).filter(function (row) { return row.depth >= FIRST_DEPTH; });
    var chosen = rows.filter(function (row) { return row.depth === sweep.chosen_depth; })[0];
    var lastRow = rows[rows.length - 1];
    var maxTrain = Math.max.apply(null, sweep.train_f1);

    C.mount('chart-depth', function (root, width, height) {
      var colours = C.colours();
      var left = 66;
      var right = width - 92;
      var top = 10;
      var bottom = height - 46;
      var x = C.linear(FIRST_DEPTH, lastRow.depth, left, right);
      var y = C.linear(Y_MIN, Y_MAX, bottom, top);

      C.yAxis(root, y, left, [0.994, 0.996, 0.998], function (v) { return v.toFixed(3); }, right);
      C.xAxis(root, x, bottom, [5, 10, 15, 20], String, left, right);
      C.text(root, (left + right) / 2, height - 4, 'maximum tree depth', { 'text-anchor': 'middle' });

      [['train', colours.ink, 'training'], ['validation', colours.broken, 'validation']].forEach(function (series) {
        var d = rows.map(function (row, index) {
          return (index ? 'L' : 'M') + x(row.depth).toFixed(1) + ',' + y(row[series[0]]).toFixed(1);
        }).join('');
        C.svg('path', { d: d, fill: 'none', stroke: series[1], 'stroke-width': series[0] === 'validation' ? 2.5 : 1.5 }, root);
        C.text(root, right + 6, y(lastRow[series[0]]) + 5, series[2], { class: series[0] === 'validation' ? 'hot' : 'ink' });
      });

      var cx = x(chosen.depth);
      var cy = y(chosen.validation);
      C.svg('circle', { cx: cx, cy: cy, r: 5, fill: colours.broken }, root);
      C.annotate(root, cx + 2, cy + 6, x(13.5), y(0.9952),
        ['depth ' + chosen.depth + ': validation F1', chosen.validation.toFixed(5) + ', the highest'], 'start');

      var points = rows.map(function (row) {
        return { x: x(row.depth), y: y(row.validation),
          text: 'depth ' + row.depth + '\ntraining F1 ' + row.train.toFixed(5) + ' · validation F1 ' + row.validation.toFixed(5) };
      });
      C.interact(root, points, { mode: 'x', label: 'Decision tree depth sweep', start: chosen.depth - FIRST_DEPTH });
    });

    C.setTitle('chart-depth',
      'Validation F1 peaks at depth ' + chosen.depth + ' (' + chosen.validation.toFixed(5) + ') while training F1 keeps ' +
        'climbing to ' + maxTrain.toFixed(5),
      'Training and validation F1 for trees of depth 1 to ' + sweep.depth.length + '. ' + sweep.depth.map(function (d, i) {
        return 'depth ' + d + ': ' + sweep.train_f1[i].toFixed(4) + ' / ' + sweep.validation_f1[i].toFixed(4);
      }).join('; ') + '.');
  });
})();
