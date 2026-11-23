/*
 * haystack.js: the sticky grid of 1,000 squares that tells the scale story.
 *
 * Step 0: all squares healthy.
 * Step 1: the broken squares appear, gathered in the top rows.
 * Step 2: the same squares move to fixed random positions.
 *
 * The active step is checked on scroll inside requestAnimationFrame:
 * it is the last step whose top is above 66% of the window height.
 * (IntersectionObserver alone can skip steps on a fast flick.)
 */
(function () {
  'use strict';

  var COLUMNS = 40;
  var ROWS = 25;
  var CELL = 10;   // grid spacing in SVG units
  var SQUARE = 8;  // square size, leaving a 2-unit gap
  var TRIGGER = 0.66;
  var SVG_NS = 'http://www.w3.org/2000/svg';

  function cellPosition(index) {
    return {
      x: (index % COLUMNS) * CELL + (CELL - SQUARE) / 2,
      y: Math.floor(index / COLUMNS) * CELL + (CELL - SQUARE) / 2
    };
  }

  function makeSquare(className) {
    var square = document.createElementNS(SVG_NS, 'rect');
    square.setAttribute('class', className);
    square.setAttribute('width', SQUARE);
    square.setAttribute('height', SQUARE);
    return square;
  }

  // Pick `count` different cells with a fixed seed, so every visitor sees the same layout.
  function scatteredCells(count) {
    var random = Radar.seededRandom(42);
    var cells = [];
    for (var i = 0; i < COLUMNS * ROWS; i++) cells.push(i);
    for (var j = 0; j < count; j++) {
      var pick = j + Math.floor(random() * (cells.length - j));
      var swap = cells[j];
      cells[j] = cells[pick];
      cells[pick] = swap;
    }
    return cells.slice(0, count).sort(function (a, b) { return a - b; });
  }

  Radar.register('haystack', function (data) {
    var svg = document.getElementById('haystack-svg');
    var alt = document.getElementById('haystack-alt');
    var steps = Array.prototype.slice.call(document.querySelectorAll('#haystack .step'));
    var facts = data.derived;
    var brokenCount = facts.broken_squares;
    var f = Radar.format;

    // Healthy background squares.
    var background = document.createDocumentFragment();
    for (var i = 0; i < COLUMNS * ROWS; i++) {
      var cell = makeSquare('cell');
      var position = cellPosition(i);
      cell.setAttribute('x', position.x);
      cell.setAttribute('y', position.y);
      background.appendChild(cell);
    }
    svg.appendChild(background);

    // Orange tokens drawn on top; they move between the two layouts.
    var topCells = [];
    for (var t = 0; t < brokenCount; t++) topCells.push(t);
    var randomCells = scatteredCells(brokenCount);
    var tokens = topCells.map(function () {
      var token = makeSquare('token');
      svg.appendChild(token);
      return token;
    });

    var altTexts = [
      'A grid of ' + f.int(facts.grid_squares) + ' pale squares. Each stands for about ' +
        f.int(facts.blocks_per_square) + ' of the ' + f.int(facts.total_blocks) + ' blocks.',
      f.int(brokenCount) + ' of the ' + f.int(facts.grid_squares) + ' squares are orange and gathered in the top row: ' +
        'the ' + f.int(facts.anomalous_blocks) + ' blocks labelled broken.',
      'The same ' + f.int(brokenCount) + ' orange squares are now scattered across the grid among ' +
        f.int(facts.grid_squares - brokenCount) + ' pale ones.'
    ];

    var currentStep = -1;

    function showStep(stepIndex) {
      if (stepIndex === currentStep) return;
      currentStep = stepIndex;
      var cells = stepIndex === 2 ? randomCells : topCells;
      tokens.forEach(function (token, index) {
        var position = cellPosition(cells[index]);
        token.style.transform = 'translate(' + position.x + 'px, ' + position.y + 'px)';
        token.style.opacity = stepIndex === 0 ? '0' : '1';
      });
      steps.forEach(function (step, index) {
        step.classList.toggle('is-active', index === stepIndex);
      });
      // Exposed for the automated checks: which step is shown and which cells are orange.
      svg.setAttribute('data-step', String(stepIndex));
      svg.setAttribute('data-orange', stepIndex === 0 ? '' : cells.join(','));
      alt.textContent = altTexts[stepIndex];
    }

    function activeStep() {
      var line = window.innerHeight * TRIGGER;
      var active = 0;
      steps.forEach(function (step, index) {
        if (step.getBoundingClientRect().top < line) active = index;
      });
      return active;
    }

    var waiting = false;
    function onScroll() {
      if (waiting) return;
      waiting = true;
      window.requestAnimationFrame(function () {
        waiting = false;
        showStep(activeStep());
      });
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    showStep(activeStep());
  });
})();
