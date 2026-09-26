# Storyboard: OktoberFESB 2026

## Logline

The night FESB 9 ships, a bearded hand presses Deploy, the release bar fills with beer, and one Maß travels through Spaten House to the team's table, where the bald, bandana-wearing chef salsas in and throws everyone a FESB 9 jersey before raising the mug into the camera.
Cartoon sticker illustrations in the style of the OktoberFESB logo, two blueprint inserts that read the party as an integration diagram, and every cut on a 120 bpm grid in a 16:9 frame.

## Numbers

- BPM 120: beat 0.5 s = 12 frames, 8th = 6 frames, 16th = 3 frames, bar 2.0 s.
- Duration 36.0 s = 18 bars of 4/4 = 864 frames at 24 fps.
- Frame 1920 x 1080, landscape. Safe area for text x 160 to 1760, y 110 to 970 (the gate enforces 80 px on every side).
- 14 shots, 1.5 to 5.5 s each, every boundary on the 0.5 s grid.

## Summary

| Order | Id | Start | End | Mode | Title |
|---|---|---|---|---|---|
| 01 | office-night | 0.0 | 2.0 | illustrated | The night of the release |
| 02 | deploy | 2.0 | 4.0 | illustrated | A bearded hand presses Deploy |
| 03 | release-beer | 4.0 | 6.0 | illustrated | Loading the party: the bar becomes beer |
| 04 | tap | 6.0 | 8.5 | illustrated | Out of the foam: the tap at Spaten House |
| 05 | bp-message | 8.5 | 10.0 | schematic | The mug is a message |
| 06 | waitress | 10.0 | 12.5 | illustrated | Ten mugs across the hall |
| 07 | bp-route | 12.5 | 14.0 | schematic | Routing: delivered 10 of 10 |
| 08 | prost | 14.0 | 16.0 | illustrated | Pork knuckle and Prost! |
| 09 | chef-enter | 16.0 | 18.5 | illustrated | The music turns salsa: the chef |
| 10 | salsa-shirts | 18.5 | 22.5 | illustrated | Salsa and flying t-shirts |
| 11 | jersey-wall | 22.5 | 25.0 | illustrated | A wall of nines |
| 12 | foam-nine | 25.0 | 28.0 | illustrated | The foam writes a 9 |
| 13 | mug-camera | 28.0 | 30.5 | illustrated | The mug comes to the camera |
| 14 | lockup | 30.5 | 36.0 | illustrated | OktoberFESB 2026 |

## Structure

Act 1, Release, bars 1 to 3 (0 to 6 s): the office at night, Deploy, the release bar fills with beer.
Act 2, The mug's journey, bars 4 to 8 (6 to 16 s): tap, blueprint message, waitress, blueprint route, the table and Prost!
Act 3, The chef, bars 9 to 14 (16 to 28 s): the record scratches into salsa on the downbeat of bar 9, the chef arrives, dances, throws the jerseys, the team turns to show the nines, the foam writes a 9.
Finale, bars 15 to 18 (28 to 36 s): polka again; the mug comes into the camera and becomes the logo.
Setup and payoff: the beard edge and hand in 02 are the chef's; his face is first seen in 09.
Handoffs: foam 03 → 04, hero mug 04 → 05, route 06 → 07, mug hand 12 → 13, full-frame mug 13 → 14 (art bible section 8).
Push-in: 13 (the mug from 200 px to filling the frame). Pull-back: 14 (from the full-frame mug to the whole lockup).

## Conventions

