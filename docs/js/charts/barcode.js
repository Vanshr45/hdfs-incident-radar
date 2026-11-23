/*
 * charts/barcode.js: about 300 real test blocks drawn as vertical strips,
 * one row per event type, darker for higher counts (capped at 9).
 * Healthy strips are grey, broken strips orange. Selecting a strip opens that
 * block's diary below the wall.
 */
(function () {
  'use strict';

  var STRIP = 5;      // strip width in pixels
  var GAP = 1;        // gap between strips
  var CELL = 3;       // height of one event row
  var ROW_GAP = 14;   // space between wrapped rows of strips
  var LABEL = 24;     // space for a group label

  function distinctDiaries(strips) {
    var seen = {};
    strips.forEach(function (strip) { seen[strip.cells.join(',')] = true; });
    return Object.keys(seen).length;
  }

  Radar.register('barcode', function (data) {
    var C = Radar.chart;
    var f = Radar.format;
    var wall = data.charts.barcodes;
    var blocks = data.blocks.blocks;
    var healthy = wall.strips.filter(function (strip) { return blocks[strip.block].label === 0; });
    var broken = wall.strips.filter(function (strip) { return blocks[strip.block].label === 1; });
    var selected = -1;

    C.mount('chart-barcode', function (root, width) {
      var colours = C.colours();
      var perRow = Math.max(1, Math.floor((width + GAP) / (STRIP + GAP)));
      var stripHeight = wall.order.length * CELL;
      var points = [];
      var y = 0;

      [[healthy, 'healthy', colours.mute, colours.healthySoft], [broken, 'broken', colours.broken, colours.brokenSoft]]
        .forEach(function (group) {
          var strips = group[0];
          C.text(root, 0, y + 16, f.int(strips.length) + ' ' + group[1] + ' · ' + f.int(distinctDiaries(strips)) +
            ' different diaries', { class: group[1] === 'broken' ? 'hot' : 'ink' });
          y += LABEL;
          strips.forEach(function (strip, index) {
            var column = index % perRow;
            var row = Math.floor(index / perRow);
            var x = column * (STRIP + GAP);
            var top = y + row * (stripHeight + ROW_GAP);
            C.svg('rect', { x: x, y: top, width: STRIP, height: stripHeight, fill: group[3] }, root);
            strip.cells.forEach(function (count, eventIndex) {
              if (count === 0) return;
              C.svg('rect', { x: x, y: top + eventIndex * CELL, width: STRIP, height: CELL, fill: group[2],
                'fill-opacity': 0.3 + 0.7 * count / wall.cap }, root);
            });
            var block = blocks[strip.block];
            points.push({ x: x + STRIP / 2, y: top + stripHeight / 2, block: block,
              text: (block.label === 1 ? 'Broken' : 'Healthy') + ' test block ' + block.id + '\nscore ' +
                f.score(block.score) + ' · ' + Radar.diary.history(block) });
          });
          y += Math.ceil(strips.length / perRow) * (stripHeight + ROW_GAP) + 6;
        });

      C.resize(root, y);

      var outline = C.svg('rect', { width: STRIP + 2, height: stripHeight + 2, fill: 'none', stroke: colours.ink,
        'stroke-width': 1.5, visibility: 'hidden' }, root);
      function mark(index) {
        if (index < 0) return;
        outline.setAttribute('x', points[index].x - STRIP / 2 - 1);
        outline.setAttribute('y', points[index].y - stripHeight / 2 - 1);
        outline.setAttribute('visibility', 'visible');
      }
      mark(selected);

      C.interact(root, points, {
        mode: 'xy',
        noMarker: true,
        label: 'Wall of ' + points.length + ' test block diaries',
        start: Math.max(selected, 0),
        onShow: function (index) { mark(index >= 0 ? index : selected); },
        onSelect: function (index) {
          selected = index;
          mark(index);
          Radar.diary.show(points[index].block, 'Selected on the wall above.');
        }
      });
    });

    var share = broken.length / wall.strips.length;
    var note = document.querySelector('#chart-barcode .chart-note');
    note.textContent = 'All ' + f.int(broken.length) + ' broken blocks in my ' + f.int(data.blocks.sample_size) +
      '-block test sample, plus ' + f.int(healthy.length) + ' random healthy ones. Broken blocks are over-represented here (' +
      f.percent(share, 0) + ' of strips, against ' + f.percent(data.facts.anomaly_ratio, 1) + ' in the log). Counts above ' +
      wall.cap + ' are drawn as ' + wall.cap + '.';

    C.setTitle('chart-barcode',
      f.int(healthy.length) + ' healthy blocks use just ' + f.int(distinctDiaries(healthy)) + ' different diaries; ' +
        f.int(broken.length) + ' broken blocks need ' + f.int(distinctDiaries(broken)),
      'A wall of ' + wall.strips.length + ' test blocks drawn as strips of ' + wall.order.length + ' event counts. The ' +
        healthy.length + ' healthy strips repeat a few patterns (' + distinctDiaries(healthy) + ' distinct); the ' +
        broken.length + ' broken strips are irregular (' + distinctDiaries(broken) + ' distinct).');
  });
})();
