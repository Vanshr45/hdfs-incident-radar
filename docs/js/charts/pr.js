/*
 * charts/pr.js: validation precision-recall curves for the random forest and
 * two other models, zoomed to recall above 99%, with each chosen cut-off marked.
 */
(function () {
  'use strict';

  var HIGHLIGHT = 'Random forest';

  function per100(value) {
    return (value * 100).toFixed(1);
  }

  Radar.register('pr', function (data) {
    var C = Radar.chart;
    var pr = data.charts.pr;
    var chosen = {};
    data.models.validation.forEach(function (model) { chosen[model.key] = model; });

    C.mount('chart-pr', function (root, width, height) {
      var colours = C.colours();
      var left = 56;
      var right = width - 12;
      var top = 10;
      var bottom = height - 46;
      var yMin = 0.95;
      var x = C.linear(pr.zoom_recall, 1, left, right);
      var y = C.linear(yMin, 1, bottom, top);

      var clip = C.svg('clipPath', { id: 'pr-clip' }, C.svg('defs', {}, root));
      C.svg('rect', { x: left, y: top - 4, width: right - left + 4, height: bottom - top + 4 }, clip);
      C.yAxis(root, y, left, [0.95, 0.96, 0.97, 0.98, 0.99, 1], per100, right);
      C.xAxis(root, x, bottom, [0.99, 0.995, 1], per100, left, right);
      C.text(root, (left + right) / 2, height - 4, 'broken blocks found, per 100', { 'text-anchor': 'middle' });
      C.text(root, left + 8, y(yMin + 0.004), 'real alarms per 100 ↑');

      var points = [];
      var ordered = pr.curves.filter(function (c) { return c.key !== HIGHLIGHT; })
        .concat(pr.curves.filter(function (c) { return c.key === HIGHLIGHT; }));
      // Labels are stacked in the same top-to-bottom order as their dots, so leaders never cross.
      var labelRank = pr.curves.slice().sort(function (a, b) { return chosen[b.key].precision - chosen[a.key].precision; })
        .map(function (c) { return c.key; });
      ordered.forEach(function (curve) {
        var mine = curve.key === HIGHLIGHT;
        var colour = mine ? colours.broken : colours.healthy;
        var d = curve.recall.map(function (recall, index) {
          return (index ? 'L' : 'M') + x(recall).toFixed(1) + ',' + y(curve.precision[index]).toFixed(1);
        }).join('');
        C.svg('path', { d: d, fill: 'none', stroke: colour, 'stroke-width': mine ? 2.5 : 1.5,
          'clip-path': 'url(#pr-clip)' }, root);

        var model = chosen[curve.key];
        var cx = x(model.recall);
        var cy = y(model.precision);
        C.svg('circle', { cx: cx, cy: cy, r: 5, fill: mine ? colours.broken : colours.paper,
          stroke: mine ? colours.broken : colours.ink, 'stroke-width': 1.5 }, root);
        // Labels are stacked on the left, each with a leader to its model's chosen point.
        var label = curve.name + ': ' + per100(model.precision) + ' real per 100';
        var labelX = x(0.9965);
        // When the label does not fit left of the dots, it goes on two lines.
        var lines = label.length * 8.45 > labelX - left - 8 ? [curve.name, per100(model.precision) + ' real per 100'] : label;
        var rank = labelRank.indexOf(curve.key);
        C.annotate(root, cx - 5, cy + 2, labelX, y(0.992 - rank * 0.011), lines, 'end', mine ? 'hot' : 'ink');
        points.push({ x: cx, y: cy, text: curve.name + ' at its cut-off ' + Radar.format.score(model.threshold) +
          '\nfound ' + per100(model.recall) + ' per 100 · real alarms ' + per100(model.precision) + ' per 100' });
        curve.recall.forEach(function (recall, index) {
          if (recall < pr.zoom_recall || curve.precision[index] < yMin) return;
          points.push({ x: x(recall), y: y(curve.precision[index]),
            text: curve.name + '\nfound ' + per100(recall) + ' · real alarms ' + per100(curve.precision[index]) });
        });
      });

      points.sort(function (a, b) { return a.x - b.x; });
      C.interact(root, points, { mode: 'xy', label: 'Precision-recall curves, zoomed' });
    });

    var names = pr.curves.map(function (curve) {
      return curve.name.toLowerCase() + ' ' + per100(chosen[curve.key].precision);
    });
    // Only claim the two are alike if their chosen precisions really are within 0.2 points.
    var close = chosen.kNN && Math.abs(chosen[HIGHLIGHT].precision - chosen.kNN.precision) < 0.002;
    C.setTitle('chart-pr',
      'At their chosen cut-offs, real alarms per 100: ' + names.join(', ') +
        (close ? '. The forest and nearest neighbours are almost indistinguishable above 99% recall' : ''),
      'Precision-recall curves on the validation set for ' + pr.curves.map(function (c) { return c.name; }).join(', ') +
        ', zoomed to recall above 99%. ' + pr.curves.map(function (c) {
          var m = chosen[c.key];
          return c.name + ' chose recall ' + per100(m.recall) + ' and precision ' + per100(m.precision);
        }).join('; ') + '.');
  });
})();
