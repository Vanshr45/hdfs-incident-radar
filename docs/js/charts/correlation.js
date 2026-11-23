/*
 * charts/correlation.js: lollipop chart of each event's correlation with the
 * anomaly label (training blocks, from notebook 02).
 */
(function () {
  'use strict';

  var MIN_ABS_R = 0.1;

  function signed(r) {
    return (r < 0 ? '−' : '+') + Math.abs(r).toFixed(2);
  }

  Radar.register('correlation', function (data) {
    var C = Radar.chart;
    var all = data.charts.correlation;
    var shown = all.filter(function (row) { return Math.abs(row.r) >= MIN_ABS_R; })
      .sort(function (a, b) { return b.r - a.r; });
    var hidden = all.length - shown.length;

    C.mount('chart-correlation', function (root, width, height) {
      var colours = C.colours();
      var wide = width >= 560;
      var nameWidth = wide ? 290 : 0;
      var rowHeight = wide ? 30 : 46;
      var top = 10;
      // Extra room on the negative side for the value labels next to the names.
      var x = C.linear(-0.85, 0.7, nameWidth + 10, width - 50);
      var points = [];

      C.resize(root, top + shown.length * rowHeight + 40);

      C.svg('line', { x1: x(0), x2: x(0), y1: top - 4, y2: top + shown.length * rowHeight, stroke: colours.ink }, root);
      shown.forEach(function (row, index) {
        var y = top + index * rowHeight + (wide ? rowHeight / 2 : rowHeight - 10);
        var colour = row.r > 0 ? colours.broken : colours.healthy;
        if (wide) {
          C.text(root, nameWidth, y + 5, row.name, { 'text-anchor': 'end', class: 'serif' });
        } else {
          C.text(root, 0, y - 12, row.name, { class: 'serif' });
        }
        C.svg('line', { x1: x(0), x2: x(row.r), y1: y, y2: y, stroke: colour, 'stroke-width': 2 }, root);
        C.svg('circle', { cx: x(row.r), cy: y, r: 5, fill: colour }, root);
        C.text(root, x(row.r) + (row.r > 0 ? 9 : -9), y + 5, signed(row.r),
          { 'text-anchor': row.r > 0 ? 'start' : 'end', class: row.r > 0 ? 'hot' : '' });
        points.push({ x: x(row.r), y: y, text: row.name + ' (' + row.id + ')\nr = ' + signed(row.r) });
      });

      var axisY = top + shown.length * rowHeight + 6;
      C.xAxis(root, x, axisY, wide ? [-0.6, -0.3, 0, 0.3, 0.6] : [-0.6, 0, 0.6], function (v) { return v === 0 ? '0' : signed(v); },
        x(-0.85), x(0.7));

      C.interact(root, points, { mode: 'y', label: 'Correlation of each event with the broken label' });
    });

    var byStrength = all.slice().sort(function (a, b) { return Math.abs(b.r) - Math.abs(a.r); });
    var a = byStrength[0];
    var b = byStrength[1];
    var title = a.r < 0 && b.r < 0 ?
      'Missing steps track the label more closely than strange ones: “' + a.name + '” and “' + b.name +
        '” both drop in broken blocks (r = ' + signed(a.r) + ', ' + signed(b.r) + ')' :
      'The strongest link is “' + a.name + '” (r = ' + signed(a.r) + ')';
    var alt = 'Correlation with the broken label for ' + shown.length + ' events: ' + shown.map(function (row) {
      return row.name + ' ' + signed(row.r);
    }).join('; ') + '. ' + hidden + ' more events have |r| under ' + MIN_ABS_R + '.';
    C.setTitle('chart-correlation', title, alt);
  });
})();