- `T` is global seconds, `t` is shot-local seconds. Times below are global T; convert with t = T − start.
- Camera moves use `lib.camera(ctx, { x, y, zoom }, fn)`: world point (x, y) maps to the frame centre (960, 540).
- Colour names are from `docs/art-bible.md` section 2.2 and exist in `FILM.lib.pal`.
- Characters come only from `FILM.cast` (`src/cast.js`: chef, waitress, teammates, t-shirts); objects, brand and scenery only from `FILM.props` (`src/props.js`: Maß, FESB logo, lockup, captions, food, hall pieces, bubbles, confetti). A scene never draws its own chef, waitress, teammate, Maß, FESB logo, lockup or caption.
- Hard cuts unless the shot says otherwise. Scenes clamp `t` past their duration and hold the final pose.
- The three captions are drawn by `FILM.props.caption` and nowhere else: "Релиз FESB 9" (02, repeated in 14), "2 октября · Spaten House" (04), "Prost!" (08, repeated in 14).

## Shared geometry

### G1: the hero mug under the tap (04 end, 05 start and whole)

The hero Maß stands on the counter, body bottom y 900, rim y 380, bottom width 360 (x 780 to 1140), rim width 340 (x 790 to 1130), handle on the right from x 1140 to 1290 spanning y 450 to 800, foam crown top y 300.
The FESB logo on its front is centred (960, 640), size 120.
The tap nozzle is at (960, 190).

### G2: the waitress at the end of 06 and all of 07

Feet centre (1480, 1000), figure height 820 (head top y 180), facing right.
Mug fans (five mugs each) centred (1300, 600) and (1660, 600), each fan 300 px wide.
The route runs along the floor line y 1000 from the tap at x 200 to her feet.

### G3: the chef's raised mug (12 end, 13 start)

Chef figure centre x 1180, feet y 1010, figure height 860. The mug in his raised right hand is centred (1300, 330), mug height 200.
The foam "9" stays on the left, centred (620, 520), 620 px tall, stroke 70 px.

### G4: the full-frame mug (13 end, 14 start)

The hero mug body spans x 360 to 1560, its rim above the frame, beer across the frame, the FESB logo centred (960, 560) at size 400.

---

## 01 office-night: The night of the release

T 0.0 to 2.0, illustrated, cut from black.

### Composition
The FESB office at night, a wide shot: a window wall with city lights at the back, three desks in a row at the middle, a big central monitor at x 700 to 1220, y 260 to 700 showing a test list of 8 rows. Two teammates (TEAM[0], TEAM[3]) in casual clothes seen from behind in chairs, heads tilted up to the screen. Coffee mug, sticky notes, a small FESB logo sticker on the monitor stand.

### Forms
officeNight background, officeDesk desks, screenGlow monitor glow; test rows as grey bars with a circle on the left that turns pass green with a white tick.

### Overlays
None.

### Motion
T 0.0 to 2.0: the eight test rows turn green one by one on 8ths, row k at T 0.25·k (k = 0..7), each tick popping with outBack over 3 frames. A slow push-in 1.00 → 1.06 on the monitor centre over the shot.

### Camera
Static wide, slow push-in as above.

### Enter and exit
Opens on black with the monitor glow already on. Cut on the beat into 02.

### Subject
Art bible 10.7.

### Sound
T 0.0: a soft tuba pickup and pizzicato tick; each test tick at T 0.25·k is a bright blip rising in pitch (C6, D6, E6, F6, G6, A6, B6, C7).

---

## 02 deploy: A bearded hand presses Deploy

T 2.0 to 4.0, illustrated, cut.

### Composition
Close-up on the dark console: the round glossy pass-green DEPLOY button centred (960, 700), 300 px across. From the top edge a dark navy hoodie sleeve and a large hand enter, and the chin edge with his short black beard (beard colour) is visible at the top of the frame, y 0 to 120, x 780 to 1140. Behind, out of focus, the monitor.

### Forms
The chef's hand (FILM.cast.chefHand), the beard edge (FILM.cast.chefBeardEdge), the button with a gloss highlight.

### Overlays
None.

### Motion
T 2.0 to 2.5: the hand descends. T 2.5 (beat): the finger presses, the button squashes 12 percent for 2 frames, a white ring bursts from it. T 2.5 to 4.0: confetti (confettiA to D) bursts from the button and flutters down; the monitor behind flips to a big "FESB 9 ✓" in pass green. T 3.0: the caption "Релиз FESB 9" pops, centred (960, 300), size 120.

