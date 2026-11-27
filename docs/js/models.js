/*
 * models.js: the dense validation table (one row per model, sortable by any
 * column, best row shaded) and the small test-set table for the three
 * models that were tested.
 */
(function () {
  'use strict';

  // key, header, how to format, which direction is "better" for the first click
  var COLUMNS = [
    ['name', 'Model', 'text', 'ascending'],
    ['validation_cost', 'Cost', 'int', 'ascending'],
    ['tp', 'Found', 'int', 'descending'],
    ['fn', 'Missed', 'int', 'ascending'],
    ['fp', 'False alarms', 'int', 'ascending'],
    ['precision', 'Precision', 'metric', 'descending'],
    ['recall', 'Recall', 'metric', 'descending'],
    ['f1', 'F1', 'metric', 'descending'],
    ['auc', 'AUC', 'metric6', 'descending'],
    ['log_loss', 'Log loss', 'metric', 'ascending']
  ];

  function formatCell(value, kind) {
    if (value === null || value === undefined) return '—';
    if (kind === 'int') return Radar.format.int(value);
    if (kind === 'metric') return value.toFixed(4);
    if (kind === 'metric6') return value.toFixed(6);
    return value;
  }

  Radar.register('models', function (data) {
    var table = document.getElementById('model-table');
    var headRow = table.querySelector('thead tr');
    var body = table.querySelector('tbody');
    var rows = data.models.validation.slice();
    var best = rows.filter(function (m) { return m.key === data.facts.best_model; })[0];
    var sortKey = 'validation_cost';
    var sortDirection = 'ascending';

    function drawBody() {
      var column = COLUMNS.filter(function (c) { return c[0] === sortKey; })[0];
      rows.sort(function (a, b) {
        var x = a[sortKey];
        var y = b[sortKey];
        // Empty values (log loss for scores that are not probabilities) always go last.
        if (x === null) return 1;
        if (y === null) return -1;
        var order = column[2] === 'text' ? String(x).localeCompare(String(y)) : x - y;
        return sortDirection === 'ascending' ? order : -order;
      });
      body.textContent = '';
      rows.forEach(function (model) {
        var row = document.createElement('tr');
        if (model === best) row.className = 'best';
        if (model.is_baseline) row.className = 'is-baseline';
        var name = Radar.element('th', null, model.name);
        name.setAttribute('scope', 'row');
        if (model === best) name.appendChild(Radar.element('span', 'model-desc', 'The model I kept. ' + model.description));
        else name.appendChild(Radar.element('span', 'model-desc', model.description));
        row.appendChild(name);
        COLUMNS.slice(1).forEach(function (c) {
          row.appendChild(Radar.element('td', 'num', formatCell(model[c[0]], c[2])));
        });
        body.appendChild(row);
      });
      headRow.querySelectorAll('th').forEach(function (th) {
        th.setAttribute('aria-sort', th.getAttribute('data-key') === sortKey ? sortDirection : 'none');
      });
    }

    COLUMNS.forEach(function (column) {
      var th = Radar.element('th', column[2] === 'text' ? null : 'num');
      th.setAttribute('scope', 'col');
      th.setAttribute('data-key', column[0]);
      var button = Radar.element('button', 'sort-button', column[1]);
      button.type = 'button';
      button.addEventListener('click', function () {
        if (sortKey === column[0]) {
          sortDirection = sortDirection === 'ascending' ? 'descending' : 'ascending';
        } else {
          sortKey = column[0];
          sortDirection = column[3];
        }
        drawBody();
      });
      th.appendChild(button);
      headRow.appendChild(th);
    });
    drawBody();

    var testBody = document.querySelector('#test-table tbody');
    data.models.test.forEach(function (model) {
      var row = document.createElement('tr');
      var name = Radar.element('th', null, model.name);
      name.setAttribute('scope', 'row');
      row.appendChild(name);
      [model.tp, model.fn, model.fp].forEach(function (value) {
        row.appendChild(Radar.element('td', 'num', Radar.format.int(value)));
      });
      testBody.appendChild(row);
    });
  });
})();
