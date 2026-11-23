/*
 * charts/costcurve.js: validation cost (10 x missed + false alarms) for the
 * random forest at each of the dial's thresholds, with the minimum marked.
 */
(function () {
  'use strict';

  Radar.register('costcurve', function (data) {
    var C = Radar.chart;
    var f = Radar.format;
    var curve = data.charts.costcurve;
    var points = data.dial.points;
    var threshold = data.facts.threshold;
    var moveLine = function () {};

    C.mount('chart-cost', function (root, width, height) {
      var colours = C.colours();
      var left = 74;
      var right = width - 10;
      var top = 12;
      var bottom = height - 30;
      var x = C.linear(0, 1, left, right);
      var y = C.log(10, 200000, bottom, top);

      C.yAxis(root, y, left, [10, 100, 1000, 10000, 100000], f.int, right);
      C.xAxis(root, x, bottom, [0, 0.25, 0.5, 0.75, 1], function (v) { return String(v); }, left, right);

      var path = curve.threshold.map(function (t, index) {
        return (index ? 'L' : 'M') + x(t).toFixed(1) + ',' + y(curve.cost[index]).toFixed(1);
      }).join('');
      C.svg('path', { d: path, fill: 'none', stroke: colours.mute, 'stroke-width': 1.5 }, root);

      var best = curve.chosen_index;
      var bx = x(curve.threshold[best]);
      var by = y(curve.chosen_cost);
      C.svg('circle', { cx: bx, cy: by, r: 5, fill: colours.broken }, root);
      C.annotate(root, bx + 3, by - 4, Math.min(bx + 50, right - 110), y(600),
        ['lowest: ' + f.int(curve.chosen_cost), 'at ' + f.score(curve.threshold[best])]);
      C.annotate(root, x(0) + 3, y(curve.cost[0]) + 2, x(0.3), y(25000),
        ['flag every block:', f.int(curve.cost[0])]);

      var line = C.svg('line', { y1: top, y2: bottom, stroke: colours.ink, 'stroke-width': 2 }, root);
      moveLine = function () {
        line.setAttribute('x1', x(threshold));
        line.setAttribute('x2', x(threshold));
      };
      moveLine();

      var hover = curve.threshold.map(function (t, index) {
        var point = points[index];
        return { x: x(t), y: y(curve.cost[index]),
          text: 'cut-off ' + f.score(t) + '\ncost ' + f.int(curve.cost[index]) + ' = 10 × ' + f.int(point.fn) +
            ' missed + ' + f.int(point.fp) + ' false alarms' };
      });
      C.interact(root, hover, { mode: 'x', label: 'Validation cost at each cut-off', start: best });
    });

    document.addEventListener('radar:threshold', function (event) {
      threshold = event.detail.threshold;
      moveLine();
    });

    C.setTitle('chart-cost',
      'Cost bottoms out at ' + f.int(curve.chosen_cost) + ' at a cut-off of ' + f.score(curve.threshold[curve.chosen_index]) +
        '; flagging every block would cost ' + f.int(curve.cost[0]),
      'Validation cost against cut-off for ' + curve.threshold.length + ' cut-offs between 0 and 1. The minimum is ' +
        curve.chosen_cost + ' at ' + curve.threshold[curve.chosen_index] + '. At 0 the cost is ' + curve.cost[0] +
        ' and at 1 it is ' + curve.cost[curve.cost.length - 1] + '.');
  });
})();