### Camera
Static, a 4 percent kick-zoom on the press at T 2.5, settling over 6 frames.

### Enter and exit
Cut in on the beat. Holds the confetti and caption to the cut.

### Subject
Art bible 10.1 (office: hand and beard edge only), 10.7.

### Sound
T 2.5: the Deploy hit, a deep thunk plus crash cymbal and a brass stab; confetti pops as small noise ticks on 16ths T 2.5 to 3.0. T 3.0: the caption lands with a bright bell. Polka groove starts underneath at T 2.0.

---

## 03 release-beer: Loading the party

T 4.0 to 6.0, illustrated, cut.

### Composition
The big monitor fills the frame (bezel at x 120 to 1800, y 90 to 990). On it, a progress bar x 360 to 1560, y 480 to 600, labelled above it "Загрузка праздника…" (Montserrat 800, 56 px, lineWhite) with a percentage on the right.

### Forms
Monitor bezel officeDesk; bar track outline; the fill is beer (gradient beerLight to beerDeep) with carbonation bubbles and a foam edge on its leading end.

### Overlays
None.

### Motion
T 4.0 to 5.0: the bar fills left to right 0 → 100 percent, the number counts up. T 5.0: at 100 percent the bar tips (rotates 90 degrees about its right end over 6 frames, outBack) and becomes the beer column of a glass; T 5.0 to 6.0 the beer surges up the frame and a foam head rises and overflows until foam fills the whole frame by T 6.0.

### Camera
Static.

### Enter and exit
Exit: the frame is entirely foam (foam with foamShade bubbles) on the last frame. That is the handoff to 04.

### Subject
Art bible 10.4 (beer, foam).

### Sound
T 4.0 to 5.0: a rising pour sound (filtered noise sweeping up) with a ratchet tick per 10 percent. T 5.0: a cork pop. T 5.5 to 6.0: foam fizz swelling into a whoosh.

---

## 04 tap: Out of the foam, Spaten House

T 6.0 to 8.5, illustrated, cut (the frame is foam on both sides).

### Composition
T 6.0 the frame is all foam; it drains downward by T 7.0 to reveal the tap counter at Spaten House: brass tap nozzle at (960, 190), the hero Maß beneath it at G1 filling, barrels and dark beams behind, Bavarian lozenge bunting swagged across the top, bulb garlands glowing. The caption "2 октября" / "Spaten House" on two lines, left-aligned at x 180, baselines y 760 and 880, sizes 110 and 96.

### Forms
Hall (art bible 10.6), the hero mug (10.4) with the FESB logo at G1, the tap in brass (gold with goldDeep shade).

### Overlays
None.

### Motion
T 6.0 to 7.0: foam drains, bubbles pop off it. T 7.0: the caption pops. T 7.0 to 8.0: the last beer runs from the tap, the foam crown rises and overflows in two drips. T 8.0 to 8.5: the tap closes, the mug settles, a gloss sparkle pings on the glass at T 8.0.

### Camera
Static; a 3 percent push-in over the shot to hold G1 exactly at the end.

### Enter and exit
Exit holds G1 exactly for the match to 05.

### Subject
Art bible 10.4, 10.6.

### Sound
T 6.0: the full polka band comes in (tutti, clarinet melody). T 7.0: caption bell. T 8.0: a glass ping (high sine at 3.2 kHz with a short ring).

---

## 05 bp-message: The mug is a message

T 8.5 to 10.0, schematic, cut (match on G1).

### Composition
Blueprint plate. The hero mug at G1 as a double-outline line drawing; its beer drawn as a schemBeer fill line and the foam as a scalloped outline. Heading "Сообщение создано" at top-left (x 180, baseline y 190, 56 px). Three labels with leader lines: "payload: 1 л" pointing at the beer, "header: пена" pointing at the foam, "id: FESB-9" pointing at the logo. On the right, a queue of three small message boxes with the mug icon, the first one lit schemBeer. The small FESB line logo at (1700, 170).

