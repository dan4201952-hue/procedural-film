# Art bible: OktoberFESB 2026

The visual rules every scene follows.
Where this file and a scene brief disagree on a colour, weight or rule, this file wins.
Where this file and `docs/storyboard.md` disagree on a position or a time, the storyboard wins.

This film does not use the skill's hatched-ink house style.
Its look comes from the client's OktoberFESB logo: a glossy cartoon sticker with a thick navy outline, saturated flat fills, one cel-shade tone, white gloss highlights and golden bubbles.
Sections 1 to 9 below replace the house style for this film.

## 1. Frame

The canvas is 1920 px wide and 1080 px tall at 24 fps, landscape, for the event screen.
Every pixel value in this file assumes that size. The origin is the top-left corner and y grows downward.

### 1.1 Safe area

The gate keeps text 80 px clear of every edge.
Anything the viewer must read (captions, the logo, the "9", the jerseys' numbers) sits inside x 160 to 1760 and y 110 to 970.
Backgrounds, bunting, garlands, bubbles and crowd run full bleed.

### 1.2 Composition

Compose for the width: the hall runs left to right, people stand in rows, the waitress walks across the frame.
The hero of each shot fills 40 to 75 percent of the frame height so it reads on a projector from the back of a beer hall.
Three depth layers in every hall shot: background (wall, bunting, garlands, blurred crowd), middle (tables and people), foreground (a mug, a pretzel, a table edge) at 1.2 to 1.5 times the middle scale.

## 2. Palettes

Names below are keys of `FILM.lib.pal`. The subject block in `src/lib.js` mirrors section 2.2 exactly.

### 2.1 Engine palette

The engine's paper, ink, blueprint and overlay colours stay available (`paper`, `ink`, `navy`, `grid`, `lavender`, `lineWhite`, `paleBlue`, `glow`, `magenta`, `annYellow`, `annBlue`).
This film uses them only on the blueprint plate (section 5). Hall and office shots use section 2.2.

### 2.2 Film palette

| Name | Hex | Use |
|---|---|---|
| outline | #14213D | Every outline, the sticker border of the logo, eyebrows, pupils |
| outlineSoft | #2C3A5E | Detail lines inside forms (folds, wood grain, knuckles) |
| gloss | #FFFFFF | Gloss highlights, sparkles, foam highlights, the chef's head gleam |
| beer | #F7B500 | Beer body |
| beerLight | #FFD84A | Beer top band and the lit side |
| beerDeep | #D98A00 | Beer lower edge and shade side |
| foam | #FFF8E7 | Foam |
| foamShade | #EADFC4 | Foam cel shade |
| glass | #D8EEF7 | Glass tint where no beer is behind it (handle, rim, empty top) |
| glassEdge | #9CC7DA | Glass edge lines inside the outline, rim ellipse |
| fesbDeep | #0050D8 | FESB logo dark blue |
| fesbBlue | #1E6FE0 | FESB brand blue: jerseys, captions' "FESB" |
| fesbSky | #0AA2F5 | FESB logo light blue |
| fesbCyan | #0AA8E8 | FESB inner gradient start |
| fesbTeal | #00E0C0 | FESB inner gradient end |
| gold | #FFC21A | "Oktober" lettering top, bubbles |
| goldDeep | #F08C00 | "Oktober" lettering bottom, bubble rims |
| wheat | #F2B632 | Wheat ears |
| wheatDeep | #C98A12 | Wheat shade and stalks |
| hop | #9BD04A | Hop cones |
| hopDeep | #4E9A2A | Hop cone shade |
| leaf | #3E9A3A | Hop leaves |
| leafDeep | #23692A | Leaf shade and veins |
| woodLight | #C48A52 | Table tops, benches |
| woodMid | #9A6433 | Wall panelling, barrels |
| woodDeep | #5E3A1A | Beams, shade side of wood |
| hallWarm | #F6D9A8 | Plastered wall between beams, lamp glow |
| hallDim | #3A2418 | Deep background of the hall |
| bavWhite | #F4F7FB | Bavarian lozenge white |
| bavBlue | #2F8FE0 | Bavarian lozenge blue |
| bulb | #FFE08A | Garland bulbs |
| skinA | #F6CFAE | Light skin |
| skinB | #E5AE84 | Medium skin |
| skinC | #C98A62 | Tan skin |
| skinD | #8D5A3B | Deep skin |
| chefSkin | #E8B48E | The chef's face and head |
| beard | #2B211D | The chef's beard, eyebrows |
| beardGrey | #6E6560 | A few grey strands in the beard |
| bandana | #D62839 | The chef's red bandana |
| bandanaDot | #FFFFFF | The bandana's dots |
| lederhosen | #6B4226 | The chef's lederhosen and suspenders |
| shirtWhite | #F7F4EE | Blouses, the chef's shirt |
| dirndlBodice | #2F6B3A | The waitress's bodice |
| dirndlSkirt | #8E1F3A | The waitress's skirt |
| dirndlApron | #9FD3F0 | The waitress's apron |
| hairBlonde | #F0C14B | Hair |
| hairBrown | #6B3F22 | Hair |
| hairBlack | #1E1A1A | Hair |
| hairRed | #B5502A | Hair |
| crackling | #C9782F | Pork knuckle crust |
| crust | #8E4A1C | Crust shade, pretzel shade |
| meat | #E7A77A | Knuckle meat where it is cut |
| pretzel | #A85F22 | Pretzel |
| sausage | #C8663A | Sausages |
| kraut | #EFE3A0 | Sauerkraut |
| plate | #FFFFFF | Plates |
| officeNight | #151A33 | Office background at night |
| officeDesk | #2A3152 | Desks, chairs |
| screenGlow | #5CE1E6 | Monitor glow |
| codeLine | #7FA7FF | Code lines on monitors |
| pass | #3DDC84 | Test ticks, the Deploy button, "✓" |
| confettiA | #FFC21A | Confetti |
| confettiB | #1E6FE0 | Confetti |
| confettiC | #00E0C0 | Confetti |
| confettiD | #FF5A5F | Confetti |
| schemBeer | #FFC83D | Blueprint identity tint: the beer line and the message dot |
| schemTeal | #00E0C0 | Blueprint identity tint: delivered ticks and the route |

## 3. Line

All outlines go through `lib.inkPath` so the film keeps the drawn boil, but tuned for a clean sticker line:
`{ wobble: 0.8, tremble: 0.25, rough: 0.35, boilAmp: 0.5, widthJitter: 0.12, taper: 6 }` on closed shapes, and the same with `taper: [6, 10]` on open strokes.
`src/props.js` exports these as `FILM.props.LINE`; scenes pass them through, never retune them.

| Element | Width at 1920×1080 | Colour |
|---|---|---|
| Hero outline (the character or object the shot is about) | 7 px | outline |
| Secondary outline (other people, tables, mugs in the crowd) | 5 px | outline |
| Background outline (wall, bunting, far crowd) | 3 px | outline at 70% |
| Detail lines (folds, fingers, wood grain, laces) | 2.5 px | outlineSoft |
| Logo sticker border (the white rim around the OktoberFESB lockup) | 10 px white under a 7 px outline | gloss, outline |

## 4. Tone

Fills are flat. One cel-shade tone per form (on skin: a 15 percent black overlay, `lib.rgba('#000000', 0.15)`), on the lower-right side (light from the upper left), 15 to 25 percent darker than the base or the named deep colour.
One or two white gloss highlights per glossy object (glass, beer, bald head, bottle, button): a long soft-cornered stroke on the upper left and a small dot beside it.
Gradients are allowed in exactly four places: the beer body (beerLight at the top to beerDeep at the bottom), the FESB logo (section 10.9), the "Oktober" and "FESB" lettering (section 10.10), and background light (lamp glow, spotlight, monitor glow, vignette).
No hatching in this film.
Golden bubbles are the signature particle: circles 6 to 22 px in gold with a goldDeep 2 px rim and a white highlight dot, rising 40 to 90 px per second with a slight sway.
Background depth: the far wall and far crowd sit behind a 35 percent `hallDim` haze and a soft radial lamp glow; there is no blur filter.
Set `post: 0.5` on hall and office shots in the timeline so the engine grain stays subtle.

## 5. Blueprint language (shots 05 and 07)

The two blueprint inserts are the integrator's X-ray of the party: the same mug, the same route, drawn as an integration diagram.
Every blueprint frame starts from `lib.blueprint` (navy base, grid, guide circles, diagonals).
Lines: primary double outline lineWhite 85 percent outer 3 px and paleBlue 50 percent inner 2 px, 10 px apart; secondary paleBlue 60 percent 2 px; the grid stays as `lib.blueprint` draws it.
The beer, the message dot and the flow lines use schemBeer; delivered ticks and the finished route use schemTeal. Magenta is not used.
Text is allowed here, unlike the house style: labels in `"Montserrat", "DejaVu Sans", sans-serif` weight 700, 34 to 44 px, lineWhite, with a small paleBlue leader line to what they label; one heading per shot at 56 px weight 800.
The FESB logo appears once per blueprint shot as a small (90 px) line-art version in the top-right corner at centre (1700, 170).

## 6. Captions

Captions are the film's only text on hall and office shots, and there are exactly three of them plus the jersey lettering (storyboard lists each).
Font: `"Montserrat", "DejaVu Sans", sans-serif`, weight 900, drawn by `FILM.props.caption` (section 10.10) as the logo's sticker lettering: gradient fill, 7 px outline stroke, 14 px white outer stroke, a 6 px drop shadow in outline at 40 percent.
Captions pop in with `outBack` over 4 frames on their beat and hold until the cut.

## 7. Motion

Characters and objects move on twos: poses from `lib.onTwos(t)`.
Camera moves, bubbles, confetti, foam spray, light sweeps and caption pops run at 24 fps.
The beat is 0.5 s (12 frames) at 120 bpm. Every pop, landing, clink and cut lands on a beat, an 8th (6 frames) or a 16th (3 frames), visible on the beat frame.
Pops use `outBack` over 3 to 4 frames with a 6 to 10 percent overshoot. Squash and stretch on landings: 12 percent squash for 2 frames.
Dancing is on the beat: the chef's hip and shoulder poses change on every 8th during salsa (section 10.1).
Seed every random choice from `lib.hash(shotId, ...)`. A scene draws from `t` alone and clamps to its final pose past its duration.

## 8. Match cuts and handoffs

| Cut | What holds |
|---|---|
| 03 → 04 | The progress bar's amber fill and the rising foam fill the frame; 04 opens on the same full-frame foam and it drains down to reveal the tap. |
| 04 → 05 | The hero mug (G1) stays on the same pixels, illustrated to blueprint. |
| 06 → 07 | The hall floor plan: the waitress's path (G2) keeps its screen position as the route line. |
| 12 → 13 | The chef's mug hand (G4) holds its screen position; 13 pushes it into the camera. |
| 13 → 14 | The mug filling the frame becomes the logo mug (G5) as the camera pulls back. |

Shared geometry lives in `docs/storyboard.md`; scenes copy those numbers exactly.

## 9. Brand

Spell the event `OktoberFESB` (with a K), exactly as the client's logo does. The product is `FESB`, always in capitals. The release is `FESB 9`.
Never distort the FESB logo: square, two rounded corners (top-left and bottom-right), proportions from section 10.9.
Captions in Russian; the brand words stay in Latin letters.

## 10. Subject reference

Sources: the client's three reference images (the OktoberFESB logo on a dark and a light background, and the FESB logo), and common knowledge of Oktoberfest dress, food and the Maß, checked by the director on 2026-09-26.

### 10.1 The chef (the company head)

- Bald, round head with a strong white gleam on the upper left (a 40 px soft stroke plus a star sparkle that pings on the downbeats in 09).
- Full dark beard (beard, a few beardGrey strands), trimmed round, covering jaw and chin, joined to a moustache; thick dark eyebrows; warm, confident smile with teeth; friendly eyes.
- Sturdy build, head about 1/6.5 of his height, broad shoulders.
- Party outfit: white shirt with rolled sleeves, lederhosen suspenders with a cross strap, lederhosen shorts, knee socks, brown shoes.
- The red bandana (bandana with bandanaDot dots) is tied over the head with the knot and two short tails at the back of the head; the tails flutter on turns.
- Office (shot 02): only his hand in a dark navy hoodie sleeve and the lower edge of the beard entering from the top of the frame. The face is never shown before 09.
- Salsa: the basic step is forward-back on counts 1-2-3 and 5-6-7, holding on 4 and 8, with hip sway opposite the stepping foot, elbows bent at 90 degrees, and a right-hand spin that takes one beat. Poses change on every 8th.
- Portray him with affection: charismatic host, never a clown.

### 10.2 The waitress

- A cheerful, strong, full-figured waitress in the classic dirndl: white short puffed-sleeve blouse (shirtWhite), laced dark-green bodice (dirndlBodice), burgundy skirt to mid-calf (dirndlSkirt), light-blue apron (dirndlApron) with the bow tied on her left (the viewer's right).
- Blonde hair (hairBlonde) in a braided crown; rosy cheeks; a big smile.
- She carries ten Maß mugs, five in each hand, handles gathered in the fist and mugs fanned outward; her arms are nearly straight and she leans back slightly to balance.
- Draw her friendly and respectable, as on an Oktoberfest postcard. The neckline stays modest; no emphasis on her figure beyond a full silhouette.

### 10.3 The team

- Fifteen teammates (the real team is 15 people plus the chef), all white men (skinA and skinB only).
- Ages vary: most (nine or ten) look 30 to 40, three or so look in their twenties, and two or three look older (45 to 60, greying or grey hair, a few forehead lines).
- Vary them by hair (short, buzz cut, side part, curly, quiff, long-ish tied back, receding for an older one; hairBlonde, hairBrown, hairBlack, hairRed, grey for the older ones), facial hair (clean-shaven, stubble, short beard, moustache; about a third with some beard, kept short or light so the chef's full dark beard stays unique), glasses on three or four, and build (slim, average, stocky).
- Nobody is bald except the chef.
- Before the t-shirts: casual shirts and sweaters in muted colours (grey, olive, mustard, maroon, denim).
- After the t-shirts: every teammate in the fesbBlue jersey tee (10.8).
- Built parametrically by `FILM.cast.person(ctx, spec, pose)` so the same person looks the same in every shot; the spec table lives in `src/cast.js` as `FILM.cast.TEAM`.

### 10.4 The Maß

- A 1-litre glass mug: tall cylinder, height to width 1.45 to 1, slightly narrower at the top, a thick glass base (12 percent of the height), a big D-shaped handle on the right as tall as 70 percent of the body.
- Six rows of shallow dimples as rounded rectangles in glassEdge at 50 percent, or vertical facets; choose dimples for the hero mug.
- Beer fills to 88 percent with a foam head rising 18 percent above the rim that overflows in two or three drips on the front.
- Rising carbonation bubbles inside (white at 60 percent, 2 to 5 px).
- The hero mug (the one that travels 03 → 14) carries the FESB logo (10.9) on its front, 34 percent of the mug width.

### 10.5 Food

- Schweinshaxe (pork knuckle): a huge rounded dome of crackling (crackling, crust) with blistered bumps, a white bone end sticking out at a 30 degree angle, and a cut showing meat on one side; it sits on a white plate with a gravy pool, a ball of dumpling and sauerkraut (kraut).
- Pretzel (Brezel): fat belly at the bottom, thin crossed arms knotted twice, coarse white salt crystals on top.
- Sausages: two or three curved sausages with grill marks, mustard dollop.

### 10.6 Spaten House, the hall

- Dark wood beams and panelling (woodDeep, woodMid) with warm plaster (hallWarm) between them; large iron chandeliers with warm bulbs.
- Blue-and-white Bavarian lozenge bunting (bavBlue, bavWhite; diamonds tilted, never checkerboard squares) swagged across the ceiling, and string garlands of warm bulbs (bulb) with soft glows.
- Long wooden tables and benches (woodLight) in rows, a beer tap counter with brass taps and wooden barrels at the back.
- The facade is not drawn; the venue is named only in the caption.

### 10.7 The office (shots 01 to 03)

- Night: the office in officeNight with a window of city lights behind, desks (officeDesk), three monitors with screenGlow glow, code lines (codeLine) and a test list whose rows turn from grey to pass green with a tick.
- The big Deploy button (02) is a round glossy button in pass green on a dark console, labelled `DEPLOY` in Montserrat 900.

### 10.8 The t-shirts

- Two designs: the fesbBlue jersey with the FESB logo on the chest and, on the back, `FESB` over a huge `9` in white with an outline stroke, football-kit style (the number is 45 percent of the back's height); and the OktoberFESB tee in white with the logo lockup on the chest.
- In the air a t-shirt tumbles flat, sleeves flapping on twos; it lands on the catcher and fits in one 3-frame pop.

### 10.9 The FESB logo

On a unit square (0..1, origin top-left):
- Outer square with the top-left corner rounded at radius 0.16 and the bottom-right corner rounded at radius 0.17; the other two corners are sharp.
- Frame band 0.168 thick. Top band: linear gradient fesbDeep (left) to fesbSky (right). Bottom band: fesbSky (left) to fesbDeep (right). Left and right bands: fesbSky.
- Inner field 0.168..0.832 on both axes, filled with a diagonal gradient fesbCyan (top-left) to fesbTeal (bottom-right).
- A white F over it: stem x 0.168 to 0.334 over the full inner height; top arm x 0.168 to 0.670, y 0.168 to 0.334; middle arm x 0.168 to 0.670, y 0.498 to 0.670.
- On a mug or a shirt it gets a 3 px outline stroke around the outer square; in a blueprint it is line art in lineWhite.
- `FILM.props.fesbLogo(ctx, x, y, size, opts)` draws it; nobody else does.

### 10.10 The OktoberFESB lockup and the lettering

- Centre: the hero Maß (10.4) with an extravagant foam crown that overflows down the front-left, FESB logo on the mug.
- Two wheat ears fanned out on each side, hop cones and green leaves at their base, golden bubbles all around.
- Below: `Oktober` in gold lettering (gradient gold top to goldDeep bottom) and `FESB` in blue (gradient fesbSky top to fesbBlue bottom), set as one word, slightly arched (a 4 percent rise at the middle); under it `2026` in gold flanked by two small horizontal wheat sprigs.
- The whole lockup sits on a white sticker rim with the navy outline (section 3).
- `FILM.props.lockup(ctx, cx, cy, scale, parts)` draws it with each part (mug, foam, wheat, hops, word, year, bubbles) switchable and animatable by a 0..1 build value.

### 10.11 Mistakes to avoid

- Hatched shading: this film uses one flat cel tone, never hatching.
- A German flag or a checkerboard: Bavarian bunting is blue and white lozenges.
- A beer stein with a lid or a pint glass: the mug is the glass Maß with a D handle.
- `OctoberFESB` with a c: the brand is `OktoberFESB`.
- The FESB logo with four rounded corners or an E instead of an F: two opposite rounded corners and a white F.
- The chef with hair or with a grey beard: he is bald with a dark beard and a red bandana.
- Showing the chef's face in 01 to 08: he is a silhouette hand and beard edge in 02 and appears only in 09.
- The waitress carrying a tray: she carries the mugs by their handles, five per hand.
- Text below y 970 or beyond x 1760: captions stay in the safe area.
