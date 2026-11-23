/*
 * diary.js: draws block diaries as step lists, the typical healthy block,
 * the "how often each step shows up" dumbbell chart, and "Open a real diary".
 *
 * The diary drawing is shared with detective.js and mistakes.js through
 * Radar.diary.
 */
(function () {
  'use strict';

  var MAX_MARKS = 12; // longer counts end with "+N" so rows stay one line wide

  var events = [];      // all 29 events in diary order
  var threshold = 0;

  // A diary lists every step a healthy block normally has, plus any step this block had.
  function rowsFor(counts) {
    return events.filter(function (event) {
      return event.healthy_median > 0 || (counts[event.id] || 0) > 0;
    });
  }

  function marksFor(count, median) {
    var box = Radar.element('span', 'diary-marks');
    box.setAttribute('aria-hidden', 'true');
    var shown = Math.min(count, MAX_MARKS);
    for (var i = 0; i < shown; i++) box.appendChild(Radar.element('span', 'mark'));
    // Hollow squares for copies that a healthy block has but this one is missing.
    var missing = Math.min(Math.max(median - count, 0), MAX_MARKS);
    for (var j = 0; j < missing; j++) box.appendChild(Radar.element('span', 'mark mark-missing'));
    if (count > MAX_MARKS) box.appendChild(Radar.element('span', 'mark-more', '+' + Radar.format.int(count - MAX_MARKS)));
    return box;
  }

  // Draw a diary into an <ol>. With highlight on, steps that differ from the typical healthy block turn orange.
  function render(list, counts, highlight) {
    list.textContent = '';
    var gapShown = false;
    rowsFor(counts).forEach(function (event) {
      if (event.phase === 'later' && !gapShown) {
        list.appendChild(Radar.element('li', 'diary-gap', 'later, when the file is removed'));
        gapShown = true;
      }
      var count = counts[event.id] || 0;
      var differs = highlight && count !== event.healthy_median;
      var row = Radar.element('li', 'diary-row' + (differs ? ' differs' : ''));
      row.appendChild(Radar.element('span', 'diary-name', event.name));
      row.appendChild(marksFor(count, highlight ? event.healthy_median : 0));
      var countText = '×' + Radar.format.int(count);
      if (differs) countText += ' (usually ' + event.healthy_median + ')';
      row.appendChild(Radar.element('span', 'diary-count', countText));
      list.appendChild(row);
    });
  }

  function typicalCounts() {
    var counts = {};
    events.forEach(function (event) {
      if (event.healthy_median > 0) counts[event.id] = event.healthy_median;
    });
    return counts;
  }

  // Sentences under a revealed block: the truth, the model's score and decision, and the training history.
  function verdict(block) {
    var f = Radar.format;
    var box = Radar.element('div', 'verdict' + (block.wrong ? ' is-wrong' : ''));
    var truth = block.label === 1 ? 'broken' : 'healthy';
    var decision = block.flagged === 1 ? 'raised the alarm' : 'stayed quiet';
    box.appendChild(Radar.element('p', null, 'Truth, from the engineers\' labels: ' + truth + '.'));
    box.appendChild(Radar.element('p', null, 'Model\'s suspicion score: ' + f.score(block.score) +
      '. The alarm rings at ' + f.score(threshold) + ' or above, so it ' + decision + '.'));
    var result = Radar.element('p', null, block.wrong ? 'The model was wrong.' : 'The model was right.');
    result.style.fontWeight = '700';
    if (block.wrong) result.className = 'broken-text';
    box.appendChild(result);
    box.appendChild(Radar.element('p', 'note', historyText(block)));
    return box;
  }

  function historyText(block) {
    var f = Radar.format;
    var seen = block.seen_healthy + block.seen_broken;
    if (seen === 0) return 'This exact diary never appeared among the training blocks.';
    return 'This exact diary appeared ' + f.int(seen) + ' times among the training blocks: ' +
      f.int(block.seen_healthy) + ' healthy, ' + f.int(block.seen_broken) + ' broken.';
  }

  function drawTypical() {
    render(document.getElementById('typical-diary'), typicalCounts(), false);
  }

  function drawDumbbell(eventData) {
    var holder = document.getElementById('dumbbell');
    var byId = {};
    events.forEach(function (event) { byId[event.id] = event; });
    var titles = {
      missing_in_broken: 'Missing from broken blocks',
      showing_in_broken: 'Showing up in broken blocks'
    };
    Object.keys(titles).forEach(function (groupKey) {
      holder.appendChild(Radar.element('p', 'dumbbell-title', titles[groupKey]));
      var scale = Radar.element('div', 'scale-labels');
      scale.setAttribute('aria-hidden', 'true');
      scale.appendChild(Radar.element('span', null, '0%'));
      scale.appendChild(Radar.element('span', null, '100%'));
      holder.appendChild(scale);

      var list = Radar.element('ul', 'dumbbell-group');
      eventData.dumbbell_groups[groupKey].forEach(function (id) {
        var event = byId[id];
        var row = Radar.element('li', 'dumbbell-row');
        row.appendChild(Radar.element('div', 'dumbbell-name', event.name));

        var track = Radar.element('div', 'dumbbell-track');
        track.setAttribute('aria-hidden', 'true');
        var low = Math.min(event.healthy_share, event.broken_share) * 100;
        var high = Math.max(event.healthy_share, event.broken_share) * 100;
        var line = Radar.element('span', 'dumbbell-line');
        line.style.left = low + '%';
        line.style.width = (high - low) + '%';
        track.appendChild(line);
        var healthyDot = Radar.element('span', 'dumbbell-dot healthy');
        healthyDot.style.left = event.healthy_share * 100 + '%';
        var brokenDot = Radar.element('span', 'dumbbell-dot broken');
        brokenDot.style.left = event.broken_share * 100 + '%';
        track.appendChild(healthyDot);
        track.appendChild(brokenDot);
        row.appendChild(track);

        row.appendChild(Radar.element('div', 'dumbbell-value',
          'healthy ' + Radar.format.share(event.healthy_share) + ' → broken ' + Radar.format.share(event.broken_share)));
        list.appendChild(row);
      });
      holder.appendChild(list);
    });
  }

  // Show one block's diary and verdict in the panel under "Open a real diary".
  function showBlock(block, source) {
    var panel = document.getElementById('real-diary');
    panel.textContent = '';
    panel.appendChild(Radar.element('p', 'note', 'Test block ' + block.id + '. ' + source));
    var list = Radar.element('ol', 'diary');
    list.setAttribute('aria-label', 'Diary of block ' + block.id);
    render(list, block.counts, true);
    panel.appendChild(list);
    panel.appendChild(verdict(block));
  }

  function setUpRealDiary(blocks) {
    var button = document.getElementById('open-diary');
    var sample = blocks.blocks.filter(function (block) { return block.in_sample; });
    var broken = sample.filter(function (block) { return block.label === 1; });
    var healthy = sample.filter(function (block) { return block.label === 0; });
    var lastId = null;

    button.addEventListener('click', function () {
      // Broken blocks are rare, so pick from each group half the time; otherwise a visitor would almost never see one.
      var block;
      do {
        var pool = Math.random() < 0.5 ? broken : healthy;
        block = pool[Math.floor(Math.random() * pool.length)];
      } while (block.id === lastId);
      lastId = block.id;
      showBlock(block, 'One of ' + Radar.format.int(blocks.sample_size) + ' sampled from the test set.');
      button.textContent = 'Open another diary';
    });
  }

  // A margin note listing the event names I am unsure of, straight from events.json.
  function namesNote(events) {
    var unsure = events.filter(function (event) { return event.name_unsure; });
    document.getElementById('names-note').textContent = 'The step names are mine. Loghub only gives template text such as “' +
      events[0].template + '”. I am least sure of ' + unsure.map(function (event) {
        return event.id + ' (“' + event.name + '”)';
      }).join(', ') + '.';
  }

  Radar.diary = { render: render, verdict: verdict, history: historyText, show: showBlock };

  Radar.register('diary', function (data) {
    events = data.events.events.slice().sort(function (a, b) { return a.order - b.order; });
    threshold = data.facts.threshold;
    drawTypical();
    namesNote(events);
    drawDumbbell(data.events);
    setUpRealDiary(data.blocks);
  });
})();
