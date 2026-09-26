/*
 * Cast sheet fixture: FILM.TIMELINE for looking at FILM.cast (src/cast.js) on its own.
 * node tools/snap.cjs --fixtures=tools/fixtures/cast --samples 4 --sheet --scale 0.5
 */
(function () {
  'use strict';
  const FILM = (window.FILM = window.FILM || {});

  FILM.TIMELINE = {
    title: 'OktoberFESB 2026 cast sheet',
    bpm: 120,
    duration: 4,
    fps: 24,
    width: 1920,
    height: 1080,
    shots: [
      { id: 'cast-chef', file: '01-chef.js', start: 0, end: 1, mode: 'illustrated', post: 0.5, title: 'The chef',
        brief: 'Every chef pose: stand, tieBandana, salsa on four 8ths, spin, throw, raiseMug, armsCrossed, grin; his hand and beard edge.' },
      { id: 'cast-waitress', file: '02-waitress.js', start: 1, end: 2, mode: 'illustrated', post: 0.5, title: 'The waitress',
        brief: 'The waitress walking (two phases) and standing with ten Maß, the hero mug in front of her right fan.' },
      { id: 'cast-team', file: '03-team.js', start: 2, end: 3, mode: 'illustrated', post: 0.5, title: 'The team',
        brief: 'First half: all fifteen teammates standing, casual. Second half: the jersey formation from the back and the other poses.' },
      { id: 'cast-shirts', file: '04-shirts.js', start: 3, end: 4, mode: 'illustrated', post: 0.5, title: 'The t-shirts',
        brief: 'Jersey and OktoberFESB tee, front and back, flying; the jersey back print with a gleam.' },
    ],
    cues: [
      { t: 0, kind: 'cut', note: 'chef sheet' },
      { t: 1, kind: 'cut', note: 'waitress sheet' },
      { t: 2, kind: 'cut', note: 'team sheet' },
      { t: 3, kind: 'cut', note: 't-shirt sheet' },
    ],
  };
})();
