// Hero v2: an offshore platform and a line of turbines on the horizon, built
// entirely from grain, the same material as the footer. A small orange point
// drifts in toward the platform. No text.
(() => {
  const hero = document.querySelector('.hero');
  const canvas = document.getElementById('offshore');
  const ctx = canvas.getContext('2d');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CREAM = '239,230,214';

  let w = 0, h = 0, dpr = 1, hy = 0;
  let layers = null, pad = null;
  let mx = 0, my = 0, tx = 0, ty = 0;
  let visible = true, raf = 0, t0 = performance.now();

  const mk = () => {
    const c = document.createElement('canvas');
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    const x = c.getContext('2d', { willReadFrequently: true });
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { c, x };
  };

  // ---------- silhouettes (white on transparent) ----------
  const line = (m, x1, y1, x2, y2) => { m.beginPath(); m.moveTo(x1, y1); m.lineTo(x2, y2); m.stroke(); };

  function platform(m, cx, base, s) {
    m.save(); m.translate(cx, base); m.scale(s, s);
    m.strokeStyle = '#fff'; m.fillStyle = '#fff'; m.lineWidth = 2.2; m.lineCap = 'butt';
    const xl = y => -62 + 22 * (-y / 72), xr = y => -xl(y);
    line(m, -62, 0, -40, -72); line(m, 62, 0, 40, -72);
    line(m, -12, 0, -9, -72); line(m, 12, 0, 9, -72);
    const ys = [0, -24, -48, -72];
    ys.forEach((y, i) => {
      line(m, xl(y), y, xr(y), y);
      if (i < 3) {
        const y2 = ys[i + 1];
        line(m, xl(y), y, xr(y2), y2); line(m, xr(y), y, xl(y2), y2);
      }
    });
    m.globalAlpha = 0.6;
    m.fillRect(-60, -84, 120, 12);                 // main deck
    m.fillRect(-48, -106, 34, 22);                 // modules
    m.fillRect(-8, -99, 26, 15);
    m.fillRect(22, -114, 22, 30);
    m.globalAlpha = 1;
    m.lineWidth = 1.6;
    line(m, -40, -106, -30, -178); line(m, -20, -106, -30, -178);   // derrick
    [-120, -138, -156].forEach(y => line(m, -38 + (-y - 106) * 0.0 - 0, y, -22, y));
    line(m, 44, -114, 92, -152);                   // flare boom
    m.beginPath(); m.arc(92, -155, 3.2, 0, 6.3); m.fill();
    line(m, 20, -99, 34, -134); line(m, 34, -134, 62, -108);        // crane
    m.fillRect(-100, -92, 42, 4);                  // helideck
    line(m, -100, -90, -84, -73); line(m, -80, -88, -70, -73);
    m.restore();
  }

  function turbine(m, x, base, s, ang) {
    m.save(); m.translate(x, base); m.scale(s, s);
    m.strokeStyle = '#fff'; m.fillStyle = '#fff'; m.lineWidth = 3;
    line(m, 0, 0, 0, -132);
    m.lineWidth = 2;
    for (let k = 0; k < 3; k++) {
      const a = ang + (k * Math.PI * 2) / 3;
      line(m, 0, -132, Math.cos(a) * 64, -132 + Math.sin(a) * 64);
    }
    m.beginPath(); m.arc(0, -132, 3.4, 0, 6.3); m.fill();
    m.restore();
  }

  // ---------- layers ----------
  function build() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = hero.clientWidth; h = hero.clientHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    hy = Math.round(h * 0.64);

    // 1. Mask of the structures
    const mask = mk();
    const ps = h * 0.0024;
    pad = { cx: w * 0.4, base: hy + h * 0.03, s: ps };
    platform(mask.x, pad.cx, pad.base, ps);
    [[0.66, 0.0016, 0.3], [0.76, 0.0012, 1.3], [0.84, 0.0009, 2.1], [0.9, 0.0007, 0.7],
     [0.96, 0.0005, 1.7], [0.13, 0.0010, 0.4], [0.04, 0.0007, 1.1]]
      .forEach(([px, sc, a]) => turbine(mask.x, w * px, hy + h * 0.004, h * sc, a));

    const soft = mk();
    soft.x.filter = `blur(${Math.max(3, h * 0.008)}px)`;
    soft.x.drawImage(mask.c, 0, 0, w, h);

    const W = mask.c.width, H = mask.c.height;
    const sharp = mask.x.getImageData(0, 0, W, H).data;
    const halo = soft.x.getImageData(0, 0, W, H).data;

    // 2. Structure grain
    const st = mk(); st.x.fillStyle = `rgb(${CREAM})`;
    const top = hy - h * 0.55;
    for (let y = 0; y < hy + 30; y++) {
      const lit = 0.5 + 0.5 * Math.min(1, Math.max(0, (y - top) / (hy - top)));
      for (let x = 0; x < w; x++) {
        const i = ((y * dpr | 0) * W + (x * dpr | 0)) * 4 + 3;
        const a = sharp[i] / 255, b = halo[i] / 255;
        const p = a * 0.95 * lit + b * (1 - a) * 0.22;
        if (p > 0.02 && Math.random() < p) st.x.fillRect(x + Math.random(), y + Math.random(), 1.25, 1.25);
      }
    }

    // 3. Sky grain: thin at the top, dense toward the horizon.
    const sky = mk(); sky.x.fillStyle = `rgb(${CREAM})`;
    const skyN = Math.round(w * hy * 0.15);
    for (let i = 0; i < skyN; i++) {
      const x = Math.random() * w, y = Math.random() * hy;
      const g = Math.pow(y / hy, 3.2);
      const bloom = 0.35 + 0.65 * Math.exp(-Math.pow((x - w * 0.5) / (w * 0.5), 2));
      if (Math.random() < g * bloom * 0.9) {
        sky.x.globalAlpha = 0.25 + 0.55 * g;
        sky.x.fillRect(x, y, 1.2, 1.2);
      }
    }
    sky.x.globalAlpha = 1;

    // 4. Sea: dashes that thin out toward the viewer, plus a broken reflection.
    const sea = mk(); sea.x.fillStyle = `rgb(${CREAM})`;
    const seaH = h - hy;
    const seaN = Math.round(w * seaH * 0.075);
    for (let i = 0; i < seaN; i++) {
      const u = Math.pow(Math.random(), 1.35);
      const y = hy + u * seaH;
      const x = Math.random() * w;
      sea.x.globalAlpha = 0.05 + 0.45 * Math.pow(1 - u, 2.2);
      sea.x.fillRect(x, y, 1 + Math.random() * (2 + u * 14), 1.1);
    }
    sea.x.globalAlpha = 1;
    const refl = seaH * 0.5;
    for (let y = hy; y < hy + refl; y++) {
      const d = (y - hy) / refl;
      const src = hy - (y - hy) * 0.8 - h * 0.015;
      const row = (src * dpr | 0);
      if (row < 0) continue;
      const wob = Math.sin(y * 0.09) * 3 * d;
      for (let x = 0; x < w; x++) {
        const sx = Math.max(0, Math.min(w - 1, x + wob + (Math.random() - 0.5) * 6 * d));
        const i = (row * W + (sx * dpr | 0)) * 4 + 3;
        const a = sharp[i] / 255;
        if (a > 0.05 && Math.random() < a * 0.38 * (1 - d) * (Math.random() < 0.7 ? 1 : 0))
          sea.x.fillRect(x, y, 2 + Math.random() * 6, 1.1);
      }
    }

    layers = { st: st.c, sky: sky.c, sea: sea.c };
  }

  // ---------- the point ----------
  function point(t) {
    const hx = pad.cx - 76 * pad.s, hyy = pad.base - 100 * pad.s;   // above the helideck
    const cycle = 20, u = (t % cycle) / cycle;
    const a = Math.min(1, u / 0.62);                                 // approach
    const e = a * a * (3 - 2 * a);
    const sx = w * 0.97, sy = h * 0.14;
    let x = sx + (hx - sx) * e;
    let y = sy + (hyy - sy) * e + Math.sin(e * Math.PI) * -h * 0.05;
    if (u >= 0.62) { x += Math.sin(t * 1.3) * 1.6; y += Math.sin(t * 1.9) * 1.2; }
    const fade = u < 0.04 ? u / 0.04 : u > 0.92 ? (1 - u) / 0.08 : 1;
    return { x, y, a: fade };
  }

  function frame(now) {
    raf = 0;
    const t = reduced ? 6 : (now - t0) / 1000;
    mx += (tx - mx) * 0.05; my += (ty - my) * 0.05;

    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(layers.sky, mx * -4, my * -2, w, h);
    ctx.drawImage(layers.st, mx * -10, my * -4, w, h);

    // Sea: drifting horizontal slices.
    const slice = 3, W = layers.sea.width, dprX = W / w;
    for (let y = hy; y < h; y += slice) {
      const d = (y - hy) / (h - hy);
      const off = Math.sin(y * 0.045 + t * 0.7) * (1 + d * 5) + mx * -14;
      ctx.drawImage(layers.sea, 0, y * dprX, W, slice * dprX, off, y, w, slice);
    }

    // The point.
    const p = point(t);
    const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 16);
    g.addColorStop(0, `rgba(255,79,26,${0.4 * p.a})`);
    g.addColorStop(1, 'rgba(255,79,26,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, 16, 0, 6.3); ctx.fill();
    ctx.fillStyle = `rgba(255,79,26,${p.a})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, 2.6, 0, 6.3); ctx.fill();

    if (visible && !reduced) raf = requestAnimationFrame(frame);
  }

  const start = () => { if (!raf && visible && layers) raf = requestAnimationFrame(frame); };

  hero.addEventListener('pointermove', e => {
    const r = hero.getBoundingClientRect();
    tx = (e.clientX - r.left) / r.width - 0.5;
    ty = (e.clientY - r.top) / r.height - 0.5;
  });

  let rt;
  const rebuild = () => { build(); if (reduced) frame(performance.now()); else start(); };
  new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(rebuild, 150); }).observe(hero);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; start(); }).observe(hero);

  (document.fonts?.ready || Promise.resolve()).then(rebuild);
})();
