/*
 * charts/kmeans.js: two charts from notebook 02's k-means work, the elbow
 * curve for k = 1 to 10 and the share of broken blocks in each of the k = 4
 * clusters I used.
 */
(function () {
  'use strict';

  Radar.register('kmeans', function (data) {
    var C = Radar.chart;
    var f = Radar.format;
    var km = data.charts.kmeans;
    var chosenIndex = km.k.indexOf(km.chosen_k);
    var brokenTotal = km.clusters.reduce(function (sum, c) { return sum + c.broken_blocks; }, 0);
    var worst = km.clusters.slice().sort(function (a, b) { return b.anomaly_share - a.anomaly_share; })[0];

    C.mount('chart-elbow', function (root, width, height) {
      var colours = C.colours();
      var left = 76;
      var right = width - 12;
      var top = 14;
      var bottom = height - 46;
      var maxInertia = km.inertia[0];
      var x = C.linear(1, km.k[km.k.length - 1], left, right);
      var y = C.linear(0, maxInertia, bottom, top);

      C.yAxis(root, y, left, [0, 100000, 200000], function (v) { return f.int(v); }, right);
      C.xAxis(root, x, bottom, km.k, String, left, right);
      C.text(root, (left + right) / 2, height - 4, 'number of clusters k', { 'text-anchor': 'middle' });
      var d = km.k.map(function (k, index) {
        return (index ? 'L' : 'M') + x(k).toFixed(1) + ',' + y(km.inertia[index]).toFixed(1);
      }).join('');
      C.svg('path', { d: d, fill: 'none', stroke: colours.mute, 'stroke-width': 1.5 }, root);
      var points = km.k.map(function (k, index) {
        var mine = index === chosenIndex;
        C.svg('circle', { cx: x(k), cy: y(km.inertia[index]), r: mine ? 6 : 3.5,
          fill: mine ? colours.broken : colours.mute }, root);
        return { x: x(k), y: y(km.inertia[index]), text: 'k = ' + k + '\ninertia ' + f.int(km.inertia[index]) };
      });
      var cx = x(km.chosen_k);
      var cy = y(km.inertia[chosenIndex]);
      C.annotate(root, cx + 5, cy - 4, cx + 30, y(maxInertia * 0.85), ['k = ' + km.chosen_k + ', the value', 'I used'], 'start', 'hot');
      C.interact(root, points, { mode: 'x', label: 'k-means elbow curve', start: chosenIndex });
    });

    C.mount('chart-clusters', function (root, width, height) {
      var colours = C.colours();
      var left = 54;
      var right = width - 10;
      var top = 26;
      var bottom = height - 50;
      var slot = (right - left) / km.clusters.length;
      var y = C.linear(0, 1, bottom, top);

      C.yAxis(root, y, left, [0, 0.5, 1], function (v) { return f.percent(v, 0); }, right);
      var points = km.clusters.map(function (cluster, index) {
        var mine = cluster === worst;
        var cx = left + slot * (index + 0.5);
        var barWidth = Math.min(56, slot * 0.6);
        C.svg('rect', { x: cx - barWidth / 2, y: y(cluster.anomaly_share), width: barWidth,
          height: bottom - y(cluster.anomaly_share), fill: mine ? colours.broken : colours.healthy }, root);
        C.text(root, cx, y(cluster.anomaly_share) - 6, f.percent(cluster.anomaly_share, 1),
          { 'text-anchor': 'middle', class: mine ? 'hot' : 'ink' });
        C.text(root, cx, bottom + 20, f.int(cluster.blocks), { 'text-anchor': 'middle' });
        C.text(root, cx, bottom + 38, 'blocks', { 'text-anchor': 'middle' });
        return { x: cx, y: y(cluster.anomaly_share),
          text: 'cluster ' + cluster.cluster + ': ' + f.int(cluster.blocks) + ' training blocks\n' +
            f.int(cluster.broken_blocks) + ' broken (' + f.percent(cluster.anomaly_share, 1) + ')' };
      });
      C.svg('line', { x1: left, x2: right, y1: bottom, y2: bottom, stroke: colours.ink }, root);
      C.interact(root, points, { mode: 'x', label: 'Share of broken blocks per cluster' });
    });

    C.setTitle('chart-elbow',
      'Inertia falls steadily from ' + f.int(km.inertia[0]) + ' at k = 1 to ' + f.int(km.inertia[km.inertia.length - 1]) +
        ' at k = ' + km.k[km.k.length - 1] + ', with no sharp elbow; I used k = ' + km.chosen_k,
      'k-means inertia for k from 1 to ' + km.k.length + ': ' + km.k.map(function (k, i) {
        return k + ': ' + f.int(km.inertia[i]);
      }).join('; ') + '.');
    C.setTitle('chart-clusters',
      'One cluster of ' + f.int(worst.blocks) + ' blocks is ' + f.percent(worst.anomaly_share, 0) +
        ' broken, but it holds only ' + f.int(worst.broken_blocks) + ' of the ' + f.int(brokenTotal) + ' broken training blocks',
      'Share of broken training blocks in each of ' + km.clusters.length + ' clusters: ' + km.clusters.map(function (c) {
        return 'cluster ' + c.cluster + ', ' + f.int(c.blocks) + ' blocks, ' + f.percent(c.anomaly_share, 1) + ' broken';
      }).join('; ') + '.');
  });
})();
