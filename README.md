# SprintRoute

**Private, client-side sprint orienteering route-choice practice tool.**

Draw and compare route choices on your own private orienteering maps — everything runs 100% in your browser. No cloud uploads, no accounts, no server.

## Features

- 📁 **Load any map image** (PNG / JPG) — works with OCAD exports
- 📏 **Scale calibration** via DPI + map scale (e.g. 1:4000 at 300 DPI) or manual ruler
- 🗺️ **IOF-standard course design** — Start triangle, numbered control circles, double-circle finish with clipped connection lines
- 🏃 **Practice Mode** — auto-rotates each leg (target control at top), click waypoints to trace your route, snap to control to advance leg
- 📊 **Live route stats** — length, straight-line distance, efficiency %, estimated run time
- 👥 **Multi-runner comparison** — name yourself, share the image file, others load it and draw their own routes; leaderboard sorts by shortest total course
- 💾 **Private metadata export** — course + route data appended invisibly to the image binary (valid PNG/JPG in any viewer), re-loaded automatically on upload
- 🎯 **Multi-course support** — create and switch between multiple courses on the same map

## How to use

1. Open `index.html` in any modern browser (Chrome, Firefox, Edge)
2. Drop your map image onto the canvas
3. Set the scale (Panel 2)
4. Design your course (Panel 3) — Start → Controls → Finish
5. Hit **Start Practice Mode** and trace your route leg by leg
6. Export the PNG — share it with friends for route comparison

## Privacy

All processing happens locally. The export appends a JSON metadata block after the image's end-of-file marker. Any standard image viewer ignores it; SprintRoute reads it automatically on re-upload.

## Files

```
sprint-route-practice/
├── index.html   — App shell and UI panels
├── styles.css   — Dark glassmorphism design system
└── app.js       — Canvas engine, course editor, practice mode, export/import
```

## Keyboard shortcuts

| Key | Action |
|-----|--------|
| `Q` / `E` | Rotate map ±5° |
| `R` | Reset view |
| `Ctrl+Z` | Undo last waypoint |
| `Esc` | Cancel current tool |
| Scroll | Zoom (centred on cursor) |
| Space + drag | Pan |
