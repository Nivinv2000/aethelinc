// Offshore structures on the horizon, drawn from real rendered images that were cut
// out and relit as backlit silhouettes (see assets/scene). Drawn on a 2D canvas above
// the sea shader. Turbine rotors are real blade cut-outs, spun in code.
(() => {
  const canvas = document.getElementById('scene');
  const ctx = canvas.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const HZ = 0.54;                                      // horizon, matches the sea shader
  const names = ['platform', 'vessel', 'tower', 'blade'];
  const img = {};
  let meta = null, W = 0, H = 0, dpr = 1, hz = 0, built = null;

  const load = n => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.src = `assets/scene/${n}.png`; });
  Promise.all([fetch('assets/scene/meta.json').then(r => r.json()), ...names.map(load)]).then(([m, ...ims]) => {
    meta = m; names.forEach((n, i) => (img[n] = ims[i])); resize(); start();
  });

  const scaled = (src, w, h) => {                        // pre-scale once, so frames stay cheap
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w * dpr)); c.height = Math.max(1, Math.round(h * dpr));
    const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(src, 0, 0, c.width, c.height); return c;
  };

  function layout() {
    const portrait = W / H < 0.9;
    const U = portrait ? W : Math.min(W, H * 1.78);
    const o = { portrait, items: [] };
    // platform (left). Its lower 12% is below the waterline, so only the top 88% is drawn.
    const pw = portrait ? W * 0.5 : U * 0.25;
    o.platform = { w: pw, h: pw * meta.platform.h / meta.platform.w, x: portrait ? W * -0.04 : U * 0.025, wl: hz + 2, keep: 0.88 };
    // vessel (right, a little nearer than the horizon)
    const vw = portrait ? W * 0.4 : U * 0.135;
    o.vessel = { w: vw, h: vw * meta.vessel.h / meta.vessel.w, x: portrait ? W * 0.58 : W * 0.725, wl: hz + (portrait ? 20 : 20), keep: 0.93 };
    // turbines, small and far, standing on the horizon
    const tb = [];
    const row = portrait ? [] : [[0.865, 1.0], [0.9, 0.86], [0.932, 0.74], [0.96, 0.64]];
    row.forEach(([fx, sc], i) => tb.push({ x: W * fx, th: U * 0.075 * sc, wl: hz + 1, om: 0.42 + i * 0.07, ph: i * 1.9 }));
    o.turbines = tb;
    return o;
  }

  function build() {
    const o = layout();
    const mk = (spec, key) => { const s = spec; s.c = scaled(img[key], s.w, s.h); return s; };
    mk(o.platform, 'platform'); mk(o.vessel, 'vessel');
    o.turbines.forEach(t => {
      const s = t.th / (meta.tower.h - meta.tower.hub[1]);
      t.s = s; t.tw = meta.tower.w * s; t.thh = meta.tower.h * s;
      t.tc = scaled(img.tower, t.tw, t.thh);
      t.bw = meta.blade.w * s; t.bh = meta.blade.h * s;
      t.bc = scaled(img.blade, t.bw, t.bh);
    });
    return o;
  }

  function resize() {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    hz = H * HZ;
    if (meta) built = build();
  }
  addEventListener('resize', resize);

  const refl = document.createElement('canvas'); const rx = refl.getContext('2d');
  let t0 = performance.now(), raf = 0;
  function frame(now) {
    raf = 0;
    const t = reduced ? 3 : (now - t0) / 1000;
    const o = built;
    // far turbines first, then the platform, then the nearer vessel
    const list = o.turbines.map(tb => ['turbine', tb]).concat([['platform', o.platform], ['vessel', o.vessel]]);

    // 1. mirrored copies on an offscreen canvas, faded with depth
    if (refl.width !== canvas.width || refl.height !== canvas.height) { refl.width = canvas.width; refl.height = canvas.height; }
    rx.setTransform(dpr, 0, 0, dpr, 0, 0); rx.clearRect(0, 0, W, H);
    list.forEach(([k, obj]) => { rx.save(); rx.translate(0, obj.wl * 2); rx.scale(1, -1); drawObjOn(rx, k, obj, t); rx.restore(); });
    rx.globalCompositeOperation = 'destination-in';
    const g = rx.createLinearGradient(0, hz, 0, hz + H * 0.34);
    g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    rx.fillStyle = g; rx.fillRect(0, hz, W, H * 0.34);
    rx.globalCompositeOperation = 'source-over';

    // 2. blit the reflection in thin rippling slices
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
    const sl = Math.max(2, Math.round(3 * dpr)), y0 = Math.floor(hz * dpr), y1 = Math.min(canvas.height, Math.floor((hz + H * 0.34) * dpr));
    for (let y = y0; y < y1; y += sl) {
      const d = (y - y0) / (y1 - y0);
      const off = Math.sin(y * 0.09 / dpr + t * 1.1) * (1.2 + d * 5) * dpr;
      ctx.drawImage(refl, 0, y, canvas.width, sl, off, y, canvas.width, sl);
    }

    // 3. the objects
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    list.forEach(([k, obj]) => drawObjOn(ctx, k, obj, t));

    // 4. flare glow, flickering
    const p = o.platform, fx = p.x + meta.platform.flare[0] / meta.platform.w * p.w, fy = (p.wl - p.h * p.keep) + meta.platform.flare[1] / meta.platform.h * p.h;
    const fl = 0.75 + 0.25 * Math.sin(t * 9.1) * Math.sin(t * 5.3 + 1.1) + 0.1 * Math.sin(t * 23);
    const r = Math.max(9, p.w * 0.03);
    const gr = ctx.createRadialGradient(fx, fy, 0, fx, fy, r * 2.6);
    gr.addColorStop(0, `rgba(255,248,236,${0.55 * fl})`); gr.addColorStop(0.4, `rgba(255,236,214,${0.16 * fl})`); gr.addColorStop(1, 'rgba(255,236,214,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(fx, fy, r * 2.6, 0, 6.3); ctx.fill();

    if (!reduced && !document.hidden) raf = requestAnimationFrame(frame);
  }
  function drawObjOn(c, key, o, t) {
    if (key === 'turbine') {
      const hubX = o.x, hubY = o.wl - o.th;
      c.drawImage(o.tc, hubX - meta.tower.hub[0] * o.s, hubY - meta.tower.hub[1] * o.s, o.tw, o.thh);
      c.fillStyle = 'rgb(18,24,34)'; c.beginPath(); c.arc(hubX, hubY, 40 * o.s, 0, 6.3); c.fill();
      const spin = o.ph + t * o.om;
      for (let k = 0; k < 3; k++) {
        c.save(); c.translate(hubX, hubY); c.rotate(spin + k * 2.0944);
        c.drawImage(o.bc, -meta.blade.hub[0] * o.s, -meta.blade.hub[1] * o.s, o.bw, o.bh);
        c.restore();
      }
      return;
    }
    const top = o.wl - o.h * o.keep;
    c.drawImage(o.c, 0, 0, o.c.width, o.c.height * o.keep, o.x, top, o.w, o.h * o.keep);
  }
  function start() { if (!raf) raf = requestAnimationFrame(frame); }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !reduced && meta) { cancelAnimationFrame(raf); raf = 0; start(); } });
  window.__scene = () => ({ ok: !!built });
})();
