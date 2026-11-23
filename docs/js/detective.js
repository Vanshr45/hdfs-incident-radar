/*
 * detective.js: a guessing game on real test blocks.
 *
 * Rounds come in shuffled decks of ten: four broken blocks and four healthy
 * blocks that the model judged correctly, plus two of the model's real
 * mistakes. So about half the rounds are broken and the game is not trivial.
 */
(function () {
  'use strict';

  var PER_DECK = { broken: 4, healthy: 4, mistakes: 2 };

  function shuffle(list) {
    var copy = list.slice();
    for (var i = copy.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var swap = copy[i];
      copy[i] = copy[j];
      copy[j] = swap;
    }
    return copy;
  }

  Radar.register('detective', function (data) {
    var all = data.blocks.blocks;
    var pools = {
      broken: all.filter(function (b) { return b.in_sample && b.label === 1 && !b.wrong; }),
      healthy: all.filter(function (b) { return b.in_sample && b.label === 0 && !b.wrong; }),
      mistakes: all.filter(function (b) { return b.wrong; })
    };
    var mistakeQueue = shuffle(pools.mistakes);

    var diaryList = document.getElementById('detective-diary');
    var roundLabel = document.getElementById('detective-round');
    var scoreLabel = document.getElementById('detective-score');
    var reveal = document.getElementById('detective-reveal');
    var nextButton = document.getElementById('detective-next');
    var choiceButtons = Array.prototype.slice.call(document.querySelectorAll('#detective-choices button'));

    var deck = [];
    var round = 0;
    var played = 0;   // rounds answered so far
    var yourCorrect = 0;
    var modelCorrect = 0;
    var current = null;

    function newDeck() {
      var cards = shuffle(pools.broken).slice(0, PER_DECK.broken)
        .concat(shuffle(pools.healthy).slice(0, PER_DECK.healthy));
      for (var i = 0; i < PER_DECK.mistakes; i++) {
        if (mistakeQueue.length === 0) mistakeQueue = shuffle(pools.mistakes);
        cards.push(mistakeQueue.pop());
      }
      return shuffle(cards);
    }

    function updateScore() {
      scoreLabel.textContent = 'You ' + yourCorrect + ' of ' + played + ' · Model ' + modelCorrect + ' of ' + played;
    }

    function nextRound() {
      if (deck.length === 0) deck = newDeck();
      current = { block: deck.pop(), answered: false };
      round += 1;
      roundLabel.textContent = 'Block ' + round + ' · ' + current.block.id;
      Radar.diary.render(diaryList, current.block.counts, false);
      reveal.textContent = '';
      choiceButtons.forEach(function (button) {
        button.disabled = false;
        button.classList.remove('is-chosen');
      });
      nextButton.hidden = true;
      updateScore();
    }

    function answer(guess, button) {
      if (current.answered) return;
      current.answered = true;
      played += 1;
      var block = current.block;
      var youRight = guess === block.label;
      if (youRight) yourCorrect += 1;
      if (!block.wrong) modelCorrect += 1;

      button.classList.add('is-chosen');
      choiceButtons.forEach(function (b) { b.disabled = true; });
      Radar.diary.render(diaryList, block.counts, true);

      reveal.textContent = '';
      var yours = Radar.element('p', null, 'You said ' + (guess === 1 ? 'something is wrong' : 'it looks healthy') +
        '. ' + (youRight ? 'You were right.' : 'You were wrong.'));
      yours.style.fontWeight = '700';
      reveal.appendChild(yours);
      reveal.appendChild(Radar.diary.verdict(block));
      if (block.wrong) {
        reveal.appendChild(Radar.element('p', 'note', 'This is one of the ' + data.blocks.mistakes +
          ' test blocks the model got wrong. Orange steps differ from the typical healthy block.'));
      } else {
        reveal.appendChild(Radar.element('p', 'note', 'Orange steps differ from the typical healthy block.'));
      }
      nextButton.hidden = false;
      updateScore();
      nextButton.focus();
    }

    choiceButtons.forEach(function (button) {
      button.addEventListener('click', function () {
        answer(Number(button.getAttribute('data-guess')), button);
      });
    });
    nextButton.addEventListener('click', nextRound);

    nextRound();
  });
})();
