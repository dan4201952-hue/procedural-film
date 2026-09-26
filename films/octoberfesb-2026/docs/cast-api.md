# Cast and props API

The contract between `src/props.js`, `src/cast.js` and the scene files.
Signatures here are fixed; the owners implement them, scenes call them and nothing else draws these things.
Load order: core, lib, props.js, cast.js, timeline, scenes, music, player.

Common rules for every function:
- Pure: draws from its arguments alone. No state between frames. Seeds come from `opts.seed` (default derived from the function name) through `FILM.lib.hash`/`rng`.
- Coordinates are canvas pixels on the 1920x1080 frame. `x, y` is the **base centre** (where the thing stands) unless stated.
- `h` is the drawn height in px; everything inside scales with it, including line widths (the art bible's widths are for the stated reference size and scale linearly, min 1.5 px).
- `opts.draw` 0..1 is a draw-on (outline first, fills when complete). Default 1.
- `opts.alpha` 0..1 multiplies everything. `opts.flip` mirrors horizontally about x.
- `opts.line` 'hero' | 'secondary' | 'background' picks the outline weight (art bible section 3). Default 'secondary'.
- Everything uses the palette names of art bible section 2.2 and the line style `FILM.props.LINE`.
- Must stay fast: a full crowd shot (a hall, 10 people, 20 mugs) must draw under 150 ms at full size. Cache static sub-drawings with `FILM.lib.cached(key, make)` keyed by every input (size, pose, seed) and only when t-independent.

## `src/props.js` → `FILM.props`

| Function | What it draws |
|---|---|
| `LINE` | `{ wobble, tremble, rough, boilAmp, widthJitter, taper }` from art bible section 3, and `W: { hero: 7, secondary: 5, background: 3, detail: 2.5 }` |
| `shape(ctx, pts, o)` | The house primitive: a closed filled shape with `o.fill`, optional `o.shade` (cel tone: `{ color, pts }` or `{ color, side: 'right', frac }`), `o.gloss` (array of `[x, y, len, angle]` white strokes), outline via `lib.inkPath`. Everything else is built from it. |
| `mug(ctx, x, y, h, o)` | The glass Maß (art bible 10.4). `o.fill` 0..1 beer level, `o.foam` 0..1.4 foam height (above 1 it overflows and drips), `o.logo` true draws the FESB logo on the front, `o.tilt` radians about the base, `o.slosh` -1..1 tilts the beer surface, `o.bubbles` true, `o.t` seconds for bubbles and slosh, `o.blueprint` true draws it as blueprint line art (art bible section 5). Returns `{ handle: [x, y], rim: [x, y, w], logo: [x, y, size] }` in canvas px. |
| `fesbLogo(ctx, cx, cy, size, o)` | The FESB logo (art bible 10.9), centred. `o.lineArt` true for the blueprint version, `o.outline` true adds the 3 px outline stroke. |
| `caption(ctx, str, x, y, size, o)` | Sticker lettering (art bible 6). `o.align` 'left' or 'center', `o.style` 'gold' \| 'blue' \| 'white' \| 'split' (split paints the part before `o.splitAt` gold and the rest blue, used for "OktoberFESB"), `o.pop` 0..1 (scale 0 → 1.08 → 1), `o.rot` radians, `o.letters` 0..1 reveals letter by letter with a slam. Returns the drawn box `{ x, y, w, h }`. |
| `lockup(ctx, cx, cy, s, o)` | The OktoberFESB 2026 lockup (art bible 10.10) at scale `s` (s = 1 is 900 px tall including lettering), centred at (cx, cy). Build values 0..1 per part: `o.mug`, `o.foam`, `o.wheat`, `o.hops`, `o.word`, `o.year`, `o.rim` (white sticker rim), `o.bubbles`; `o.t` seconds for bubbles and foam breathing; `o.sweep` 0..1 gloss sweep across the lettering. Returns `{ mug: {x, y, h} }` (the mug's base centre and height inside the lockup). |
| `wheat(ctx, x, y, h, o)` | A wheat ear on its stalk, `o.rot`. |
| `hops(ctx, x, y, h, o)` | A hop cone with two leaves, `o.rot`. |
| `bubbles(ctx, seed, t, box, o)` | Golden bubbles (art bible section 4) rising inside `box` `{ x, y, w, h }`: `o.count`, `o.speed`, `o.size` [min, max]. |
| `confetti(ctx, seed, t, x, y, o)` | A burst of confetti from (x, y) at t = 0: `o.count`, `o.spread`, falls and flutters on twos. |
| `sparkle(ctx, x, y, r, k)` | A four-point white star, k 0..1 life (pops and fades). |
| `knuckle(ctx, x, y, h, o)` | Schweinshaxe on its plate with dumpling, kraut and gravy (art bible 10.5). `o.squash` 0..1. |
| `pretzel(ctx, x, y, h, o)` | A salted pretzel, `o.rot`. |
| `sausages(ctx, x, y, h, o)` | Two grilled sausages with mustard on a small plate. |
| `hallBack(ctx, o)` | The full-frame Spaten House background (art bible 10.6): wall, beams, chandeliers, `o.variant` 'counter' (tap counter with barrels), 'hall' (long room), 'door' (the doorway at centre); `o.camX` px parallax offset; `o.dim` 0..1 darkens for the spotlight; `o.t` for bulb shimmer. |
| `bunting(ctx, x0, y0, x1, y1, sag, o)` | A swag of Bavarian lozenge pennants between two points, `o.t` for a gentle sway. |
| `garland(ctx, x0, y0, x1, y1, sag, o)` | A string of warm bulbs with glows. |
| `table(ctx, x, y, w, o)` | A long wooden table seen from the side at slight elevation, top at y, `o.depth` px of top surface visible, with a bench `o.bench` 'front' \| 'back' \| 'both'. |
| `tap(ctx, x, y, h, o)` | The brass tap with its handle; `o.flow` 0..1 draws a stream of beer down to `o.flowTo` y. |
| `spotlight(ctx, x0, y0, x1, y1, w, o)` | A soft light cone from (x0, y0) to a floor ellipse at (x1, y1) of width w, `o.alpha`. |

## `src/cast.js` → `FILM.cast`

| Function | What it draws |
|---|---|
| `TEAM` | Array of 15 teammate specs (the team is 15 white men of mixed ages, art bible 10.3) `{ id, skin, age, hair, hairColor, glasses, beard, build, shirt }`, fixed, varied per art bible 10.3. |
| `person(ctx, spec, x, y, h, pose, o)` | A teammate (art bible 10.3). `pose` is `{ name, k, t }`: names 'stand', 'sit' (seated on a bench, y is the seat), 'back' (seen from behind), 'turn' (k 0 front → 1 back), 'cheer' (arms up), 'reach' (arm out holding a mug, `o.mug` opts), 'catch' (k 0..1 hands up then hugging a shirt), 'pullOn' (k 0..1 pulling a jersey on), 'look' (head turned by `o.look` -1..1). `o.outfit` 'casual' \| 'jersey' \| 'octoTee'. `o.view` 'front' \| 'side'. Returns `{ hand: [x, y], head: [x, y] }`. |
| `chef(ctx, x, y, h, pose, o)` | The chef (art bible 10.1), party outfit. `pose` `{ name, k, t }`: 'stand', 'tieBandana' (k 0..1), 'salsa' (t in seconds drives the basic step on 8ths at 120 bpm), 'spin' (k 0..1 one full turn), 'throw' (k 0..1, right arm), 'raiseMug' (k 0..1), 'armsCrossed', 'nod' (k), 'grin'. `o.bandana` true, `o.gleam` 0..1 head gleam flare, `o.mug` opts object or null (the hero mug in his right hand, drawn with `FILM.props.mug`), `o.look` -1..1. Returns `{ handR: [x, y], handL: [x, y], head: [x, y] }`. |
| `chefHand(ctx, x, y, s, o)` | The chef's right hand in the navy hoodie sleeve seen from above, index finger extended; `o.press` 0..1 bends the finger down. (x, y) is the fingertip. |
| `chefBeardEdge(ctx, x, y, w, o)` | The lower edge of the beard entering from the top of the frame, width w, bottom edge at y. |
| `waitress(ctx, x, y, h, pose, o)` | The waitress (art bible 10.2) with ten Maß, five per hand. `pose` `{ name, t }`: 'walk' (t seconds, a step on every beat at 120 bpm), 'stand'. `o.heroMug` true puts the FESB-logo mug at the front of her right-hand fan. `o.facing` 1 right (default) or -1. Returns `{ fanL: [x, y], fanR: [x, y] }`. |
| `tshirt(ctx, x, y, s, o)` | A flying or held t-shirt. `o.design` 'jersey' \| 'octo', `o.view` 'front' \| 'back', `o.flap` 0..1 sleeve flap phase, `o.rot`. (x, y) is its centre, s its width. |
| `jerseyBack(ctx, x, y, w, o)` | The jersey back print alone (FESB over a huge 9) for close-ups, `o.gleam` 0..1. |
