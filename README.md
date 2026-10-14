# aethelinc

One-page website for Aethel.

Structure: a landing section, then the footer. Nothing else.

Stealth rule: the page says nothing about what Aethel does. The name, and at most a hint.

Plain HTML, CSS and a few lines of JS. No build step.

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```

## To do

- `index.html` is v7 (`horizon.js`): a single screen in the style of prometheus.ai. Open water before dawn, a low light drifting along the horizon with a path across the sea, the AETHEL wordmark centred, a one-line footer. No scroll, no other text.
- `v6.html` is hero v6 (`riso.js`), variant "field": the deck's print look (cobalt, navy, cream, grain) drawn live. Stars, moon, rig, ships, hundreds of turbines, a dotted arc with a small orange point. A WebGL shader prints flat tones as three inks with ragged edges. The dotted arc and dot are gone: a faint network layer (nodes, links, travelling pulses) floats above the print and connects to the rig, ships and turbines. The area behind the rig is cleared of turbines. Layout scales for phone, tablet and desktop. Scrolling drains the cream sea to blue and uncovers the cobalt footer.
- `handful.html` is the same scene with six turbines on the horizon, like the deck (variant "handful").
- `v5.html` is hero v5 (`windfarm.js`): an offshore wind farm of a few hundred turbines receding into fog, all rotors spinning, with glints on the water and the small orange point flying in. Disperses on scroll as the footer rises.
- `v4.html` is hero v4 (`refinery.js`): a generated point cloud of a full oil refinery (about 175k points) filling the screen, scanned in from the ground up, with steam, a flare and the small orange point. Disperses on scroll as the footer rises.
- `v3.html` is hero v3 (`pointcloud.js`): a generated point cloud of a fixed offshore jacket platform (about 94k points), scanned into view from the seabed up, with a dotted loop and a small orange point. No orbit controls.
- `v2.html` is hero v2 (`offshore-section.js`): a platform and turbines on the horizon, built from grain, with a small orange point drifting toward the helideck. No text.
- `v1.html` is hero v1. It is a canvas scene (`sea.js`): a sea of points, a deck riding the swell, a point that settles onto it. Drag to turn the view and change the sea state. Labels are decoration only.
- Footer is adapted from the Lumen Studio footer in the Figma "Footers" file: dark, stippled art, giant wordmark. The stipple is generated in `script.js` from the Aethel mark.
- Add contact details to the footer when ready.