### Forms
lib.blueprint, double outlines per art bible section 5, labels in Montserrat 700.

### Overlays
None.

### Motion
T 8.5: the line drawing is fully present on the first frame (match cut). The labels draw on one per 8th from T 8.75. T 9.5: the lit message box slides one slot to the right, a schemTeal tick appears.

### Camera
Static.

### Enter and exit
Enters on G1. Cut to 06 on the beat.

### Subject
Art bible 5, 10.4, 10.9.

### Sound
T 8.5: a digital sparkle (FM bell arpeggio) over the band; label ticks as soft blips on 8ths.

---

## 06 waitress: Ten mugs across the hall

T 10.0 to 12.5, illustrated, cut.

### Composition
The hall in a wide side view: long tables and benches with teammates (TEAM, casual clothes) at the middle depth, bunting and garlands above. The waitress (FILM.cast.waitress) walks left to right with ten mugs, five per hand, the hero mug (with the FESB logo) at the front of her right-hand fan. Foreground: a table edge and a pretzel on it at the bottom-left.

### Forms
Art bible 10.2, 10.3, 10.6.

### Overlays
None.

### Motion
T 10.0 to 12.5: she walks from feet x 300 to feet x 1480 with a bouncy two-beat stride (steps on every beat, bob 12 px), mugs sloshing, foam flecks flying on the steps. Teammates turn their heads to follow her. She reaches G2 at T 12.25 and holds.

### Camera
A slow pan following her, easing out to rest so that G2 is exact on the last frame.

### Enter and exit
Exit holds G2 exactly for the match to 07.

### Subject
Art bible 10.2 (ten mugs, five per hand, handles gathered), 10.3, 10.6.

### Sound
Footsteps on the beats as wooden thumps; glass clinks on the 8ths between.

---

## 07 bp-route: Routing, delivered 10 of 10

T 12.5 to 14.0, schematic, cut (match on G2).

### Composition
Blueprint plate. The waitress at G2 as a double-outline silhouette; her ten mugs as ten small message boxes in the two fans. A route line in schemBeer runs along y 1000 from a tap icon labelled "Кран" at x 200 to her, then an arrow onward to a table icon labelled "Стол FESB" at x 1760, y 900. Heading "Маршрутизация" at top-left (x 180, baseline y 190). A counter "Доставка: 0/10" at (180, 300) counting to "10/10 ✓".

### Forms
lib.blueprint, art bible section 5.

### Overlays
None.

### Motion
T 12.5: the silhouette and route are present on the first frame. T 12.75 to 13.75: the ten boxes tick schemTeal one per 16th after the first beat, the counter follows. T 13.75: "10/10 ✓" pops.

### Camera
Static.

### Enter and exit
Enters on G2. Cut to 08.

### Subject
Art bible 5, 10.2.

### Sound
Ten rising blips on 16ths T 12.75 to 13.5; T 13.75 a success chime (major triad arpeggio).

---

## 08 prost: Pork knuckle and Prost!

T 14.0 to 16.0, illustrated, cut.

### Composition
Close on the team's table from slightly above: the huge pork knuckle on its plate lands centre (960, 700), pretzels, sausages and sauerkraut around; the hero mug is set down at the right (x 1320). Six teammates' hands with mugs reach in from the edges.

### Forms
Art bible 10.4, 10.5.

### Overlays
None.

### Motion
T 14.0: the knuckle is mid-air; T 14.25 (8th) it lands with squash and a gravy splash, plates jump. T 14.5: the hero mug lands. T 14.5 to 15.0: the mugs swing in toward the centre above the knuckle. T 15.0 (beat): the clink, a starburst of foam spray and gold bubbles; the caption "Prost!" pops centred (960, 230), size 160. Holds to 16.0 with foam droplets falling.

### Camera
Static, 5 percent kick-zoom on the clink.

