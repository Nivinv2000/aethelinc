# aethelinc

One-page website for Aethel.

Structure: a landing section, then the footer. Nothing else.

Stealth rule: the page says nothing about what Aethel does. The name, and at most a hint.

Plain HTML, CSS and a few lines of JS. No build step.

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

## To do

- `index.html` is hero v3 (`pointcloud.js`): a generated point cloud of a fixed offshore jacket platform (about 94k points), scanned into view from the seabed up, with a dotted loop and a small orange point. No orbit controls.
- `v2.html` is hero v2 (`offshore-section.js`): a platform and turbines on the horizon, built from grain, with a small orange point drifting toward the helideck. No text.
- `v1.html` is hero v1. It is a canvas scene (`sea.js`): a sea of points, a deck riding the swell, a point that settles onto it. Drag to turn the view and change the sea state. Labels are decoration only.
- Footer is adapted from the Lumen Studio footer in the Figma "Footers" file: dark, stippled art, giant wordmark. The stipple is generated in `script.js` from the Aethel mark.
- Add contact details to the footer when ready.
