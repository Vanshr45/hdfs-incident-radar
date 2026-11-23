/*
 * charts/pca.js: PCA scree plot from notebook 02, each component's share of
 * the variance (grey bars) and the running total (orange line), with 95% marked.
 */
(function () {
  'use strict';

  Radar.register('pca', function (data) {
    var C = Radar.chart;
    var f = Radar.format;
    var pca = data.charts.pca;
    var count = pca.component.length;
    var reach = pca.components_for_95;

    C.mount('chart-pca', function (root, width, height) {
      var colours = C.colours();
      var left = 54;
      var right = width - 10;
      var top = 10;
      var bottom = height - 46;
      var x = C.linear(0.5, count + 0.5, left, right);
      var y = C.linear(0, 1, bottom, top);
      var barWidth = Math.max(2, (right - left) / count - 2);

      C.yAxis(root, y, left, [0, 0.25, 0.5, 0.75, 1], function (v) { return f.percent(v, 0); }, right);
      C.xAxis(root, x, bottom, [1, 10, 20, count], String, left, right);
      C.text(root, (left + right) / 2, height - 4, 'principal component', { 'text-anchor': 'middle' });

      pca.ratio.forEach(function (ratio, index) {
        C.svg('rect', { x: x(index + 1) - barWidth / 2, y: y(ratio), width: barWidth, height: bottom - y(ratio),
          fill: colours.healthy }, root);
      });
      var d = pca.cumulative.map(function (value, index) {
        return (index ? 'L' : 'M') + x(index + 1).toFixed(1) + ',' + y(value).toFixed(1);
      }).join('');
      C.svg('path', { d: d, fill: 'none', stroke: colours.broken, 'stroke-width': 2.5 }, root);
      C.svg('line', { x1: left, x2: right, y1: y(pca.line), y2: y(pca.line), stroke: colours.ink,
        'stroke-dasharray': '4 4' }, root);
      C.text(root, left + 6, y(pca.line) - 6, f.percent(pca.line, 0) + ' of the variance', { class: 'ink' });

      var rx = x(reach);
      var ry = y(pca.cumulative[reach - 1]);
      C.svg('circle', { cx: rx, cy: ry, r: 5, fill: colours.broken }, root);
      C.annotate(root, rx, ry + 6, rx + 10, y(0.55), ['reached at', 'component ' + reach], 'start');

      var points = pca.component.map(function (component, index) {
        return { x: x(component), y: y(pca.cumulative[index]),
          text: 'component ' + component + '\nits own share ' + f.percent(pca.ratio[index], 1) + ' · running total ' +
            f.percent(pca.cumulative[index], 1) };
      });
      C.interact(root, points, { mode: 'x', label: 'PCA explained variance', start: reach - 1 });
    });

    C.setTitle('chart-pca',
      'It takes ' + reach + ' of ' + count + ' components to keep ' + f.percent(pca.line, 0) +
        ' of the variance, so the counts do not squash into a few directions',
      'Explained variance of ' + count + ' principal components of the standardised training counts. The first explains ' +
        f.percent(pca.ratio[0], 1) + '; the running total passes 95% at component ' + reach + '.');
  });
})();
