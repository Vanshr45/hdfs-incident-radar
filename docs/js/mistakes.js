/*
 * mistakes.js: every test block the random forest got wrong, as a short
 * strip of the steps that differ from the typical healthy block.
 * The summary sentence is written and checked by src/export_web_data.py.
 */
(function () {
  'use strict';

  Radar.register('mistakes', function (data) {
    var f = Radar.format;
    var events = data.events.events.slice().sort(function (a, b) { return a.order - b.order; });
    var list = document.getElementById('mistake-list');
    document.getElementById('mistakes-summary').textContent = data.blocks.mistakes_summary;

    // Missed broken blocks first, then false alarms from the most to the least suspicious.
    var mistakes = data.blocks.blocks.filter(function (block) { return block.wrong; });
    mistakes.sort(function (a, b) {
      if (a.label !== b.label) return b.label - a.label;
      return b.score - a.score;
    });

    mistakes.forEach(function (block) {
      var item = Radar.element('li', 'mistake');
      var head = Radar.element('p', 'mistake-head');
      var title = block.label === 1 ? 'Broken, but the alarm stayed quiet' : 'Healthy, but the alarm rang';
      head.appendChild(Radar.element('strong', null, title));
      head.appendChild(document.createTextNode(' · score ' + f.score(block.score) + ' · ' + block.id));
      item.appendChild(head);

      var chips = Radar.element('ul', 'chips');
      chips.setAttribute('aria-label', 'Steps that differ from the typical healthy block');
      events.forEach(function (event) {
        var count = block.counts[event.id] || 0;
        if (count === event.healthy_median) return;
        chips.appendChild(Radar.element('li', 'chip differs',
          event.name + ' ×' + f.int(count) + ' (usually ' + event.healthy_median + ')'));
      });
      item.appendChild(chips);
      item.appendChild(Radar.element('p', 'note', 'Every other step as usual. ' + Radar.diary.history(block)));
      list.appendChild(item);
    });
  });
})();
