# OktoberFESB 2026

A 36-second film for the OktoberFESB 2026 party at Spaten House and the release of FESB 9, made with the `procedural-film` skill.
Every frame is drawn and every sound is synthesised in JavaScript; there are no image, font or audio files.

- 1920x1080, 24 fps, 120 bpm, 14 shots. The shot list is in `exports/octoberfesb-2026-shots.md`.
- `exports/octoberfesb-2026-phone.mp4` is the 720p cut; `dist/octoberfesb-2026.html` is the interactive player (click or space to play, arrow keys step frames, `?shot=<id>` loops one shot).
- The plan lives in `docs/`: `storyboard.md`, `art-bible.md`, `cast-api.md`, `CONTRACT.md`.
- The recurring characters are in `src/cast.js`, the mugs, logos, captions and the hall in `src/props.js`, one file per shot in `src/scenes/`, the score in `src/music.js`.

## Rebuild

```bash
npm install --prefix tools
node tools/check.cjs
node tools/render.cjs
node tools/build.cjs
```

`check.cjs` is the gate and exits 0 when green; it warns that some frames take over 150 ms, which only makes the render slower.
`render.cjs` writes `exports/octoberfesb-2026.mp4` (crf 16). The delivered cuts are normalised to -14 LUFS:

```bash
ffmpeg -i exports/octoberfesb-2026.mp4 -c:v libx264 -crf 20 -preset medium -af loudnorm=I=-14:TP=-1.5:LRA=11 -c:a aac -b:a 192k exports/octoberfesb-2026-1080p.mp4
ffmpeg -i exports/octoberfesb-2026.mp4 -vf scale=1280:720 -c:v libx264 -crf 23 -preset medium -af loudnorm=I=-14:TP=-1.5:LRA=11 -c:a aac -b:a 160k exports/octoberfesb-2026-phone.mp4
```

Captions use the Montserrat font, which must be installed on the machine that renders (`apt-get install fonts-montserrat`); without it they fall back to DejaVu Sans.
