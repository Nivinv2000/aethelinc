// Hero v5: an offshore wind farm receding to the horizon, built from grain.
// Hundreds of turbines in rows, fading into sea fog. Every rotor turns.
// Towers are fixed point sets; each blade is a set of (radius, offset) points
// that is rotated every frame, so spinning costs almost nothing.
// Scrolling disperses the grain upward as the footer rises over it.
(() => {
  const hero = document.querySelector('.hero');
  const stage = document.querySelector('.stage');
  const canvas = document.getElementById('cloud');
  const ctx = canvas.getContext('2d');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CREAM = '239,230,214', SIGNAL = '255,92,38';
  const TAU = Math.PI * 2;

  let seed = 5;
  const R = () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  let w = 0, h = 0, dpr = 1, hz = 0, F = 1, sunX = 0;
  let turbines = [], bg = null;
  let tw = null, bl = null, glints = new Float32Array(0);            // tower and blade point stores
  const CAMH = 34, HUB = 150, BLADE = 118, ROWS = 20;
  const BUCKETS = 9;
  // colour classes: near turbines, mid, far (hazed toward the sunset), and water reflections
  const COLS = [[250, 240, 225], [242, 208, 186], [228, 168, 146], [150, 205, 220]];
  let bx, bn;

  // ---------- build (on load and on resize) ----------
  function build() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = hero.clientWidth; h = hero.clientHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    hz = Math.round(h * 0.6);
    F = Math.max(w * 0.264, h * 0.47);
    seed = 5;

    // layout: rows receding in depth, spaced wider with distance
    turbines = [];
    for (let zi = 0; zi < ROWS; zi++) {
      const z = 300 * Math.pow(1.15, zi), sp = 430 + z * 0.06;
      const xr = Math.ceil((w * 0.75) / (F / z) / sp);
      for (let xi = -xr; xi <= xr; xi++) {
        if (R() < 0.06) continue;
        turbines.push({ wx: xi * sp + (zi % 2 ? sp / 2 : 0) + (R() - 0.5) * 10, z: z + (R() - 0.5) * 12, zi, ang: R() * TAU, om: 0.36 + R() * 0.22, rv: R() });
      }
    }

    // point stores: [dx, dy, vx, vy, rv] per tower point, [r, o, vx, vy, rv, blade] per blade point
    const T = [], B = [];
    turbines.forEach((t, i) => {
      const s = F / t.z, fog = Math.min(1, Math.max(0.05, 1 - t.z / 4200));
      t.s = s; t.a = 0.08 + 0.92 * Math.pow(fog, 2.2);
      t.base = hz + CAMH * s; t.hub = t.base - HUB * s;
      t.cls = t.z < 1000 ? 0 : t.z < 2300 ? 1 : 2;
      t.t0 = T.length / 5;
      const wd = Math.max(0.5, s * 4.2), L = HUB * s;
      const nT = Math.max(3, Math.ceil((L / 0.9) * Math.max(1, wd * 0.6)));
      for (let k = 0; k < nT; k++) T.push((R() - 0.5) * wd, -R() * L, (R() - 0.5) * 60, 20 + R() * 90, R());
      const nN = Math.max(2, Math.ceil(s * 9));                         // nacelle
      for (let k = 0; k < nN; k++) T.push(R() * s * 15, -L + (R() - 0.5) * s * 6, (R() - 0.5) * 60, 20 + R() * 90, R());
      t.t1 = T.length / 5;
      t.b0 = B.length / 6;
      const bw = Math.max(0.7, s * 3), len = BLADE * s;
      const nB = Math.max(3, Math.ceil((len / 0.9) * Math.max(1, bw * 0.6)));
      for (let b = 0; b < 3; b++) for (let k = 0; k < nB; k++) {
        const r = R() * len, taper = 1 - 0.7 * (r / len);
        B.push(r, (R() - 0.5) * bw * taper, (R() - 0.5) * 60, 20 + R() * 90, R(), b);
      }
      t.b1 = B.length / 6;
    });
    tw = new Float32Array(T); bl = new Float32Array(B);
    const maxPts = tw.length / 5 + bl.length / 6 + 8;   // worst case: every point lands in one bucket
    bx = Array.from({ length: BUCKETS * 4 }, (_, i) => new Float32Array((i >= BUCKETS * 3 ? maxPts : maxPts * 2) + 4096));
    bn = new Int32Array(BUCKETS * 4);
    // the farthest turbines are drawn first when scanning in
    turbines.forEach(t => { t.th = 1 - t.zi / (ROWS - 1) * 0.92; });

    // sky, sun, sea: one prerendered layer, drawn in a dusk-over-the-ocean palette
    const L = document.createElement('canvas');
    L.width = canvas.width; L.height = canvas.height;
    const c = L.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const lerp3 = (A, B, t) => A.map((v, i) => Math.round(v + (B[i] - v) * t));
    const stops = [[60, 90, 150], [108, 112, 178], [226, 146, 140], [255, 186, 112]];
    const skyAt = g => { const f = g * 3, k = Math.min(2, f | 0); return lerp3(stops[k], stops[k + 1], f - k); };
    const bins = new Map();
    const put = (col, a, x, y, sx, sy) => { const key = col.join(',') + '|' + a; let e = bins.get(key); if (!e) { e = { col, a, pts: [] }; bins.set(key, e); } e.pts.push(x, y, sx, sy); };
    const flush = () => { bins.forEach(e => { c.fillStyle = `rgba(${e.col},${e.a})`; for (let k = 0; k < e.pts.length; k += 4) c.fillRect(e.pts[k], e.pts[k + 1], e.pts[k + 2], e.pts[k + 3]); }); bins.clear(); };
    const q = (v, n) => Math.round(v * n) / n;
    sunX = w * 0.34; const sunR = Math.max(34, h * 0.062);
    // sky: thin and blue overhead, dense and warm toward the horizon
    for (let i = 0, n = w * hz * 0.14; i < n; i++) {
      const x = R() * w, y = R() * hz, g = Math.pow(y / hz, 1.9);
      const glow = Math.exp(-Math.pow((x - sunX) / (w * 0.45), 2));
      if (R() < g * (0.55 + 0.6 * glow)) put(skyAt(q(Math.min(1, g * (0.85 + 0.3 * glow)), 12)), q(0.14 + 0.55 * g, 10), x, y, 1.2, 1.2);
    }
    // sun: a half disc on the horizon with a soft bloom
    for (let i = 0, n = sunR * sunR * 1.5; i < n; i++) {
      const a = R() * Math.PI, rr = sunR * Math.sqrt(R());
      put([255, 206, 140], 0.9, sunX + Math.cos(a) * rr, hz - Math.sin(a) * rr, 1.3, 1.3);
    }
    for (let i = 0; i < 9000; i++) {
      const a = R() * Math.PI, rr = sunR * (1 + Math.pow(R(), 1.7) * 6.5);
      const al = q(0.35 * Math.pow(1 - (rr / sunR - 1) / 6.5, 2), 12);
      if (al > 0.01) put([255, 176, 104], al, sunX + Math.cos(a) * rr * 1.5, hz - Math.sin(a) * rr * 0.9, 1.2, 1.2);
    }
    flush();
    // sea: teal grain, lighter at the horizon and darker toward the viewer
    for (let i = 0, n = w * (h - hz) * 0.05; i < n; i++) {
      const u = Math.pow(R(), 1.5), y = hz + u * (h - hz);
      const col = lerp3([84, 150, 176], [24, 70, 104], q(u, 8));
      put(col, q(0.06 + 0.42 * Math.pow(1 - u, 2), 14), R() * w, y, 1 + R() * (1 + u * 8), 1);
    }
    // the sun's path across the water
    for (let i = 0; i < 12000; i++) {
      const u = Math.pow(R(), 1.35), y = hz + u * (h - hz);
      const gx = (R() + R() + R() - 1.5) * (w * 0.012 + u * w * 0.11);
      put([255, 186, 116], q(0.55 * Math.pow(1 - u, 1.1), 12), sunX + gx, y, 1 + R() * (2 + u * 12), 1.1);
    }
    flush();
    // horizon haze
    for (let i = 0, n = w * 40; i < n; i++) {
      const y = hz - 30 + R() * 60, d = Math.abs(y - hz) / 30;
      if (R() < (1 - d) * 0.8) put([244, 176, 140], q(0.12 * (1 - d), 12), R() * w, y, 1.3, 1.3);
    }
    flush();
    bg = L;
    const g = [];
    for (let i = 0; i < 1100; i++) { const u = Math.pow(R(), 1.7); g.push(R() * w, hz + u * (h - hz), R() * TAU); }
    glints = new Float32Array(g);
  }

  // ---------- frame ----------
  const o = [0, 0];
  let stride = 1, slow = 0, last = performance.now(), t0 = performance.now();
  let visible = true, raf = 0;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  function frame(now) {
    raf = 0;
    const dt = now - last; last = now;
    slow = slow * 0.95 + dt * 0.05;
    if (slow > 27 && stride < 3 && !reduced) { stride++; slow = 16; }
    const t = reduced ? 8 : (now - t0) / 1000;

    const sr = stage.getBoundingClientRect();
    const ds = clamp(-sr.top / (0.9 * innerHeight));
    ctx.clearRect(0, 0, w, h);
    if (ds >= 1) { if (visible && !reduced) raf = requestAnimationFrame(frame); return; }

    // sky and sea
    ctx.globalAlpha = 1 - clamp(ds * 1.5);
    ctx.drawImage(bg, 0, 0, w, h);
    // glints on the water
    for (let i = 0; i < glints.length; i += 3) {
      const nearSun = Math.abs(glints[i] - sunX) < w * (0.03 + 0.12 * (glints[i + 1] - hz) / (h - hz));
      ctx.fillStyle = nearSun ? 'rgb(255,200,132)' : 'rgb(150,205,225)';
      const tw2 = 0.5 + 0.5 * Math.sin(t * 1.6 + glints[i + 2]);
      ctx.globalAlpha = (1 - clamp(ds * 1.5)) * tw2 * 0.55 * (1 - (glints[i + 1] - hz) / (h - hz));
      ctx.fillRect(glints[i] + Math.sin(t * 0.5 + glints[i + 2]) * 3, glints[i + 1], 1.6 + (glints[i + 1] - hz) / (h - hz) * 5, 1.1);
    }
    ctx.globalAlpha = 1;

    const prog = clamp((t - 0.3) / 4.5);
    const camX = Math.sin(t * 0.06) * 90;                 // slow sideways drift in metres
    bn.fill(0);
    const rip = t * 2.2;
    for (let i = 0; i < turbines.length; i++) {
      const tb = turbines[i], s = tb.s;
      const X = w / 2 + (tb.wx - camX) * s;
      if (X < -140 * s - 20 || X > w + 140 * s + 20) continue;
      const reveal = clamp((prog - (1 - tb.th)) * 5);
      if (reveal <= 0) continue;
      const aBase = tb.a * reveal;
      const hubY = tb.hub, baseY = tb.base;
      // tower and nacelle
      for (let k = tb.t0; k < tb.t1; k += stride) {
        const j = k * 5;
        let x = X + tw[j], y = baseY + tw[j + 1], a = aBase;
        if (ds > 0) {
          const kd = clamp(ds * 1.3 - tw[j + 4] * 0.35);
          if (kd >= 1) continue;
          if (kd > 0) { const e = kd * kd; x += tw[j + 2] * e * 3; y -= tw[j + 3] * e * 3; a *= Math.pow(1 - kd, 1.2); }
        }
        const b = tb.cls * BUCKETS + Math.min(BUCKETS - 1, (a * BUCKETS) | 0);
        const arr = bx[b], n = bn[b]; arr[n] = x; arr[n + 1] = y; bn[b] = n + 2;
        if (ds === 0 && (k & 1) === 0) {                    // reflection in the water
          const ry = 2 * baseY - y, depth = (ry - baseY) / (HUB * s * 1.25);
          if (depth < 1 && ry < h) {
            const rb = 3 * BUCKETS + Math.min(BUCKETS - 1, (a * 0.34 * (1 - depth) * BUCKETS) | 0);
            const ra = bx[rb], rn = bn[rb]; ra[rn] = x + Math.sin(ry * 0.16 + rip) * (1 + depth * 3) * (0.4 + s); ra[rn + 1] = ry; bn[rb] = rn + 2;
          }
        }
      }
      // rotor: rotate every blade point around the hub
      const spin = tb.ang + t * tb.om;
      const cs = [Math.cos(spin), Math.cos(spin + 2.0944), Math.cos(spin + 4.1888)];
      const sn = [Math.sin(spin), Math.sin(spin + 2.0944), Math.sin(spin + 4.1888)];
      for (let k = tb.b0; k < tb.b1; k += stride) {
        const j = k * 6, bi = bl[j + 5];
        const r = bl[j], off = bl[j + 1];
        let x = X + r * cs[bi] - off * sn[bi], y = hubY + r * sn[bi] + off * cs[bi], a = aBase;
        if (ds > 0) {
          const kd = clamp(ds * 1.3 - bl[j + 4] * 0.35);
          if (kd >= 1) continue;
          if (kd > 0) { const e = kd * kd; x += bl[j + 2] * e * 3; y -= bl[j + 3] * e * 3; a *= Math.pow(1 - kd, 1.2); }
        }
        const b = tb.cls * BUCKETS + Math.min(BUCKETS - 1, (a * BUCKETS) | 0);
        const arr = bx[b], n = bn[b]; arr[n] = x; arr[n + 1] = y; bn[b] = n + 2;
        if (ds === 0 && (k & 1) === 0) {
          const ry = 2 * baseY - y, depth = (ry - baseY) / (HUB * s * 1.25);
          if (depth < 1 && ry < h) {
            const rb = 3 * BUCKETS + Math.min(BUCKETS - 1, (a * 0.34 * (1 - depth) * BUCKETS) | 0);
            const ra = bx[rb], rn = bn[rb]; ra[rn] = x + Math.sin(ry * 0.16 + rip) * (1 + depth * 3) * (0.4 + s); ra[rn + 1] = ry; bn[rb] = rn + 2;
          }
        }
      }
    }
    const sz = Math.max(1.15, w / 1100);
    for (let cl = 3; cl >= 0; cl--) for (let bk = 0; bk < BUCKETS; bk++) {
      const b = cl * BUCKETS + bk;
      if (!bn[b]) continue;
      ctx.fillStyle = `rgba(${COLS[cl]},${(0.1 + (0.9 * (bk + 0.5)) / BUCKETS).toFixed(3)})`;
      const arr = bx[b];
      for (let j = 0; j < bn[b]; j += 2) ctx.fillRect(arr[j], arr[j + 1], sz, sz);
    }

    // the orange point: comes in low over the farm, down the lane between two rows
    const live = clamp((prog - 0.5) * 3) * (1 - clamp(ds * 2.5));
    if (live > 0.01) {
      const cycle = 18, u = (t % cycle) / cycle;
      const e = u * u * (3 - 2 * u);
      const z = 3600 - e * 3250;
      const s = F / z, X = w / 2 + (180 - camX) * s;
      const alt = 70 + 40 * Math.sin(u * Math.PI);
      const py = hz + (CAMH - alt) * s;
      const a = (u < 0.06 ? u / 0.06 : u > 0.94 ? (1 - u) / 0.06 : 1) * live;
      const rr = Math.max(2.2, 3.6 * Math.min(1, s * 1.5));
      const g = ctx.createRadialGradient(X, py, 0, X, py, rr * 6);
      g.addColorStop(0, `rgba(${SIGNAL},${0.45 * a})`); g.addColorStop(1, `rgba(${SIGNAL},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(X, py, rr * 6, 0, TAU); ctx.fill();
      ctx.fillStyle = `rgba(${SIGNAL},${a})`; ctx.beginPath(); ctx.arc(X, py, rr, 0, TAU); ctx.fill();
    }

    if (visible && !reduced) raf = requestAnimationFrame(frame);
  }

  const start = () => { if (!raf && visible && bg) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  let rt;
  const rebuild = () => { build(); if (reduced) frame(performance.now()); else start(); };
  new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(rebuild, 150); }).observe(hero);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; start(); }).observe(stage);
  if (reduced) addEventListener('scroll', () => frame(performance.now()), { passive: true });
  rebuild();
  window.__windfarm = () => ({ turbines: turbines.length, towerPts: tw.length / 5, bladePts: bl.length / 6 });
})();
