// Hero v4: a scanned point cloud of a full oil refinery, filling the screen.
// Generated in metres: distillation columns, furnaces and stacks, reactors,
// tank farm, LPG spheres, pipe racks, heat exchangers, cooling towers and a flare.
// It is "scanned" into view from the ground up; scrolling disperses it upward
// as the footer rises over it. A small orange point circles on a dotted path.
(() => {
  const hero = document.querySelector('.hero');
  const stage = document.querySelector('.stage');
  const canvas = document.getElementById('cloud');
  const ctx = canvas.getContext('2d');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CREAM = '239,230,214', SIGNAL = '255,79,26';

  // ---------- seeded random: identical refinery every load ----------
  let seed = 11;
  const R = () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const DENS = 0.72;                  // global density, tuned for frame rate
  const lerp = (a, b, t) => a + (b - a) * t;
  const TAU = Math.PI * 2;

  // ---------- point generation ----------
  const P = [];                          // x, y, z, weight, group
  const G = { STRUCT: 0, GROUND: 1 };
  const pt = (x, y, z, wgt = 1, g = G.STRUCT) => P.push(x, y, z, wgt, g);

  function cyl(a, b, r, perM, wgt = 1) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-6) return;
    const d = [dx / len, dy / len, dz / len];
    const ref = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let u = [d[1] * ref[2] - d[2] * ref[1], d[2] * ref[0] - d[0] * ref[2], d[0] * ref[1] - d[1] * ref[0]];
    const ul = Math.hypot(...u); u = u.map(v => v / ul);
    const v = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]];
    const n = Math.max(3, Math.ceil(len * perM * Math.max(0.6, r) * DENS));
    for (let i = 0; i < n; i++) {
      const t = R(), th = R() * TAU, c = Math.cos(th) * r, s = Math.sin(th) * r;
      pt(a[0] + dx * t + u[0] * c + v[0] * s, a[1] + dy * t + u[1] * c + v[1] * s, a[2] + dz * t + u[2] * c + v[2] * s, wgt);
    }
  }
  // vertical cylinder wall
  function vcyl(cx, cz, y0, y1, r, dens, wgt = 0.9) {
    const n = Math.ceil(TAU * r * (y1 - y0) * dens * DENS);
    for (let i = 0; i < n; i++) { const a = R() * TAU; pt(cx + Math.cos(a) * r, lerp(y0, y1, R()), cz + Math.sin(a) * r, wgt); }
  }
  function ring(cx, y, cz, r, n, wgt = 1.15) {
    for (let i = 0; i < n; i++) { const a = (i / n) * TAU; pt(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r, wgt); }
  }
  function disc(cx, y, cz, r, n, wgt = 0.8, r0 = 0) {
    for (let i = 0; i < n; i++) { const a = R() * TAU, rr = Math.sqrt(lerp(r0 * r0, r * r, R())); pt(cx + Math.cos(a) * rr, y, cz + Math.sin(a) * rr, wgt); }
  }
  function dome(cx, y, cz, r, n, wgt = 0.9) {
    for (let i = 0; i < n; i++) {
      const a = R() * TAU, e = Math.acos(R());              // upper hemisphere
      pt(cx + Math.sin(e) * Math.cos(a) * r, y + Math.cos(e) * r * 0.6, cz + Math.sin(e) * Math.sin(a) * r, wgt);
    }
  }
  function sphere(cx, cy, cz, r, n, wgt = 0.9) {
    for (let i = 0; i < n; i++) {
      const z = R() * 2 - 1, a = R() * TAU, s = Math.sqrt(1 - z * z);
      pt(cx + s * Math.cos(a) * r, cy + z * r, cz + s * Math.sin(a) * r, wgt);
    }
  }
  function box(x0, x1, y0, y1, z0, z1, dens, wgt = 0.9) {
    const sx = x1 - x0, sy = y1 - y0, sz = z1 - z0;
    [[sy * sz, 0], [sy * sz, 1], [sx * sz, 3], [sx * sy, 4], [sx * sy, 5]].forEach(([area, f]) => {
      const n = Math.ceil(area * dens * DENS);
      for (let i = 0; i < n; i++) {
        const a = R(), b = R();
        if (f === 0) pt(x0, y0 + a * sy, z0 + b * sz, wgt);
        else if (f === 1) pt(x1, y0 + a * sy, z0 + b * sz, wgt);
        else if (f === 3) pt(x0 + a * sx, y1, z0 + b * sz, wgt);
        else if (f === 4) pt(x0 + a * sx, y0 + b * sy, z0, wgt);
        else pt(x0 + a * sx, y0 + b * sy, z1, wgt);
      }
    });
  }
  function frame3(x0, x1, z0, z1, levels, bay, r = 0.4) {            // steel frame: columns and beams
    const xs = [], zs = [];
    for (let x = x0; x <= x1 + 0.01; x += bay) xs.push(x);
    for (let z = z0; z <= z1 + 0.01; z += bay) zs.push(z);
    xs.forEach(x => zs.forEach(z => cyl([x, 0, z], [x, levels[levels.length - 1], z], r, 12)));
    levels.forEach(y => {
      xs.forEach(x => cyl([x, y, z0], [x, y, z1], r * 0.8, 9));
      zs.forEach(z => cyl([x0, y, z], [x1, y, z], r * 0.8, 9));
      for (let i = 0; i < (x1 - x0) * (z1 - z0) * 0.5; i++) pt(lerp(x0, x1, R()), y, lerp(z0, z1, R()), 0.6);
    });
  }
  function lattice(cx, cz, y0, y1, h0, h1, bays, r) {
    const corner = (sx, sz, t) => [cx + sx * lerp(h0, h1, t), lerp(y0, y1, t), cz + sz * lerp(h0, h1, t)];
    const C = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    C.forEach(([sx, sz]) => cyl(corner(sx, sz, 0), corner(sx, sz, 1), r, 14));
    for (let i = 0; i <= bays; i++) {
      const t = i / bays;
      C.forEach((c, k) => {
        const n = C[(k + 1) % 4];
        cyl(corner(c[0], c[1], t), corner(n[0], n[1], t), r * 0.7, 10);
        if (i < bays) {
          const t2 = (i + 1) / bays;
          cyl(corner(c[0], c[1], t), corner(n[0], n[1], t2), r * 0.6, 9);
          cyl(corner(n[0], n[1], t), corner(c[0], c[1], t2), r * 0.6, 9);
        }
      });
    }
  }

  const FLARE = [128, -46];            // x, z of the flare stack
  const STEAM = [];                    // plume sources (x, y, z, spread)

  function column(cx, cz, r, h, platforms) {
    vcyl(cx, cz, 4, h, r, 2.4, 0.95);
    vcyl(cx, cz, 0, 4, r * 1.18, 2, 0.9);                        // skirt
    dome(cx, h, cz, r, Math.ceil(r * r * 18));
    for (let y = 8; y < h - 3; y += platforms) {
      ring(cx, y, cz, r + 1.7, Math.ceil(r * 40), 1.2);          // platform rail
      disc(cx, y, cz, r + 1.7, Math.ceil(r * 55), 0.7, r);       // grating
      ring(cx, y, cz, r + 0.1, Math.ceil(r * 24), 1.1);          // shell band
    }
    cyl([cx + r + 0.5, 0, cz], [cx + r + 0.5, h, cz], 0.2, 12, 0.9);       // ladder
    cyl([cx - r - 0.9, 3, cz + 1.2], [cx - r - 0.9, h - 6, cz + 1.2], 0.55, 8, 0.9);   // side pipe
  }

  function build() {
    // distillation columns (the tall bank in the middle)
    column(-34, -14, 6.2, 82, 9);
    column(-8, -16, 5.2, 70, 8);
    column(12, -12, 3.4, 52, 8);
    column(26, -16, 3.0, 44, 8);
    column(-58, -10, 3.2, 40, 7);
    // overhead lines and condensers
    [[-34, 82, -14, 12, 52, -12], [-8, 70, -16, 26, 44, -16], [12, 52, -12, 40, 30, -4]].forEach(([x1, y1, z1, x2, y2, z2]) => {
      cyl([x1, y1 + 3, z1], [x1, y1 + 10, z1], 0.9, 8);
      cyl([x1, y1 + 10, z1], [lerp(x1, x2, 0.9), y1 + 10, lerp(z1, z2, 0.9)], 0.9, 8);
      cyl([lerp(x1, x2, 0.9), y1 + 10, lerp(z1, z2, 0.9)], [lerp(x1, x2, 0.9), 6, lerp(z1, z2, 0.9)], 0.9, 8);
    });

    // reactors and vertical vessels
    [[48, 4], [56, -2], [64, 4], [72, -2]].forEach(([x, z]) => {
      vcyl(x, z, 2, 30, 3.6, 2.2, 0.95); dome(x, 30, z, 3.6, 220); dome(x, 2, z, 3.6, 120);
      for (let y = 6; y < 29; y += 5) ring(x, y, z, 3.9, 90, 1.1);
      cyl([x, 30, z], [x, 40, z], 0.6, 10); cyl([x, 40, z], [x + 8, 40, z], 0.6, 10);
      [0, 1, 2, 3].forEach(k => { const a = k * TAU / 4; cyl([x + Math.cos(a) * 3.2, 0, z + Math.sin(a) * 3.2], [x + Math.cos(a) * 3.2, 4, z + Math.sin(a) * 3.2], 0.4, 12); });
    });
    frame3(44, 76, -6, 8, [10, 20, 30], 8);

    // process furnaces with their stacks
    [-96, -78, -60].forEach((x, i) => {
      box(x - 7, x + 7, 0, 20, -34, -18, 3.6);
      for (let k = 0; k < 120; k++) { pt(x - 7 + R() * 14, 4 + R() * 12, -18, 1.1); }
      cyl([x, 20, -26], [x + 0, 28, -26], 1.2, 10); cyl([x, 28, -26], [x - 9 + i * 0, 28, -26], 1.0, 10);
      vcyl(x - 9, -26, 20, 64, 1.9, 2.4, 0.95);
      for (let y = 30; y < 64; y += 8) ring(x - 9, y, -26, 2.0, 40, 1.1);
      STEAM.push([x - 9, 64, -26, 5]);
    });
    // tall chimneys
    [[104, -70], [114, -74]].forEach(([x, z]) => {
      vcyl(x, z, 0, 92, 2.3, 2.4, 0.95);
      for (let y = 8; y < 92; y += 9) ring(x, y, z, 2.45, 44, 1.15);
      STEAM.push([x, 92, z, 7]);
    });

    // flare stack and knock-out drum
    lattice(FLARE[0], FLARE[1], 0, 112, 5, 0.9, 16, 0.45);
    cyl([FLARE[0], 112, FLARE[1]], [FLARE[0], 118, FLARE[1]], 0.8, 14);
    cyl([FLARE[0] - 34, 3.2, FLARE[1] + 14], [FLARE[0] - 8, 3.2, FLARE[1] + 14], 3.0, 4, 0.9);

    // tank farm: floating-roof tanks
    [[-126, 52], [-92, 52], [-58, 52], [-126, 18], [-92, 18], [-58, 18], [-24, 48]].forEach(([x, z]) => {
      const r = 14, hh = 15;
      vcyl(x, z, 0, hh, r, 2.1, 0.8);
      [3.7, 7.4, 11.1].forEach(y => ring(x, y, z, r + 0.05, 150, 1.1));
      ring(x, hh, z, r + 0.2, 360, 1.3); ring(x, hh + 0.9, z, r + 0.2, 200, 1.1);
      disc(x, hh - 1.2, z, r, 520, 0.7);
      for (let i = 0; i < 240; i++) { const t = i / 240, a = t * TAU * 1.4; pt(x + Math.cos(a) * (r + 0.7), t * hh, z + Math.sin(a) * (r + 0.7), 1.1); }
    });
    // LPG spheres
    [[10, 54], [32, 54], [54, 54], [76, 54]].forEach(([x, z]) => {
      const r = 9;
      sphere(x, r + 3.5, z, r, 1500, 0.9); ring(x, r + 3.5, z, r + 0.08, 200, 1.2);
      for (let k = 0; k < 8; k++) { const a = (k / 8) * TAU; cyl([x + Math.cos(a) * r * 0.78, 0, z + Math.sin(a) * r * 0.78], [x + Math.cos(a) * r * 0.78, r + 3.5, z + Math.sin(a) * r * 0.78], 0.35, 12); }
      ring(x, 4, z, r * 0.78, 140, 1.0);
    });

    // heat exchangers (horizontal vessels on low frames)
    for (let row = 0; row < 3; row++) for (let i = 0; i < 4; i++) {
      const x = 24 + i * 19, z = 18 + row * 8, y = 3 + (row === 1 ? 5 : 0);
      cyl([x, y, z], [x + 14, y, z], 1.7, 7, 0.95);
      dome(x + 14.2, y - 1, z, 1.2, 40, 0.8);
      [x + 2, x + 11].forEach(sx => cyl([sx, 0, z - 1], [sx, y - 1.5, z - 1], 0.3, 10));
    }
    // cooling tower cells
    [[104, 20], [104, 34], [104, 48]].forEach(([x, z]) => {
      box(x - 7, x + 7, 0, 13, z - 6, z + 6, 2.8, 0.85);
      for (let s = 0; s < 6; s++) for (let i = 0; i < 90; i++) pt(x - 7 + R() * 14, 1.5 + s * 1.9 + R() * 0.6, z + 6, 1.1);
      ring(x, 14.5, z, 4.2, 120, 1.2); vcyl(x, z, 13, 15, 4.2, 2, 0.9);
      for (let k = 0; k < 4; k++) { const a = k * TAU / 4 + 0.4; cyl([x, 14.2, z], [x + Math.cos(a) * 4, 14.2, z + Math.sin(a) * 4], 0.18, 10, 1.1); }
      STEAM.push([x, 15, z, 4]);
    });

    // pipe racks
    [[6, 'long'], [-26, 'short']].forEach(([z0, kind]) => {
      const xa = kind === 'long' ? -140 : -110, xb = kind === 'long' ? 140 : 40;
      const lvls = [7, 11];
      lvls.forEach(y => {
        for (let k = 0; k < 8; k++) {
          const zz = z0 - 3.8 + k * 1.1, rr = 0.3 + R() * 0.65;
          cyl([xa, y, zz], [xb, y, zz], rr, 10, 1);
        }
      });
      for (let x = xa; x <= xb; x += 9) {
        [-4.8, 4.8].forEach(dz => cyl([x, 0, z0 + dz], [x, 12, z0 + dz], 0.35, 12));
        lvls.forEach(y => cyl([x, y - 0.5, z0 - 4.8], [x, y - 0.5, z0 + 4.8], 0.3, 10));
      }
    });
    // risers from the racks to the columns
    [[-34, -14], [-8, -16], [12, -12], [26, -16]].forEach(([x, z]) => cyl([x + 1, 11, 4], [x + 1, 11, z], 0.7, 8));

    // compressor house frame and drums
    frame3(-120, -90, -2, 12, [8, 16], 6);
    box(-116, -100, 0, 6, 0, 8, 3.4);
    for (let i = 0; i < 3; i++) cyl([-122, 3.5 + i * 0, 24 - i * 0], [-96, 3.5, 24], 1.6, 6, 0.9);

    // ground, with two roads
    for (let i = 0; i < 9000; i++) {
      const x = lerp(-200, 200, R()), z = lerp(-130, 110, R());
      const d = Math.hypot(x / 200, z / 120);
      if (R() < 1 - d * 0.9) pt(x, 0, z, 0.5 * (1 - d * 0.8), G.GROUND);
    }
    [-62, 34, 68].forEach(z => cyl([-190, 0, z], [190, 0, z], 0.5, 3, 0.7));
    [-146, 4, 86].forEach(x => cyl([x, 0, -120], [x, 0, 100], 0.5, 3, 0.7));
  }
  build();

  // ---------- typed arrays ----------
  const N = P.length / 5;
  const px = new Float32Array(N), py = new Float32Array(N), pz = new Float32Array(N);
  const pw = new Float32Array(N), pg = new Uint8Array(N), pth = new Float32Array(N);
  const vx = new Float32Array(N), vy = new Float32Array(N), vz = new Float32Array(N);
  const YMAX = 120;
  for (let i = 0; i < N; i++) {
    px[i] = P[i * 5]; py[i] = P[i * 5 + 1]; pz[i] = P[i * 5 + 2]; pw[i] = P[i * 5 + 3]; pg[i] = P[i * 5 + 4];
    vx[i] = (R() - 0.5) * 170; vy[i] = 40 + R() * 170; vz[i] = (R() - 0.5) * 170;
    // scan order: the ground first, then upward
    pth[i] = pg[i] === G.GROUND ? R() * 0.1 : Math.min(1, 0.06 + (py[i] / YMAX) * 0.94 + (R() - 0.5) * 0.04);
  }

  // ---------- camera ----------
  let w = 0, h = 0, dpr = 1, f = 1, cxp = 0, cyp = 0;
  const DIST = 430, TY = 30;
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = hero.clientWidth; h = hero.clientHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    f = Math.max(w * 1.6, h * 2.0);
    cxp = w * 0.48; cyp = h * 0.6;
  };
  let yaw = 0.5, pitch = 0.17, sy_ = 0, cy_ = 0, sp_ = 0, cp_ = 0;
  const setCam = t => {
    yaw = 0.5 + 0.05 * Math.sin(t * 0.1);
    pitch = 0.36 + 0.012 * Math.sin(t * 0.15);
    sy_ = Math.sin(yaw); cy_ = Math.cos(yaw); sp_ = Math.sin(pitch); cp_ = Math.cos(pitch);
  };
  const proj = (x, y, z, out) => {
    const x1 = x * cy_ - z * sy_, z1 = x * sy_ + z * cy_;
    const y2 = (y - TY) * cp_ - z1 * sp_, z2 = (y - TY) * sp_ + z1 * cp_;
    const d = DIST + z2;
    out[0] = cxp + (f * x1) / d; out[1] = cyp - (f * y2) / d; out[2] = z2;
  };

  // ---------- drawing ----------
  const BUCKETS = 9;
  const bx = Array.from({ length: BUCKETS }, () => new Float32Array(N * 2));
  const bn = new Int32Array(BUCKETS);
  const front = new Float32Array(N * 2); let fn = 0;
  const o = [0, 0, 0];
  let stride = 1, slow = 0, last = performance.now(), t0 = performance.now();
  let visible = true, raf = 0;

  function frame(now) {
    raf = 0;
    const dt = now - last; last = now;
    slow = slow * 0.95 + dt * 0.05;
    if (slow > 27 && stride < 4 && !reduced) { stride++; slow = 16; }
    const t = reduced ? 20 : (now - t0) / 1000;
    setCam(t);

    const sr = stage.getBoundingClientRect();
    const ds = Math.min(1, Math.max(0, -sr.top / (0.9 * innerHeight)));
    ctx.clearRect(0, 0, w, h);
    if (ds >= 1) { if (visible && !reduced) raf = requestAnimationFrame(frame); return; }

    const prog = Math.min(1, Math.max(0, (t - 0.4) / 7)), p = prog * prog * (3 - 2 * prog);
    const rescan = t > 12 ? ((t - 12) % 18) / 18 : -1;

    bn.fill(0); fn = 0;
    for (let i = 0; i < N; i += stride) {
      const th = pth[i];
      if (th > p) continue;
      let kd = 0;
      if (ds > 0) {
        kd = Math.min(1, Math.max(0, (ds - (1 - th) * 0.55) / 0.45));
        if (kd >= 1) continue;
      }
      if (kd > 0) { const e = kd * kd; proj(px[i] + vx[i] * e, py[i] + vy[i] * e, pz[i] + vz[i] * e, o); }
      else proj(px[i], py[i], pz[i], o);
      const sx = o[0], sy = o[1];
      if (sx < -2 || sx > w + 2 || sy < -2 || sy > h + 2) continue;
      let a = pw[i] * (0.3 + 0.7 * Math.min(1, Math.max(0, 1 - (o[2] + 170) / 340)));
      if (kd > 0) a *= Math.pow(1 - kd, 1.2);
      const onFront = prog < 1 ? p - th < 0.018 : rescan >= 0 && Math.abs(rescan * 1.15 - 0.075 - th) < 0.012;
      if (onFront) { front[fn++] = sx; front[fn++] = sy; continue; }
      const b = Math.min(BUCKETS - 1, Math.max(0, (a * BUCKETS) | 0));
      bx[b][bn[b]++] = sx; bx[b][bn[b]++] = sy;
    }
    const sz = Math.max(1.15, w / 1100);
    for (let b = 0; b < BUCKETS; b++) {
      if (!bn[b]) continue;
      ctx.fillStyle = `rgba(${CREAM},${(0.12 + (0.88 * (b + 0.5)) / BUCKETS).toFixed(3)})`;
      const arr = bx[b];
      for (let j = 0; j < bn[b]; j += 2) ctx.fillRect(arr[j], arr[j + 1], sz, sz);
    }
    ctx.fillStyle = `rgba(${CREAM},1)`;
    for (let j = 0; j < fn; j += 2) ctx.fillRect(front[j] - 0.6, front[j + 1] - 0.6, 2.4, 2.4);

    const live = Math.min(1, Math.max(0, (p - 0.7) * 3.3)) * (1 - Math.min(1, ds * 2.5));
    if (live > 0.01) {
      // steam rising from stacks and cooling cells
      STEAM.forEach(([x0, y0, z0, spread], si) => {
        for (let i = 0; i < 70; i++) {
          const u = (t * 0.1 + i / 70 + si * 0.37) % 1;
          const x = x0 + Math.sin(i * 12.9 + si * 3 + t * 0.4) * spread * u + u * 22;
          const z = z0 + Math.cos(i * 7.7 + si) * spread * u;
          proj(x, y0 + u * 46, z, o);
          ctx.fillStyle = `rgba(${CREAM},${(Math.sin(u * Math.PI) * 0.4 * live).toFixed(3)})`;
          const s2 = 1.2 + u * 1.6; ctx.fillRect(o[0], o[1], s2, s2);
        }
      });
      // flare flame
      for (let i = 0; i < 150; i++) {
        const u = Math.pow(Math.random(), 1.4), wid = (1 - u) * 1.9 + 0.2;
        proj(FLARE[0] + (Math.random() - 0.5) * wid * 2 + u * 3, 118 + u * 15 + Math.sin(t * 9 + i) * 0.6, FLARE[1] + (Math.random() - 0.5) * wid * 2, o);
        ctx.fillStyle = `rgba(${SIGNAL},${((0.9 - u * 0.6) * live).toFixed(3)})`;
        ctx.fillRect(o[0], o[1], 1.7, 1.7);
      }
      proj(FLARE[0], 121, FLARE[1], o);
      const g = ctx.createRadialGradient(o[0], o[1], 0, o[0], o[1], 34);
      g.addColorStop(0, `rgba(${SIGNAL},${0.32 * live * (0.8 + 0.2 * Math.sin(t * 11))})`); g.addColorStop(1, `rgba(${SIGNAL},0)`);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(o[0], o[1], 34, 0, 6.3); ctx.fill();

      // the point, on a dotted loop high above the site
      const DR = [150, 80], DY = 96, ang = t * 0.2;
      ctx.fillStyle = `rgba(${SIGNAL},${0.35 * live})`;
      for (let i = 0; i < 140; i++) { const a = (i / 140) * TAU; proj(Math.cos(a) * DR[0], DY, Math.sin(a) * DR[1] - 10, o); ctx.fillRect(o[0], o[1], 1.3, 1.3); }
      proj(Math.cos(ang) * DR[0], DY + 5 * Math.sin(t * 0.9), Math.sin(ang) * DR[1] - 10, o);
      const gg = ctx.createRadialGradient(o[0], o[1], 0, o[0], o[1], 16);
      gg.addColorStop(0, `rgba(${SIGNAL},${0.45 * live})`); gg.addColorStop(1, `rgba(${SIGNAL},0)`);
      ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(o[0], o[1], 16, 0, 6.3); ctx.fill();
      ctx.fillStyle = `rgba(${SIGNAL},${live})`; ctx.beginPath(); ctx.arc(o[0], o[1], 2.8, 0, 6.3); ctx.fill();
    }

    if (visible && !reduced) raf = requestAnimationFrame(frame);
  }

  const start = () => { if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  new ResizeObserver(() => { resize(); if (reduced) frame(performance.now()); }).observe(hero);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; start(); }).observe(stage);
  if (reduced) addEventListener('scroll', () => frame(performance.now()), { passive: true });
  resize();
  start();
  window.__refineryPoints = N;
})();
