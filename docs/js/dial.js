/*
 * dial.js: the alarm threshold slider.
 *
 * The slider walks over the ~200 real thresholds in dial.json (validation set,
 * random forest). Left is relaxed (high threshold, few alarms), right is jumpy
 * (low threshold, many alarms). Every change is announced to the score
 * histogram and cost curve with a 'radar:threshold' event.
 *
 * Releasing the thumb within SNAP positions of my chosen cut-off snaps it there,
 * and a small tick under the track marks that spot.
 */
(function () {
  'use strict';

  var SNAP = 2;
  var THUMB = 16; // approximate width of the range thumb in pixels

  Radar.register('dial', function (data) {
    var f = Radar.format;
    var dial = data.dial;
    var points = dial.points; // sorted by threshold, low to high
    var last = points.length - 1;

    var slider = document.getElementById('dial-slider');
    var tick = document.getElementById('slider-tick');
    var thresholdText = document.getElementById('dial-threshold');
    var foundText = document.getElementById('meter-found-text');
    var falseText = document.getElementById('meter-false-text');
    var foundFill = document.getElementById('meter-found');
    var falseFill = document.getElementById('meter-false');
    var sentence = document.getElementById('dial-sentence');
    var chosenButton = document.getElementById('dial-chosen');

    // Slider position 0 is the highest threshold (relaxed); the last position is 0 (jumpy).
    var chosenPosition = last - dial.chosen_index;
    function pointIndexFor(sliderValue) {
      return last - sliderValue;
    }

    slider.max = String(last);
    slider.value = String(chosenPosition);
    // The thumb centre travels from THUMB/2 to (width - THUMB/2), so the tick follows the same path.
    tick.style.left = 'calc(' + THUMB / 2 + 'px + (100% - ' + THUMB + 'px) * ' + (chosenPosition / last) + ')';

    function falseAlarmRate(point) {
      if (point.fp === 0) return 'It never rings for a healthy block.';
      if (point.fp === dial.negatives) return 'It also rings for every one of the ' + f.int(dial.negatives) + ' healthy blocks.';
      var perThousand = point.fp / dial.negatives * 1000;
      var rate = perThousand < 1 ? 'fewer than 1' : 'about ' + f.int(perThousand);
      var blocks = point.fp === 1 ? ' healthy block, ' : ' healthy blocks, ';
      return 'It also rings for ' + f.int(point.fp) + blocks + rate + ' in every 1,000.';
    }

    function describe(point, isChosen) {
      var slipped = point.fn === 0 ? 'none slip through' :
        f.int(point.fn) + (point.fn === 1 ? ' slips through' : ' slip through');
      var text = 'At this setting the alarm finds ' + f.int(point.tp) + ' broken blocks and ' + slipped + '. ' +
        falseAlarmRate(point);
      if (isChosen) text += ' This is the setting I chose.';
      return text;
    }

    function setWidth(fill, share) {
      fill.style.width = share * 100 + '%';
      // Keep a tiny but non-zero count visible.
      fill.style.minWidth = share > 0 ? '2px' : '0';
    }

    function update() {
      var index = pointIndexFor(Number(slider.value));
      var point = points[index];
      var isChosen = index === dial.chosen_index;

      thresholdText.textContent = 'Alarm rings at a score of ' + f.score(point.t) + ' or above';
      foundText.textContent = f.int(point.tp) + ' of ' + f.int(dial.positives) + ' found';
      falseText.textContent = f.int(point.fp) + ' of ' + f.int(dial.negatives);
      setWidth(foundFill, point.tp / dial.positives);
      setWidth(falseFill, point.fp / dial.negatives);
      sentence.textContent = describe(point, isChosen);
      slider.setAttribute('aria-valuetext', 'cut-off ' + f.score(point.t) + ', finds ' + f.int(point.tp) +
        ' of ' + f.int(dial.positives) + ' broken blocks, ' + f.int(point.fp) + ' false alarms');
      chosenButton.disabled = isChosen;
      document.dispatchEvent(new CustomEvent('radar:threshold', { detail: { threshold: point.t } }));
    }

    function snapToChosen() {
      slider.value = String(chosenPosition);
      update();
    }

    slider.addEventListener('input', update);
    // When a drag ends near my cut-off, it lands exactly on it. Keyboard steps never snap,
    // otherwise one arrow press away from the cut-off would jump straight back.
    var dragging = false;
    slider.addEventListener('pointerdown', function () { dragging = true; });
    slider.addEventListener('keydown', function () { dragging = false; });
    slider.addEventListener('change', function () {
      if (!dragging) return;
      dragging = false;
      var distance = Math.abs(Number(slider.value) - chosenPosition);
      if (distance > 0 && distance <= SNAP) snapToChosen();
    });
    chosenButton.addEventListener('click', function () {
      snapToChosen();
      slider.focus();
    });
    update();
  });
})();
