/*
 * charts/roc.js: validation ROC curves for every model, zoomed into the
 * top-left corner. The random forest is orange; the others are grey.
 */
(function () {
  'use strict';

  var HIGHLIGHT = 'Random forest';

  function percent(value, digits) {
    return (value * 100).toFixed(digits) + '%';
  }

  // The highest true-positive rate a curve reaches without passing a false-positive rate.
  function tprAt(curve, fprLimit) {
    var best = 0;
    curve.fpr.forEach(function (fpr, index) {
      if (fpr <= fprLimit) best = Math.max(best, curve.tpr[index]);
    });
    return best;
  }

  Radar.register('roc', function (data) {
    var C = Radar.chart;
    var roc = data.charts.roc;
    var outside = roc.curves.filter(function (curve) { return tprAt(curve, roc.zoom_fpr) < 0.95; });
    var inside = roc.curves.filter(function (curve) { return outside.indexOf(curve) === -1; });
    // The lowest value the visible curves reach at the right edge of the zoom sets the bottom of the view.
    var floor = Math.floor(Math.min.apply(null, inside.map(function (c) { return tprAt(c, roc.zoom_fpr); })) * 200) / 200;
    var yMin = Math.min(floor - 0.005, 0.99);

    C.mount('chart-roc', function (root, width, height) {
      var colours = C.colours();
      var left = 64;
      var right = width - 12;
      var top = 10;
      var bottom = height - 46;
      var x = C.linear(0, roc.zoom_fpr, left, right);
      var y = C.linear(yMin, 1, bottom, top);

      var clipId = 'roc-clip';
      var clip = C.svg('clipPath', { id: clipId }, C.svg('defs', {}, root));
      C.svg('rect', { x: left, y: top - 4, width: right - left + 4, height: bottom - top + 4 }, clip);

      var ySteps = [];
      for (var v = yMin; v <= 1.00001; v += (1 - yMin) / 4) ySteps.push(v);
      C.yAxis(root, y, left, ySteps, function (value) { return percent(value, 1); }, right);
      C.xAxis(root, x, bottom, [0, roc.zoom_fpr / 2, roc.zoom_fpr], function (value) { return percent(value, 1); },
        left, right);
      C.text(root, (left + right) / 2, height - 4, 'false alarm rate', { 'text-anchor': 'middle' });
      C.text(root, left + 8, y(yMin + (1 - yMin) * 0.06), 'broken blocks found ↑');

      var paths = {};
      var points = [];
      // Grey curves first, so the orange one is drawn on top.
      var greyFirst = inside.filter(function (c) { return c.key !== HIGHLIGHT; })
        .concat(inside.filter(function (c) { return c.key === HIGHLIGHT; }));
      greyFirst.forEach(function (curve) {
        var mine = curve.key === HIGHLIGHT;
        var d = curve.fpr.map(function (fpr, index) {
          return (index ? 'L' : 'M') + x(fpr).toFixed(1) + ',' + y(curve.tpr[index]).toFixed(1);
        }).join('');
        paths[curve.key] = C.svg('path', { d: d, fill: 'none', 'clip-path': 'url(#' + clipId + ')',
          stroke: mine ? colours.broken : colours.healthy, 'stroke-width': mine ? 2.5 : 1.25 }, root);
        curve.fpr.forEach(function (fpr, index) {
          if (fpr > roc.zoom_fpr || curve.tpr[index] < yMin) return;
          points.push({ x: x(fpr), y: y(curve.tpr[index]), key: curve.key,
            text: curve.name + ' (AUC ' + curve.auc.toFixed(6) + ')\nfalse alarms ' + percent(fpr, 3) +
              ' · found ' + percent(curve.tpr[index], 2) });
        });
      });

      var forest = inside.filter(function (c) { return c.key === HIGHLIGHT; })[0];
      C.annotate(root, x(roc.zoom_fpr * 0.3), y(tprAt(forest, roc.zoom_fpr * 0.3)), x(roc.zoom_fpr * 0.42),
        y(yMin + (1 - yMin) * 0.74), [forest.name, 'AUC ' + forest.auc.toFixed(6)], 'start', 'hot');
      C.text(root, right - 4, y(yMin + (1 - yMin) * 0.42), (inside.length - 1) + ' other models in grey', { 'text-anchor': 'end' });
      outside.forEach(function (curve, index) {
        C.text(root, right - 4, y(yMin + (1 - yMin) * 0.3) + index * 34, curve.name + ':', { 'text-anchor': 'end' });
        C.text(root, right - 4, y(yMin + (1 - yMin) * 0.3) + index * 34 + 17, 'below this view (AUC ' +
          curve.auc.toFixed(3) + ')', { 'text-anchor': 'end' });
      });

      points.sort(function (a, b) { return a.x - b.x; });
      C.interact(root, points, {
        mode: 'xy',
        label: 'ROC curves, zoomed',
        onShow: function (index) {
          Object.keys(paths).forEach(function (key) {
            var active = index >= 0 && points[index].key === key;
            if (key !== HIGHLIGHT) paths[key].setAttribute('stroke', active ? colours.ink : colours.healthy);
          });
        }
      });
    });

    var lowest = Math.min.apply(null, inside.map(function (c) { return c.auc; }));
    var forestAuc = roc.curves.filter(function (c) { return c.key === HIGHLIGHT; })[0].auc;
    C.setTitle('chart-roc',
      'Every model except the ' + outside.map(function (c) { return c.name; }).join(', ') +
        ' has a validation AUC of at least ' + (Math.floor(lowest * 1000) / 1000).toFixed(3) + '; the random forest’s is ' +
        forestAuc.toFixed(6),
      'ROC curves on the validation set, zoomed to false alarm rates up to ' + percent(roc.zoom_fpr, 0) +
        '. AUC by model: ' + roc.curves.map(function (c) { return c.name + ' ' + c.auc.toFixed(6); }).join('; ') + '.');
  });
})();
