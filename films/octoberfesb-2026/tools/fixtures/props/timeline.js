/*
 * Props test sheet (tools/fixtures/props): every FILM.props function on one plate, then the hall
 * backgrounds. Not part of the film.
 */
(function () {
  'use strict';
  const FILM = (window.FILM = window.FILM || {});

  FILM.TIMELINE = {
    title: 'OktoberFESB props sheet',
    bpm: 120,
    duration: 2,
    fps: 24,
    width: 1920,
    height: 1080,
    shots: [
      { id: 'props-sheet', file: '01-sheet.js', start: 0, end: 1.5, mode: 'illustrated', post: 0.5, title: 'Every prop',
        brief: 'Mugs, FESB logos, blueprint mug, captions, lockup, wheat, hops, food, bunting, garland, table, tap, spotlight, particles.' },
      { id: 'props-hall', file: '02-hall.js', start: 1.5, end: 2, mode: 'illustrated', post: 0.5, title: 'Spaten House',
        brief: 'A full hall frame (cost test), then the three hallBack variants side by side.' },
    ],
    cues: [
      { t: 0, kind: 'open', note: 'sheet' },
      { t: 1.5, kind: 'cut', note: 'hall' },
    ],
  };
})();
