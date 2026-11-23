/*
 * charts/base.js: small helpers shared by every hand-built SVG chart.
 *
 * Charts are drawn at the real pixel width of their container (no viewBox
 * scaling), so axis text stays 14px on a phone. They redraw when the width
 * changes. `Radar.chart.interact` adds hover, tap and keyboard reading.
 */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  function svg(tag, attributes, parent) {
    var node = document.createElementNS(NS, tag);
    Object.keys(attributes || {}).forEach(function (key) {
      node.setAttribute(key, attributes[key]);
    });
    if (parent) parent.appendChild(node);
    return node;
  }

  function text(parent, x, y, content, attributes) {
    var node = svg('text', Object.assign({ x: x, y: y }, attributes || {}), parent);
    node.textContent = content;
    return node;
  }

  // Maps a value in [d0, d1] to a pixel in [r0, r1].
  function linear(d0, d1, r0, r1) {
    var scale = function (value) { return r0 + (value - d0) / (d1 - d0) * (r1 - r0); };
    scale.domain = [d0, d1];
    return scale;
  }

  // Same, on a base-10 log scale (values must be above zero).
  function log(d0, d1, r0, r1) {
    var a = Math.log10(d0);
    var b = Math.log10(d1);
    var scale = function (value) { return r0 + (Math.log10(value) - a) / (b - a) * (r1 - r0); };
    scale.domain = [d0, d1];
    return scale;
  }

  // Short text lines for SVG labels, which do not wrap on their own.
  function wrapWords(content, maxChars) {
    var lines = [];
    var line = '';
    content.split(' ').forEach(function (word) {
      if ((line + ' ' + word).trim().length > maxChars && line) {
        lines.push(line);
        line = word;
      } else {
        line = (line + ' ' + word).trim();
      }
    });
    if (line) lines.push(line);
    return lines;
  }

  function xAxis(parent, scale, y, values, format, x0, x1) {
    var g = svg('g', { class: 'axis' }, parent);
    svg('line', { x1: x0, x2: x1, y1: y, y2: y }, g);
    values.forEach(function (value) {
      var x = scale(value);
      svg('line', { x1: x, x2: x, y1: y, y2: y + 5 }, g);
      // The last label is right-aligned so it never runs past the chart's edge.
      var anchor = x > x1 - 24 ? 'end' : 'middle';
      text(g, anchor === 'end' ? x + 4 : x, y + 20, format(value), { 'text-anchor': anchor });
    });
    return g;
  }

  function yAxis(parent, scale, x, values, format, gridTo) {
    var g = svg('g', { class: 'axis' }, parent);
    var grid = svg('g', { class: 'grid' }, parent);
    values.forEach(function (value) {
      var y = scale(value);
      if (gridTo !== undefined) svg('line', { x1: x, x2: gridTo, y1: y, y2: y }, grid);
      svg('line', { x1: x - 5, x2: x, y1: y, y2: y }, g);
      text(g, x - 8, y + 5, format(value), { 'text-anchor': 'end' });
    });
    parent.insertBefore(grid, parent.firstChild);
    return g;
  }

  // A hand-placed note: a thin leader line from a data point to a label.
  function annotate(parent, fromX, fromY, toX, toY, lines, anchor, className) {
    var g = svg('g', { class: 'annotation' }, parent);
    svg('path', { class: 'leader', d: 'M' + fromX + ',' + fromY + 'L' + toX + ',' + toY }, g);
    (Array.isArray(lines) ? lines : [lines]).forEach(function (line, index) {
      text(g, toX + (anchor === 'end' ? -4 : anchor === 'middle' ? 0 : 4), toY + 4 + index * 17, line,
        { 'text-anchor': anchor || 'start', class: className || 'ink' });
    });
    return g;
  }

  /*
   * Set up a chart inside <figure id="...">. `draw(svg, width, height)` must
   * build the whole chart; it runs again whenever the width changes.
   */
  function mount(figureId, draw) {
    var figure = document.getElementById(figureId);
    var body = figure.querySelector('.chart-body');
    var lastWidth = 0;

    function render(force) {
      var width = Math.floor(body.clientWidth);
      if (!force && width === lastWidth) return;
      lastWidth = width;
      var old = body.querySelector('svg');
      if (old) old.remove();
      var root = svg('svg', { width: width, height: body.clientHeight, class: 'chart-svg' });
      // A transparent backdrop, so pointer events reach empty parts of the chart.
      svg('rect', { width: width, height: body.clientHeight, fill: 'transparent' }, root);
      body.insertBefore(root, body.firstChild);
      draw(root, width, body.clientHeight);
    }

    var pending = false;
    var observer = new ResizeObserver(function () {
      if (pending) return;
      pending = true;
      window.requestAnimationFrame(function () {
        pending = false;
        render(false);
      });
    });
    observer.observe(body);
    render(true);
    var chart = { figure: figure, redraw: function () { render(true); } };
    mounted.push(chart);
    return chart;
  }

  // Every chart is redrawn in the new palette when theme.js announces a change.
  var mounted = [];
  document.addEventListener('radar:theme', function () {
    mounted.forEach(function (chart) { chart.redraw(); });
  });

  // Charts whose height depends on their width (rows that wrap) grow their container here.
  function resize(root, height) {
    root.setAttribute('height', height);
    root.firstChild.setAttribute('height', height);
    root.parentNode.style.height = height + 'px';
  }

  function setTitle(figureId, title, alt) {
    var figure = document.getElementById(figureId);
    figure.querySelector('.chart-title').textContent = title;
    figure.querySelector('.chart-alt').textContent = alt;
  }

  /*
   * Hover, tap and keyboard reading for a drawn chart.
   * points: [{x, y, text}] in pixels, in reading order.
   * options: {mode: 'x' | 'y' | 'xy', label, onSelect(index), start}
   */
  function interact(root, points, options) {
    var figure = root.closest('figure');
    var body = figure.querySelector('.chart-body');
    var live = figure.querySelector('.chart-live');
    var tip = body.querySelector('.chart-tip');
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'chart-tip';
      tip.hidden = true;
      body.appendChild(tip);
    }
    var marker = options.noMarker ? null : svg('circle', { r: 5, class: 'chart-marker', visibility: 'hidden' }, root);
    var current = -1;

    function place(point) {
      tip.textContent = point.text;
      tip.hidden = false;
      var width = tip.offsetWidth;
      var height = tip.offsetHeight;
      var left = Math.min(Math.max(point.x - width / 2, 0), body.clientWidth - width);
      var top = point.y - height - 12;
      if (top < 0) top = point.y + 14;
      tip.style.left = left + 'px';
      tip.style.top = top + 'px';
    }

    function show(index) {
      if (index < 0 || index >= points.length) return;
      current = index;
      var point = points[index];
      if (marker) {
        marker.setAttribute('cx', point.x);
        marker.setAttribute('cy', point.y);
        marker.setAttribute('visibility', 'visible');
      }
      place(point);
      if (live) live.textContent = point.text.replace(/\n/g, '. ');
      if (options.onShow) options.onShow(index);
    }

    function hide() {
      tip.hidden = true;
      if (marker) marker.setAttribute('visibility', 'hidden');
      if (options.onShow) options.onShow(-1);
    }

    function nearest(px, py) {
      var best = 0;
      var bestDistance = Infinity;
      points.forEach(function (point, index) {
        var dx = point.x - px;
        var dy = point.y - py;
        var distance = options.mode === 'y' ? Math.abs(dy) : options.mode === 'x' ? Math.abs(dx) : dx * dx + dy * dy;
        if (distance < bestDistance) {
          bestDistance = distance;
          best = index;
        }
      });
      return best;
    }

    function fromEvent(event) {
      var box = root.getBoundingClientRect();
      return nearest(event.clientX - box.left, event.clientY - box.top);
    }

    root.setAttribute('tabindex', '0');
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', options.label + '. Use the arrow keys to read the values.');
    root.addEventListener('pointermove', function (event) { show(fromEvent(event)); });
    root.addEventListener('pointerdown', function (event) { show(fromEvent(event)); });
    root.addEventListener('pointerleave', function () { if (document.activeElement !== root) hide(); });
    root.addEventListener('click', function () {
      if (options.onSelect && current >= 0) options.onSelect(current);
    });
    root.addEventListener('focus', function () { show(current >= 0 ? current : (options.start || 0)); });
    root.addEventListener('blur', hide);
    root.addEventListener('keydown', function (event) {
      var step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
      if (step) {
        event.preventDefault();
        show(Math.min(Math.max(current + step, 0), points.length - 1));
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        show(event.key === 'Home' ? 0 : points.length - 1);
      } else if ((event.key === 'Enter' || event.key === ' ') && options.onSelect && current >= 0) {
        event.preventDefault();
        options.onSelect(current);
      } else if (event.key === 'Escape') {
        hide();
      }
    });
    return { show: show, hide: hide };
  }

  function colours() {
    var style = getComputedStyle(document.documentElement);
    var read = function (name) { return style.getPropertyValue(name).trim(); };
    return { broken: read('--broken'), brokenSoft: read('--broken-soft'), healthy: read('--healthy'),
      healthySoft: read('--healthy-soft'), ink: read('--ink'), mute: read('--mute'), rule: read('--rule'),
      paper: read('--paper') };
  }

  Radar.chart = {
    svg: svg,
    text: text,
    linear: linear,
    log: log,
    wrapWords: wrapWords,
    xAxis: xAxis,
    yAxis: yAxis,
    annotate: annotate,
    mount: mount,
    resize: resize,
    setTitle: setTitle,
    interact: interact,
    colours: colours
  };
})();
