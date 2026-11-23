/*
 * masthead.js: puts the real number of broken blocks into the page title.
 * The headline itself is filled by main.js from facts.json.
 */
(function () {
  'use strict';

  Radar.register('masthead', function (data) {
    var broken = Radar.format.int(data.facts.anomalous_blocks);
    document.title = 'HDFS Incident Radar: finding ' + broken + ' broken blocks in a storage log';
  });
})();