### Enter and exit
Cut to 09 on the downbeat of bar 9.

### Subject
Art bible 10.4, 10.5.

### Sound
T 14.25: a heavy wooden thud. T 14.5: a glass set down. T 15.0: the big clink (several detuned glass pings) plus a brass "hey!" stab and cymbal. T 15.5 to 16.0: a drum fill into the change.

---

## 09 chef-enter: The music turns salsa

T 16.0 to 18.5, illustrated, cut.

### Composition
The hall's doorway at the back centre, the room dimmed, a spotlight cone from top-left onto the doorway. The chef (FILM.cast.chef) stands framed in it, feet (960, 1000), figure height 820, hero outline. Teammates at the tables in the foreground left and right, silhouetted, turning to look.

### Forms
Art bible 10.1 (party outfit), 10.6.

### Overlays
None.

### Motion
T 16.0: lights dim, spotlight snaps on. T 16.0 to 16.5: the chef's head gleam flares with a star sparkle. T 16.5 to 17.5: he pulls the red bandana from his pocket and ties it on (poses on 8ths). T 17.5 to 18.5: two salsa basic steps, hip sway, a grin to camera on T 18.0.

### Camera
Static, a slow 1.00 → 1.08 push-in on the chef.

### Enter and exit
Cut to 10 on T 18.5.

### Subject
Art bible 10.1.

### Sound
T 16.0: a record scratch, then salsa: clave 3-2, congas tumbao, piano montuno, bass, brass hits. The head gleam is a bright shimmer (T 16.25).

---

## 10 salsa-shirts: Salsa and flying t-shirts

T 18.5 to 22.5, illustrated, cut.

### Composition
The hall wide: the chef dancing along the aisle between two long tables, a crate stencilled "OktoberFESB" at his feet. All fifteen teammates on benches on both sides of the aisle. Bunting and garlands above.

### Forms
Art bible 10.1, 10.3, 10.8.

### Motion
T 18.5 to 22.5: the chef dances the salsa basic along the aisle (moving from x 700 to x 1200) and throws all fifteen t-shirts, one on every 8th: throw i (i = 0..14) leaves his hand at T 18.5 + 0.25·i (the first is already leaving on the first frame, the last at T 22.0). Each flies a parabolic arc (apex 250 px above the throw point, one beat of flight) to a different teammate, who catches it at T 19.0 + 0.25·i (the last exactly on the final frame). Alternate jersey (fesbBlue) and OktoberFESB tee (white). T 21.0: one right-hand spin between throws, bandana tails flying.

### Overlays
Motion arcs: a dashed gold trail behind each flying t-shirt, 2.5 px, 14 on 10 off, fading over 6 frames.

### Camera
A slow pan following the chef.

### Enter and exit
Cut to 11 on T 22.5.

### Subject
Art bible 10.1 (salsa), 10.8.

### Sound
Salsa continues. Each throw (on 8ths T 18.5 to 22.0) is a short whoosh; each catch (on 8ths T 19.0 to 22.5) a cloth flap; the cowbell stays on the beat.

---

## 11 jersey-wall: A wall of nines

T 22.5 to 25.0, illustrated, cut.

### Composition
All fifteen teammates in a team-photo formation, all in fesbBlue jerseys, seen from the front at first (chests show the FESB logo): a back row of eight standing, a front row of seven crouching in the gaps below them, so every back is visible when they turn. The formation spans x 200 to 1640; the chef stands at the right edge (x 1760), arms crossed, grinning.

### Forms
Art bible 10.3, 10.8.

### Motion
T 22.5 to 23.0: they pull the jerseys on (pop). T 23.0 to 24.0: they turn around in a left-to-right wave, one column per 16th: column j (j = 0..7, a back-row person plus the front-row person in front of them) turns at T 23.0 + 0.125·j, revealing on each back "FESB" over a huge "9". T 24.0 to 25.0: all fifteen hold, the nines gleam in sequence, the chef nods.

### Overlays
None.

