/*
 * rules.js: two or three rules from the small explanation tree, the plain
 * wording next to the rule exactly as scikit-learn's export_text printed it.
 */
(function () {
  'use strict';

  Radar.register('rules', function (data) {
    var f = Radar.format;
    var list = document.getElementById('rule-list');
    var names = {};
    data.events.events.forEach(function (event) { names[event.id] = event.name; });
    var usedIds = [];

    data.rules.rules.forEach(function (rule) {
      var item = Radar.element('li', 'rule-item');
      var plainBox = Radar.element('div');
      plainBox.appendChild(Radar.element('p', 'rule-plain', rule.plain));
      var majority = rule.verdict === 'broken' ? rule.training_broken : rule.training_healthy;
      plainBox.appendChild(Radar.element('p', 'note', f.int(rule.training_blocks) + ' training blocks follow this rule; ' +
        f.int(majority) + ' of them were ' + rule.verdict + '.'));
      item.appendChild(plainBox);

      var original = Radar.element('code', 'rule-original', 'if ' + rule.original + ' then ' + rule.verdict);
      item.appendChild(original);
      list.appendChild(item);

      (rule.original.match(/E\d+/g) || []).forEach(function (id) {
        if (usedIds.indexOf(id) === -1) usedIds.push(id);
      });
    });

    document.getElementById('rule-legend').textContent = 'In the printed rules: ' + usedIds.map(function (id) {
      return id + ' = ' + names[id];
    }).join('; ') + '. Counts are whole numbers, so "<= 2.50" means at most 2.';
  });
})();
