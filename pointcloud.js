// Hero v3: a scanned point cloud of a fixed offshore jacket platform.
// The structure is generated in metres (jacket, decks, modules, derrick, flare
// boom, crane, helideck), then "scanned" into view from the seabed up.
// No orbit controls: the view only drifts a few degrees. A small orange point
// circles the structure on a dotted path.
(() => {
  const hero = document.querySelector('.hero');
  const stage = document.querySelector('.stage');
  const canvas = document.getElementById('cloud');
  const ctx = canvas.getContext('2d');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CREAM = '239,230,214', SIGNAL = '255,79,26', NIGHT = '15,11,13';

  // ---------- seeded random so the structure is identical every load ----------
  let seed = 7;
  const R = () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // ---------- point generation (world metres, y up, still water at y = 0) ----------
  const P = [];                         // x, y, z, weight, group
  const G = { STRUCT: 0, SEA: 1, BED: 2 };
  const pt = (x, y, z, wgt = 1, g = G.STRUCT) => P.push(x, y, z, wgt, g);
  const lerp = (a, b, t) => a + (b - a) * t;

  function cyl(a, b, r, perM, wgt = 1) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-6) return;
    const d = [dx / len, dy / len, dz / len];
    const ref = Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    let u = [d[1] * ref[2] - d[2] * ref[1], d[2] * ref[0] - d[0] * ref[2], d[0] * ref[1] - d[1] * ref[0]];
    const ul = Math.hypot(...u); u = u.map(v => v / ul);
    const v = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]];
    const n = Math.max(3, Math.ceil(len * perM * Math.max(0.6, r)));
    for (let i = 0; i < n; i++) {
      const t = R(), th = R() * 6.2832, c = Math.cos(th) * r, s = Math.sin(th) * r;
      pt(a[0] + dx * t + u[0] * c + v[0] * s, a[1] + dy * t + u[1] * c + v[1] * s, a[2] + dz * t + u[2] * c + v[2] * s, wgt);
    }
  }

  function box(x0, x1, y0, y1, z0, z1, dens, wgt = 0.9) {
    const sx = x1 - x0, sy = y1 - y0, sz = z1 - z0;
    const faces = [[sy * sz, 'x0'], [sy * sz, 'x1'], [sx * sz, 'y0'], [sx * sz, 'y1'], [sx * sy, 'z0'], [sx * sy, 'z1']];
    faces.forEach(([area, f]) => {
      const n = Math.ceil(area * dens);
      for (let i = 0; i < n; i++) {
        const a = R(), b = R();
        if (f === 'x0') pt(x0, y0 + a * sy, z0 + b * sz, wgt);
        else if (f === 'x1') pt(x1, y0 + a * sy, z0 + b * sz, wgt);
        else if (f === 'y0') pt(x0 + a * sx, y0, z0 + b * sz, wgt * 0.7);
        else if (f === 'y1') pt(x0 + a * sx, y1, z0 + b * sz, wgt);
        else if (f === 'z0') pt(x0 + a * sx, y0 + b * sy, z0, wgt);
        else pt(x0 + a * sx, y0 + b * sy, z1, wgt);
      }
    });
  }

  function plate(x0, x1, z0, z1, y, dens, wgt = 0.85) {
    const n = Math.ceil((x1 - x0) * (z1 - z0) * dens);
    for (let i = 0; i < n; i++) {
      let x = lerp(x0, x1, R()), z = lerp(z0, z1, R());
      if (R() < 0.45) x = Math.round(x / 1.6) * 1.6;           // grating lines
      else if (R() < 0.45) z = Math.round(z / 1.6) * 1.6;
      pt(Math.max(x0, Math.min(x1, x)), y, Math.max(z0, Math.min(z1, z)), wgt);
    }
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

  function build() {
    // jacket: four battered legs, X-braced faces
    const SB = -80, TOP = 8;
    const hx = y => lerp(26, 16, (y - SB) / (TOP - SB)), hz = y => lerp(20, 12, (y - SB) / (TOP - SB));
    const corner = (sx, sz, y) => [sx * hx(y), y, sz * hz(y)];
    const C = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    C.forEach(([sx, sz]) => {
      cyl(corner(sx, sz, SB), corner(sx, sz, TOP), 1.3, 26);
      cyl([sx * 26, SB, sz * 20], [sx * 26, SB - 10, sz * 20], 1.5, 12, 0.7);   // pile sleeves
    });
    const lv = [SB, -58, -36, -16, TOP];
    lv.forEach((y, i) => {
      C.forEach((c, k) => {
        const n = C[(k + 1) % 4];
        cyl(corner(c[0], c[1], y), corner(n[0], n[1], y), 0.55, 10);
        if (i < lv.length - 1) {
          const y2 = lv[i + 1];
          cyl(corner(c[0], c[1], y), corner(n[0], n[1], y2), 0.5, 9);
          cyl(corner(n[0], n[1], y), corner(c[0], c[1], y2), 0.5, 9);
        }
      });
    });
    for (let i = 0; i < 6; i++) cyl([-9 + i * 3.6, SB, 0], [-9 + i * 3.6, 12, 0], 0.4, 10, 0.8);   // risers and conductors

    // decks and their supports
    plate(-22, 22, -17, 17, 8.5, 3.2);
    plate(-23, 23, -18, 18, 14.5, 3.6);
    [[-22, -17], [22, -17], [22, 17], [-22, 17], [0, -17], [0, 17]].forEach(([x, z]) => cyl([x, 8.5, z], [x, 14.5, z], 0.55, 12));
    [[-23, -18, 23, -18], [23, -18, 23, 18], [23, 18, -23, 18], [-23, 18, -23, -18]].forEach(([x1, z1, x2, z2]) => {
      cyl([x1, 14.5, z1], [x2, 14.5, z2], 0.45, 10); cyl([x1 * 0.96, 8.5, z1 * 0.96], [x2 * 0.96, 8.5, z2 * 0.96], 0.4, 9);
    });

    // modules
    box(-22, -3, 15, 27, -17, 1, 4.2);          // wellhead
    box(-1, 10, 15, 24, -17, 6, 4.2);           // process
    box(-22, -5, 15, 22, 3, 17, 4.2);           // compression
    box(-3, 10, 15, 20, 8, 17, 4.2);            // utilities
    box(13, 23, 15, 39, -17, -3, 4.6, 0.95);    // accommodation
    [20, 24, 28, 32, 36].forEach(y => {          // window rows
      for (let i = 0; i < 160; i++) { pt(23, y + R() * 1.5, lerp(-16, -4, R()), 1.1); pt(lerp(14, 22, R()), y + R() * 1.5, -17, 1.1); }
    });
    for (let i = 0; i < 14; i++) {              // deck piping
      const y = 16 + R() * 4, x = lerp(-20, 8, R()), z = lerp(-14, 14, R());
      cyl([x, y, z], [x + lerp(-8, 8, R()), y, z + lerp(-6, 6, R())], 0.3, 10, 0.7);
    }

    // helideck, cantilevered off the accommodation block
    const hc = [34, 39, -10], hr = 10.5;
    for (let i = 0; i < 1500; i++) {
      const a = R() * 6.2832, rr = hr * Math.sqrt(R());
      pt(hc[0] + Math.cos(a) * rr, hc[1], hc[2] + Math.sin(a) * rr, 0.8);
    }
    for (let i = 0; i < 360; i++) { const a = (i / 360) * 6.2832; pt(hc[0] + Math.cos(a) * hr, hc[1], hc[2] + Math.sin(a) * hr, 1.25); pt(hc[0] + Math.cos(a) * hr * 0.78, hc[1], hc[2] + Math.sin(a) * hr * 0.78, 1.1); }
    for (let i = 0; i < 260; i++) {              // the H
      const q = R();
      if (q < 0.34) pt(hc[0] - 2.2 + R() * 0.7, hc[1] + 0.05, hc[2] - 2.8 + R() * 5.6, 1.3);
      else if (q < 0.68) pt(hc[0] + 1.6 + R() * 0.7, hc[1] + 0.05, hc[2] - 2.8 + R() * 5.6, 1.3);
      else pt(hc[0] - 2 + R() * 4.2, hc[1] + 0.05, hc[2] - 0.3 + R() * 0.7, 1.3);
    }
    [[23, 30, -16, 26, 38.5, -18.5], [23, 30, -4, 26, 38.5, -1.5], [23, 24, -10, 30, 38.5, -10]].forEach(([x1, y1, z1, x2, y2, z2]) => cyl([x1, y1, z1], [x2, y2, z2], 0.5, 12));

    // derrick on the wellhead module
    lattice(-12, -7, 27, 72, 5, 1.8, 8, 0.45);
    box(-14.5, -9.5, 72, 75, -9.5, -4.5, 5, 1);
    // flare boom
    cyl([23, 22, 8], [54, 74, 24], 0.45, 12); cyl([23, 22, 11], [54, 74, 26], 0.45, 12);
    for (let i = 1; i < 12; i++) { const t = i / 12; cyl([lerp(23, 54, t), lerp(22, 74, t), lerp(8, 24, t)], [lerp(23, 54, t), lerp(22, 74, t), lerp(11, 26, t)], 0.3, 8, 0.8); }
    for (let i = 0; i < 90; i++) pt(54 + (R() - 0.5) * 2.4, 75 + (R() - 0.5) * 2.4, 24.5 + (R() - 0.5) * 2.4, 1.1);
    // crane
    cyl([-18, 27, 12], [-18, 33, 12], 1.6, 16);
    box(-20, -16, 33, 36.5, 10, 14, 5);
    cyl([-18, 36, 11.2], [-52, 58, 30], 0.45, 12); cyl([-18, 36, 13.2], [-52, 58, 31.5], 0.45, 12);
    for (let i = 1; i < 12; i++) { const t = i / 12; cyl([lerp(-18, -52, t), lerp(36, 58, t), lerp(11.2, 30, t)], [lerp(-18, -52, t), lerp(36, 58, t), lerp(13.2, 31.5, t)], 0.28, 8, 0.8); }
    cyl([-18, 36, 12], [-22, 50, 12], 0.4, 10); cyl([-22, 50, 12], [-52, 58, 30.5], 0.2, 12, 0.7);
    // radio mast
    cyl([18, 39, -10], [18, 54, -10], 0.3, 14); cyl([15, 49, -10], [21, 49, -10], 0.25, 10);

    // sea surface and seabed fields, with local grid rings
    for (let i = 0; i < 9000; i++) {
      const a = R() * 6.2832, rr = 240 * Math.pow(R(), 0.65);
      const x = Math.cos(a) * rr, z = Math.sin(a) * rr;
      pt(x, 0.6 * Math.sin(x * 0.05) + 0.4 * Math.sin(z * 0.07), z, 0.5 * (1 - rr / 270), G.SEA);
    }
    for (let i = 0; i < 9000; i++) {
      const a = R() * 6.2832, rr = 250 * Math.pow(R(), 0.7);
      pt(Math.cos(a) * rr, SB + R() * 1.4, Math.sin(a) * rr, 0.5 * (1 - rr / 280), G.BED);
    }
    [60, 120, 180].forEach(rr => {
      for (let i = 0; i < 700; i++) { const a = (i / 700) * 6.2832; pt(Math.cos(a) * rr, 0, Math.sin(a) * rr, 0.7, G.SEA); }
    });
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * 6.2832;
      for (let i = 0; i < 40; i++) { const rr = 176 + i * 0.4; pt(Math.cos(a) * rr, 0, Math.sin(a) * rr, 0.9, G.SEA); }
    }
  }
  build();

  // ---------- typed arrays and reveal thresholds ----------
  const N = P.length / 5;
  const px = new Float32Array(N), py = new Float32Array(N), pz = new Float32Array(N);
  const pw = new Float32Array(N), pg = new Uint8Array(N), pth = new Float32Array(N);
  const YMIN = -90, YMAX = 76;
  const vx = new Float32Array(N), vy = new Float32Array(N), vz = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    vx[i] = (R() - 0.5) * 150; vy[i] = 30 + R() * 150; vz[i] = (R() - 0.5) * 150;
    px[i] = P[i * 5]; py[i] = P[i * 5 + 1]; pz[i] = P[i * 5 + 2]; pw[i] = P[i * 5 + 3]; pg[i] = P[i * 5 + 4];
    pth[i] = Math.min(1, Math.max(0, (py[i] - YMIN) / (YMAX - YMIN) + (R() - 0.5) * 0.05));
    if (pg[i] === G.SEA) pth[i] = 0.5 + R() * 0.2;
    if (pg[i] === G.BED) pth[i] = R() * 0.12;
  }

  // ---------- camera ----------
  let w = 0, h = 0, dpr = 1, f = 1, cxp = 0, cyp = 0;
  const DIST = 330, TY = -4;
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = hero.clientWidth; h = hero.clientHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    f = Math.min(h * 1.36, w * 1.0);
    cxp = w * 0.5; cyp = h * 0.51;
  };

  let yaw = 0.62, pitch = 0.2, sy_ = 0, cy_ = 0, sp_ = 0, cp_ = 0;
  const setCam = t => {
    yaw = 0.62 + 0.07 * Math.sin(t * 0.11);
    pitch = 0.2 + 0.015 * Math.sin(t * 0.17);
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
  let stride = 1, slow = 0, last = performance.now(), t0 = performance.now(), shown = 0;

  function label(text, sx, sy, dx, dy) {
    ctx.font = '500 10.5px "IBM Plex Mono", monospace';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '1.3px';
    const tw = ctx.measureText(text).width + 16, bxx = sx + dx, byy = sy + dy;
    ctx.strokeStyle = `rgba(${CREAM},.45)`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(bxx, byy + 11); ctx.stroke();
    ctx.fillStyle = `rgba(${NIGHT},.88)`; ctx.fillRect(bxx, byy, tw, 22);
    ctx.strokeRect(bxx + 0.5, byy + 0.5, tw, 22);
    ctx.fillStyle = `rgba(${CREAM},.85)`; ctx.textAlign = 'left'; ctx.fillText(text, bxx + 8, byy + 15);
  }

  function frame(now) {
    raf = 0;
    const dt = now - last; last = now;
    slow = slow * 0.95 + dt * 0.05;
    if (slow > 27 && stride < 3 && !reduced) { stride++; slow = 16; }
    const t = reduced ? 20 : (now - t0) / 1000;
    setCam(t);
    const sr = stage.getBoundingClientRect();
    const ds = Math.min(1, Math.max(0, -sr.top / (0.9 * innerHeight)));   // dissolve progress, 0..1
    if (ds >= 1) { ctx.clearRect(0, 0, w, h); if (visible && !reduced) raf = requestAnimationFrame(frame); return; }

    const prog = Math.min(1, Math.max(0, (t - 0.4) / 7)), p = prog * prog * (3 - 2 * prog);
    const rescan = t > 12 ? ((t - 12) % 16) / 16 : -1;

    ctx.clearRect(0, 0, w, h);

    // elevation ruler along the left edge, tied to the structure's vertical axis
    const rl = 26;
    ctx.font = '400 10px "IBM Plex Mono", monospace';
    if ('letterSpacing' in ctx) ctx.letterSpacing = '1px';
    for (let y = -80; y <= 80; y += 10) {
      proj(0, y, 0, o);
      const major = y % 40 === 0, a = Math.min(1, p * 3) * (1 - Math.min(1, ds * 3));
      ctx.strokeStyle = `rgba(${CREAM},${(major ? 0.5 : 0.22) * a})`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, o[1]); ctx.lineTo(major ? 16 : 9, o[1]); ctx.stroke();
      if (major) { ctx.fillStyle = `rgba(${CREAM},${0.45 * a})`; ctx.textAlign = 'left'; ctx.fillText(y > 0 ? `+${y}` : y < 0 ? `−${-y}` : '0', 22, o[1] + 3.5); }
    }

    bn.fill(0); fn = 0; shown = 0;
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
      shown++;
      let a = pw[i] * (0.4 + 0.6 * Math.min(1, Math.max(0, 1 - (o[2] + 120) / 240)));
      if (pg[i] === G.STRUCT && py[i] < 0) a *= 0.58;
      if (kd > 0) a *= Math.pow(1 - kd, 1.2);
      const onFront = prog < 1 ? p - th < 0.018 : rescan >= 0 && Math.abs(rescan * 1.15 - 0.075 - th) < 0.012;
      if (onFront) { front[fn++] = sx; front[fn++] = sy; continue; }
      const b = Math.min(BUCKETS - 1, Math.max(0, (a * BUCKETS) | 0));
      bx[b][bn[b]++] = sx; bx[b][bn[b]++] = sy;
    }
    const sz = Math.max(1.15, f / DIST * 0.0 + 1.25);
    for (let b = 0; b < BUCKETS; b++) {
      if (!bn[b]) continue;
      ctx.fillStyle = `rgba(${CREAM},${(0.12 + (0.88 * (b + 0.5)) / BUCKETS).toFixed(3)})`;
      const arr = bx[b];
      for (let j = 0; j < bn[b]; j += 2) ctx.fillRect(arr[j], arr[j + 1], sz, sz);
    }
    ctx.fillStyle = `rgba(${CREAM},1)`;
    for (let j = 0; j < fn; j += 2) ctx.fillRect(front[j] - 0.6, front[j + 1] - 0.6, 2.4, 2.4);

    // drone on a dotted loop around the structure
    const ang = t * 0.22, DR = [84, 60], DY = 64;
    ctx.fillStyle = `rgba(${SIGNAL},${0.4 * Math.min(1, p * 2) * (1 - Math.min(1, ds * 2.5))})`;
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * 6.2832;
      proj(Math.cos(a) * DR[0], DY, Math.sin(a) * DR[1], o);
      ctx.fillRect(o[0], o[1], 1.3, 1.3);
    }
    proj(Math.cos(ang) * DR[0], DY + 4 * Math.sin(t * 0.9), Math.sin(ang) * DR[1], o);
    const dx = o[0], dy = o[1], da = Math.min(1, Math.max(0, (p - 0.55) * 3)) * (1 - Math.min(1, ds * 2.5));
    const g = ctx.createRadialGradient(dx, dy, 0, dx, dy, 16);
    g.addColorStop(0, `rgba(${SIGNAL},${0.45 * da})`); g.addColorStop(1, `rgba(${SIGNAL},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(dx, dy, 16, 0, 6.3); ctx.fill();
    ctx.fillStyle = `rgba(${SIGNAL},${da})`; ctx.beginPath(); ctx.arc(dx, dy, 2.8, 0, 6.3); ctx.fill();

    // flags, once the scan has passed them
    if (p > 0.9 && ds < 0.25) {
      const fa = Math.min(1, (p - 0.9) * 10) * (1 - Math.min(1, ds * 4));
      ctx.globalAlpha = fa;
      proj(34, 39, -10, o); label('P-01 / HELIDECK +39.0', o[0], o[1], 26, -44);
      proj(26, -80, 20, o); label('P-02 / SEABED −80.0', o[0], o[1], 46, -34);
      ctx.globalAlpha = 1;
    }

    if (visible && !reduced) raf = requestAnimationFrame(frame);
  }

  let visible = true, raf = 0;
  const start = () => { if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  new ResizeObserver(() => { resize(); if (reduced) frame(performance.now()); }).observe(hero);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; start(); }).observe(stage);
  if (reduced) addEventListener('scroll', () => frame(performance.now()), { passive: true });
  resize();
  (document.fonts?.ready || Promise.resolve()).then(start);
})();