### Camera
Static, a slight 1.00 → 1.04 push-in.

### Enter and exit
Cut to 12 on T 25.0.

### Subject
Art bible 10.8.

### Sound
Salsa; each column's turn is a brass stab on 16ths T 23.0 to 23.875 (eight, rising); T 24.0 a full brass hit.

---

## 12 foam-nine: The foam writes a 9

T 25.0 to 28.0, illustrated, cut.

### Composition
The hall, warm and busy, the team cheering at the back. The chef in the centre-right with the hero mug. The foam flung from the mug draws a huge "9" in the air on the left (G3), stroke 70 px of foam with gold bubbles.

### Forms
Art bible 10.1, 10.4.

### Motion
T 25.0 to 25.5: the chef winds up. T 25.5 to 27.0: he spins twice on the beats; the foam trail from the mug draws the 9 stroke by stroke (loop first, counter-clockwise from the top, then the tail down), completing at T 27.0. T 27.0: the 9 flashes gold, sparkles. T 27.0 to 28.0: the chef ends in the G3 pose with the mug raised.

### Overlays
None beyond the foam 9 itself.

### Camera
Static.

### Enter and exit
Exit holds G3 exactly for the handoff to 13.

### Subject
Art bible 10.1, 10.4.

### Sound
Salsa to T 27.0: a rising whoosh glissando with the stroke. T 27.0: a sparkle hit and a brass fall. T 27.5 to 28.0: a snare roll into the polka reprise.

---

## 13 mug-camera: The mug comes to the camera

T 28.0 to 30.5, illustrated, cut.

### Composition
Starts on G3 (chef raised mug, the 9 fading at left). The chef brings the mug toward the camera: the mug grows from 200 px to the full frame (G4) by T 30.5, the chef behind becoming blurred-large and falling out of frame edges.

### Forms
Art bible 10.1, 10.4.

### Motion
T 28.0 to 28.5: the 9 fades out. T 28.5 to 30.5: the mug approaches with outCubic, sloshing foam, bubbles streaming past the camera. By the last frame the mug is exactly at G4.

### Overlays
None.

### Camera
The mug approach is the move (the mug scales and moves to G4); the background zooms 1.0 → 1.3.

### Enter and exit
Exit holds G4 for the handoff to 14.

### Subject
Art bible 10.4.

### Sound
T 28.0: polka reprise, full band. T 30.0 to 30.5: a whoosh rising into the cut.

---

## 14 lockup: OktoberFESB 2026

T 30.5 to 36.0, illustrated, cut.

### Composition
Starts on G4 and pulls back to the full OktoberFESB 2026 lockup (FILM.props.lockup) centred (960, 500), 900 px tall including lettering, on a warm hall background with bokeh bulbs and gold bubbles. "Prost!" pops as a tilted sticker at top-right (1560, 200), size 130. "Релиз FESB 9" as a ribbon caption below the lockup centred (960, 960), size 70.

### Forms
Art bible 10.9, 10.10.

### Motion
T 30.5 to 31.5: pull-back from G4 to the lockup mug, outCubic. T 31.5 to 32.5: the lockup builds: wheat ears fan out (T 31.5), hops pop (T 31.75), the word "OktoberFESB" slams in letter by letter on 16ths (T 32.0 to 32.5), "2026" pops at T 32.5. T 33.0: "Prost!" sticker pops. T 33.5: "Релиз FESB 9" ribbon unrolls. T 33.5 to 36.0: bubbles rise, foam crown breathes, a gloss sweep crosses the lettering at T 34.0; everything holds to the end.

### Overlays
None.

### Camera
Pull-back 30.5 to 31.5, then static.

### Enter and exit
Enters on G4. The film ends on the held lockup.

### Subject
Art bible 10.9, 10.10.

### Sound
T 30.5: crash and brass tutti. T 32.0 to 32.5: letter slams on 16ths as tom hits. T 33.0: a big "Prost!" brass chord. T 35.0: the final chord, ringing out to 36.0.
