/*
 * figures.js: the original notebook figures (copied and resized by
 * src/export_web_data.py) as a captioned list. Selecting one opens it full
 * size in a <dialog>, which closes with Escape or the Close button.
 */
(function () {
  'use strict';

  Radar.register('figures', function (data) {
    var list = document.getElementById('figure-list');
    var dialog = document.getElementById('lightbox');
    var bigImage = document.getElementById('lightbox-image');
    var bigCaption = document.getElementById('lightbox-caption');

    data.charts.figures.forEach(function (figure) {
      var item = Radar.element('li', 'figure-item');
      var button = Radar.element('button', 'figure-open');
      button.type = 'button';
      button.setAttribute('aria-label', 'Enlarge: ' + figure.caption);
      var image = document.createElement('img');
      image.src = figure.file;
      image.alt = figure.caption;
      image.width = figure.width;
      image.height = figure.height;
      image.loading = 'lazy';
      image.decoding = 'async';
      button.appendChild(image);
      item.appendChild(button);

      var caption = Radar.element('p', 'figure-caption');
      caption.appendChild(Radar.element('span', 'note', 'Notebook ' + figure.notebook + ' · ' + figure.file.split('/').pop()));
      caption.appendChild(document.createTextNode(figure.caption));
      item.appendChild(caption);
      list.appendChild(item);

      button.addEventListener('click', function () {
        bigImage.src = figure.file;
        bigImage.alt = figure.caption;
        bigCaption.textContent = 'Notebook ' + figure.notebook + '. ' + figure.caption;
        dialog.showModal();
      });
    });

    // Clicking the dark backdrop also closes the figure.
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) dialog.close();
    });
  });
})();
