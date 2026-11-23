/*
 * charts/importance.js: the random forest's impurity-based feature importance
 * for its ten most-used event types, with plain-English names.
 */
(function () {
  'use strict';

  var SHOWN = 10;

  Radar.register('importance', function (data) {
    var C = Radar.chart;
    var f = Radar.format;
    var bars = data.charts.importance;
    var top = bars.slice(0, SHOWN);
    var rest = bars.slice(SHOWN).reduce(function (sum, bar) { return sum + bar.importance; }, 0);

    C.mount('chart-importance', function (root, width) {
      var colours = C.colours();
      var rowHeight = 50;
      var valueRoom = 56;
      var x = C.linear(0, top[0].importance, 0, width - valueRoom);
      var points = [];

      top.forEach(function (bar, index) {
        var y = index * rowHeight;
        var first = index === 0;
        C.text(root, 0, y + 16, bar.name, { class: 'serif' });
        C.svg('rect', { x: 0, y: y + 24, width: Math.max(1, x(bar.importance)), height: 14,
          fill: first ? colours.broken : colours.healthy }, root);
        C.text(root, x(bar.importance) + 6, y + 36, f.percent(bar.importance, 1), { class: first ? 'hot' : 'ink' });
        points.push({ x: x(bar.importance) / 2, y: y + 31,
          text: bar.name + ' (' + bar.id + ')\n' + f.percent(bar.importance, 2) + ' of all splitting gain' });
      });
      var y = top.length * rowHeight + 18;
      C.text(root, 0, y, 'The other ' + (bars.length - SHOWN) + ' events share ' + f.percent(rest, 1) + '.');
      C.resize(root, y + 10);

      C.interact(root, points, { mode: 'y', label: 'Random forest feature importance' });
    });

    var lead = top[0];
    var share = lead.importance > 0.25 ? 'more than a quarter' : f.percent(lead.importance, 0);
    C.setTitle('chart-importance',
      'One clue carries ' + share + ' of the forest’s splitting gain: “' + lead.name + '” (' + f.percent(lead.importance, 1) + ')',
      'Impurity-based importance of the ten most important events: ' + top.map(function (bar) {
        return bar.name + ' ' + f.percent(bar.importance, 1);
      }).join('; ') + '. The other ' + (bars.length - SHOWN) + ' events share ' + f.percent(rest, 1) + '.');
  });
})();
