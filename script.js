// Footer: stipple the Aethel mark. Each facet of the mark gets its own dot
// density, so the flat logo reads as a lit solid made of grain.
const canvas = document.getElementById('stipple');
const footer = document.querySelector('.footer');

// Facets of the mark in logo coordinates (apex 800,355 / base 490..1110,960).
const P = {
  A: [800, 355], L: [490, 960], R: [1110, 960], B: [800, 830], M: [800, 688],
  l1: [642, 820], r1: [958, 820]
};
const FACETS = [
  { pts: ['A', 'L', 'l1'], d: 1.0 }, // left outer
  { pts: ['A', 'l1', 'M'], d: 0.3 },  // left inner
  { pts: ['M', 'L', 'B'], d: 0.65 },  // left lower
  { pts: ['A', 'R', 'r1'], d: 0.55 },  // right outer
  { pts: ['A', 'r1', 'M'], d: 0.12 }, // right inner
  { pts: ['M', 'R', 'B'], d: 0.38 }   // right lower
];

function drawStipple() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = footer.clientWidth;
  const h = footer.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // Place the mark: centred horizontally, base sitting low behind the wordmark.
  const markH = h * 0.72;
  const k = markH / (960 - 355);
  const ox = w / 2 - 800 * k;
  const oy = h * 0.92 - 960 * k;
  const at = ([x, y]) => [x * k + ox, y * k + oy];

  // Density mask (grey level = density), plus a blurred copy for the halo.
  const mask = document.createElement('canvas');
  mask.width = w; mask.height = h;
  const m = mask.getContext('2d', { willReadFrequently: true });
  m.fillStyle = '#000'; m.fillRect(0, 0, w, h);
  FACETS.forEach(f => {
    const g = Math.round(f.d * 255);
    m.fillStyle = `rgb(${g},${g},${g})`;
    m.beginPath();
    f.pts.forEach((name, i) => {
      const [x, y] = at(P[name]);
      i ? m.lineTo(x, y) : m.moveTo(x, y);
    });
    m.closePath();
    m.fill();
  });
  const sharp = m.getImageData(0, 0, w, h).data;

  const halo = document.createElement('canvas');
  halo.width = w; halo.height = h;
  const hc = halo.getContext('2d', { willReadFrequently: true });
  hc.filter = `blur(${Math.max(8, w * 0.012)}px)`;
  hc.drawImage(mask, 0, 0);
  const soft = hc.getImageData(0, 0, w, h).data;

  ctx.fillStyle = '#efe6d6';
  const samples = Math.min(700000, Math.round(w * h * 0.5));
  const size = Math.max(1, w / 1100);
  for (let i = 0; i < samples; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const idx = ((y | 0) * w + (x | 0)) * 4;
    const inside = sharp[idx] / 255;
    const near = soft[idx] / 255;
    // Taper toward the apex so the top dissolves into grain, like the reference.
    const lift = Math.min(1, Math.max(0, (y - (h * 0.92 - markH)) / (markH * 0.55)));
    const p = Math.max(inside * (0.35 + 0.65 * lift), near * 0.28 * lift);
    if (Math.random() < p) ctx.fillRect(x, y, size, size);
  }
}

let ready = false;
const build = () => { drawStipple(); ready = true; };
build();

let t;
window.addEventListener('resize', () => {
  clearTimeout(t);
  t = setTimeout(build, 200);
});

// Scroll-linked: the grain mark rises and the wordmark settles as the footer
// slides up over the hero. No timers, so it follows the scroll exactly.
const wordmark = document.querySelector('.wordmark');
const clamp01 = v => Math.min(1, Math.max(0, v));
const onScroll = () => {
  const q = clamp01((innerHeight - footer.getBoundingClientRect().top) / innerHeight);
  const r = clamp01(q * 2.4);
  canvas.style.clipPath = `inset(${((1 - r) * 100).toFixed(2)}% 0 0 0)`;
  wordmark.style.transform = `translateY(${(9 + (1 - q) * 55).toFixed(2)}%)`;
};
addEventListener('scroll', onScroll, { passive: true });
addEventListener('resize', onScroll);
onScroll();
