/*
 * charts/scorehist.js: random forest scores of the validation blocks in 40
 * bins, broken above the axis and healthy below, both on a log scale. The
 * black line follows the alarm dial ('radar:threshold' events from dial.js).
 */
(function () {
  'use strict';

  Radar.register('scorehist', function (data) {
    var C = Radar.chart;
    var f = Radar.format;
    var scores = data.charts.scores;
    var bins = scores.healthy.length;
    var threshold = data.facts.threshold;
    var moveLine = function () {};
    var biggest = Math.max.apply(null, scores.healthy.concat(scores.broken));

    C.mount('chart-scores', function (root, width, height) {
      var colours = C.colours();
      var left = 72;
      var right = width - 8;
      var mid = Math.round(height / 2) - 6;
      var half = mid - 18;
      var x = C.linear(0, 1, left, right);
      // log10 of the count, as a bar length; a count of 1 still gets a visible sliver.
      var length = function (count) {
        return count === 0 ? 0 : Math.max(2, Math.log10(count) / Math.log10(biggest) * half + 2);
      };
      var points = [];
      var binWidth = (right - left) / bins - 1;

      // Grid lines at 10, 1,000 and 100,000 on both sides (1 would sit on the axis itself).
      [10, 1000, 100000].forEach(function (count) {
        var offset = length(count);
        [mid - offset, mid + offset].forEach(function (y) {
          C.svg('line', { x1: left, x2: right, y1: y, y2: y, stroke: colours.rule }, root);
          C.text(root, left - 6, y + 5, f.int(count), { 'text-anchor': 'end' });
        });
      });

      for (var i = 0; i < bins; i++) {
        var x0 = x(scores.edges[i]) + 0.5;
        var up = length(scores.broken[i]);
        var down = length(scores.healthy[i]);
        if (up) C.svg('rect', { x: x0, y: mid - up, width: binWidth, height: up, fill: colours.broken }, root);
        if (down) C.svg('rect', { x: x0, y: mid, width: binWidth, height: down, fill: colours.healthy }, root);
        points.push({ x: x0 + binWidth / 2, y: mid,
          text: 'scores ' + scores.edges[i].toFixed(3) + '–' + scores.edges[i + 1].toFixed(3) + '\nbroken ' +
            f.int(scores.broken[i]) + ' · healthy ' + f.int(scores.healthy[i]) });
      }
      C.svg('line', { x1: left, x2: right, y1: mid, y2: mid, stroke: colours.ink }, root);
      // Direct labels in the empty middle of each half.
      C.text(root, x(0.55), mid - 34, 'broken ↑', { class: 'hot', 'text-anchor': 'middle' });
      C.text(root, x(0.55), mid + 44, 'healthy ↓', { class: 'ink', 'text-anchor': 'middle' });
      C.xAxis(root, x, height - 22, [0, 0.25, 0.5, 0.75, 1], function (v) { return String(v); }, left, right);

      var line = C.svg('line', { y1: 4, y2: height - 22, stroke: colours.ink, 'stroke-width': 2 }, root);
      var label = C.text(root, 0, 16, '', { class: 'ink' });
      moveLine = function () {
        var position = x(threshold);
        line.setAttribute('x1', position);
        line.setAttribute('x2', position);
        label.setAttribute('x', position + (position > width / 2 ? -6 : 6));
        label.setAttribute('text-anchor', position > width / 2 ? 'end' : 'start');
        label.textContent = 'cut-off ' + f.score(threshold);
      };
      moveLine();

      // A note on the biggest pile of healthy blocks.
      C.annotate(root, points[0].x + binWidth / 2, mid + length(scores.healthy[0]) - 6, x(0.3), mid + half - 22,
        [f.int(scores.healthy[0]) + ' healthy blocks', 'score under ' + scores.edges[1]]);

      C.interact(root, points, { mode: 'x', label: 'Histogram of validation scores' });
    });

    document.addEventListener('radar:threshold', function (event) {
      threshold = event.detail.threshold;
      moveLine();
    });

    var total = scores.healthy.concat(scores.broken).reduce(function (a, b) { return a + b; }, 0);
    var extremes = scores.healthy[0] + scores.broken[0] + scores.healthy[bins - 1] + scores.broken[bins - 1];
    C.setTitle('chart-scores',
      f.percent(extremes / total, 1) + ' of validation blocks score under ' + scores.edges[1] + ' or from ' +
        scores.edges[bins - 1] + ' up: the forest is rarely unsure',
      'Histogram of ' + f.int(total) + ' validation scores in ' + bins + ' bins. ' + f.int(scores.healthy[0]) +
        ' healthy and ' + f.int(scores.broken[0]) + ' broken blocks are in the lowest bin; ' + f.int(scores.broken[bins - 1]) +
        ' broken and ' + f.int(scores.healthy[bins - 1]) + ' healthy are in the highest.');
  });
})();
