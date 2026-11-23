/*
 * charts/pipeline.js: one real test block followed from raw log lines to the
 * alarm. Every line, count and score comes from charts.json (pipeline).
 */
(function () {
  'use strict';

  var C = null;
  var CHAR_WIDTH = 8.45; // width of one 14px monospace character, roughly

  // Fit a long log line into maxChars, keeping the block id visible.
  function windowAround(line, id, maxChars) {
    if (line.length <= maxChars) return line;
    var at = line.indexOf(id);
    var start = Math.max(0, Math.min(at - Math.floor((maxChars - id.length) / 2), line.length - maxChars + 1));
    var piece = line.slice(start, start + maxChars - 2);
    return (start > 0 ? '…' : '') + piece + '…';
  }

  // Draw one log line with the block id in orange.
  function logLine(parent, x, y, content, id) {
    var node = C.text(parent, x, y, '', { class: 'ink' });
    var at = content.indexOf(id);
    var parts = at === -1 ? [[content, false]] :
      [[content.slice(0, at), false], [id, true], [content.slice(at + id.length), false]];
    parts.forEach(function (part) {
      var span = C.svg('tspan', part[1] ? { class: 'hot' } : {}, node);
      span.textContent = part[0];
    });
  }

  function stageLabel(parent, y, number, label) {
    C.text(parent, 0, y, number, { class: 'hot' });
    C.text(parent, 28, y, label, { class: 'serif' });
  }

  function arrow(parent, x, y1, y2) {
    C.svg('path', { class: 'leader', d: 'M' + x + ',' + y1 + 'L' + x + ',' + y2 + 'M' + (x - 4) + ',' + (y2 - 6) +
      'L' + x + ',' + y2 + 'L' + (x + 4) + ',' + (y2 - 6) }, parent);
  }

  Radar.register('pipeline', function (data) {
    C = Radar.chart;
    var f = Radar.format;
    var example = data.charts.pipeline;
    var threshold = data.facts.threshold;
    var columns = [];
    for (var n = 1; n <= data.facts.event_types; n++) columns.push('E' + n);

    document.querySelectorAll('[data-chart-fact="pipeline_id"]').forEach(function (node) {
      node.textContent = example.block_id;
    });

    // The plain-language note: how this block differs from the typical healthy one.
    var differences = data.events.events.filter(function (event) {
      return (example.counts[event.id] || 0) !== event.healthy_median;
    }).map(function (event) {
      return '“' + event.name + '” ×' + (example.counts[event.id] || 0) + ' (usually ' + event.healthy_median + ')';
    });
    document.getElementById('pipeline-note').textContent = 'Labelled broken. Against a typical healthy block it differs only in ' +
      differences.join(', ') + '. Every other step matches a typical healthy block.';

    C.mount('chart-pipeline', function (root, width) {
      var colours = C.colours();
      var maxChars = Math.floor((width - 16) / CHAR_WIDTH);

      stageLabel(root, 16, '1', 'Raw log lines (' + f.int(example.line_count) + ' mention this block)');
      C.svg('rect', { x: 0, y: 28, width: width, height: 116, fill: colours.paper, stroke: colours.rule }, root);
      example.first_lines.forEach(function (line, index) {
        logLine(root, 8, 50 + index * 21, windowAround(line, example.block_id, maxChars), example.block_id);
      });
      C.text(root, 8, 134, '… and ' + f.int(example.line_count - example.first_lines.length) + ' more lines');
      arrow(root, 14, 152, 178);

      stageLabel(root, 200, '2', 'Count each of the ' + columns.length + ' event types');
      var cell = Math.min(24, Math.floor((width - 2) / columns.length));
      columns.forEach(function (id, index) {
        var count = example.counts[id] || 0;
        var x = index * cell;
        C.svg('rect', { x: x, y: 214, width: cell - 2, height: 26,
          fill: count > 0 ? colours.ink : colours.healthySoft }, root);
        if (count > 0 && cell >= 11) {
          C.text(root, x + (cell - 2) / 2, 232, String(count), { 'text-anchor': 'middle', fill: colours.paper,
            style: 'fill:' + colours.paper });
        }
      });
      C.text(root, 0, 258, columns[0]);
      C.text(root, columns.length * cell - 2, 258, columns[columns.length - 1], { 'text-anchor': 'end' });
      var counted = Object.keys(example.counts).sort(function (a, b) { return a.slice(1) - b.slice(1); })
        .map(function (id) { return id + ' ×' + example.counts[id]; }).join(' · ');
      C.wrapWords(counted, maxChars).forEach(function (line, index) {
        C.text(root, 0, 280 + index * 18, line, { class: 'ink' });
      });
      arrow(root, 14, 316, 342);

      stageLabel(root, 364, '3', 'Random forest suspicion score');
      var track = C.linear(0, 1, 0, width - 4);
      C.svg('line', { x1: 0, x2: width - 4, y1: 392, y2: 392, stroke: colours.rule, 'stroke-width': 6 }, root);
      C.svg('line', { x1: track(threshold), x2: track(threshold), y1: 382, y2: 402, stroke: colours.ink }, root);
      C.text(root, track(threshold), 420, 'cut-off ' + f.score(threshold), { 'text-anchor': 'start' });
      C.svg('circle', { cx: track(example.score), cy: 392, r: 7, fill: colours.broken }, root);
      C.text(root, track(example.score), 378, 'score ' + f.score(example.score), { 'text-anchor': 'end', class: 'hot' });
      C.text(root, 0, 420, '0');
      arrow(root, 14, 436, 462);

      stageLabel(root, 484, '4', 'Alarm');
      var rings = example.score >= threshold;
      C.text(root, 0, 512, f.score(example.score) + (rings ? ' ≥ ' : ' < ') + f.score(threshold) +
        (rings ? ', so the alarm rings.' : ', so the alarm stays quiet.'), { class: rings ? 'hot' : 'ink' });
      C.text(root, 0, 536, 'The label says: ' + (example.label === 1 ? 'broken' : 'healthy') + '.', { class: 'ink' });
    });

    C.setTitle('chart-pipeline', 'One real block, from log lines to alarm',
      'Block ' + example.block_id + ' has ' + example.line_count + ' log lines. Counted per event type it becomes ' +
      Object.keys(example.counts).map(function (id) { return id + ' ' + example.counts[id]; }).join(', ') +
      '. The random forest scores it ' + f.score(example.score) + ', above the cut-off of ' + f.score(threshold) +
      ', so the alarm rings. Its label is ' + (example.label === 1 ? 'broken' : 'healthy') + '.');
  });
})();
