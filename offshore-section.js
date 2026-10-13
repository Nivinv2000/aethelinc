// Hero v2: a true-scale cross-section of real offshore infrastructure.
// A fixed jacket platform, a supply vessel and two 15 MW-class wind turbines,
// drawn in metres (1 unit = 1 m) so every height and depth is a real figure.
// Masses are filled with grain, the same material as the footer.
// A small orange point comes down onto the vessel's aft deck. No explanatory text.
(() => {
  const hero = document.querySelector('.hero');
  const canvas = document.getElementById('offshore');
  const ctx = canvas.getContext('2d');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const CREAM = '239,230,214', SIGNAL = '255,79,26';

  // ---------- world, in metres. x right, y up, y = 0 at still water (LAT) ----------
  const PLAT_X = -170;            // jacket platform centre
  const PSV_X = -72;              // supply vessel stern
  const PSV_L = 82;
  const TURBINES = [120, 335];    // 15 MW-class: hub +150, rotor 236 m
  const HUB = 150, BLADE = 118;
  const seabed = x => -84 + (x + 250) * 0.084;
  const wave = (x, t) => 1.1 * Math.sin(x * 0.045 + t * 0.9) + 0.6 * Math.sin(x * 0.11 - t * 1.4);
  const SPAN = [-318, 462];

  let w = 0, h = 0, dpr = 1, k = 1, cx = 0, wl = 0;
  let bg = null, tileMass = null, tileLight = null;
  let visible = true, raf = 0, t0 = performance.now();
  let mx = 0, tx = 0;

  const X = x => cx + x * k;
  const Y = y => wl - y * k;

  const layer = () => {
    const c = document.createElement('canvas');
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    const x = c.getContext('2d');
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { c, x };
  };

  const tile = density => {
    const s = 128, c = document.createElement('canvas');
    c.width = c.height = s * dpr;
    const x = c.getContext('2d');
    x.scale(dpr, dpr);
    x.fillStyle = `rgb(${CREAM})`;
    for (let i = 0; i < s * s * density; i++) x.fillRect(Math.random() * s, Math.random() * s, 1.15, 1.15);
    const p = ctx.createPattern(c, 'repeat');
    p.setTransform(new DOMMatrix().scale(1 / dpr));
    return p;
  };

  // ---------- drawing helpers ----------
  const stroke = (c, a = 0.9, wd = 1) => { c.strokeStyle = `rgba(${CREAM},${a})`; c.lineWidth = wd; };
  const seg = (c, x1, y1, x2, y2) => { c.beginPath(); c.moveTo(X(x1), Y(y1)); c.lineTo(X(x2), Y(y2)); c.stroke(); };
  const poly = (c, pts, fill) => {
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(X(x), Y(y)) : c.moveTo(X(x), Y(y))));
    c.closePath();
    if (fill) { c.fillStyle = fill; c.fill(); }
    c.stroke();
  };
  const rect = (c, x1, y1, x2, y2, fill) => poly(c, [[x1, y1], [x2, y1], [x2, y2], [x1, y2]], fill);

  // ---------- static structures ----------
  function jacket(c, x0) {
    const top = 8;
    const sbL = seabed(x0 - 39), sbR = seabed(x0 + 39);
    const lx = (side, y, yb) => x0 + side * (39 - 16 * (y - yb) / (top - yb));
    stroke(c, 0.5, 1);                                   // rear legs, further from the viewer
    [-1, 1].forEach(s => seg(c, x0 + s * 14, (s < 0 ? sbL : sbR) + 1, x0 + s * 8, top));
    stroke(c, 0.9, 1.1);
    [[-1, sbL], [1, sbR]].forEach(([s, yb]) => seg(c, lx(s, yb, yb), yb, lx(s, top, yb), top));
    // braces: X pattern between five levels, taking each side's own seabed
    const ys = [0, 0.27, 0.54, 0.77, 1].map(f => sbL + (top - sbL) * f);
    ys.forEach((y, i) => {
      seg(c, lx(-1, y, sbL), y, lx(1, y, sbL), y);
      if (i < 4) {
        const y2 = ys[i + 1];
        seg(c, lx(-1, y, sbL), y, lx(1, y2, sbL), y2);
        seg(c, lx(1, y, sbL), y, lx(-1, y2, sbL), y2);
      }
    });
    // pile skirts at the mud line
    stroke(c, 0.7, 1);
    seg(c, x0 - 40.5, sbL, x0 - 40.5, sbL - 7); seg(c, x0 + 40.5, sbR, x0 + 40.5, sbR - 7);

    // topsides
    stroke(c, 0.95, 1);
    rect(c, x0 - 36, 8, x0 + 36, 13, tileLight);        // cellar deck
    rect(c, x0 - 38, 13, x0 - 6, 27, tileMass);          // module A
    rect(c, x0 - 4, 13, x0 + 20, 23, tileMass);          // module B
    rect(c, x0 + 22, 13, x0 + 38, 36, tileMass);         // accommodation
    stroke(c, 0.5, 1);
    [19, 24, 29, 33].forEach(y => seg(c, x0 + 25, y, x0 + 35, y));
    stroke(c, 0.95, 1);
    rect(c, x0 + 19, 36, x0 + 52, 37.4, tileMass);       // helideck
    seg(c, x0 + 24, 36, x0 + 19, 31); seg(c, x0 + 48, 36, x0 + 38, 29);
    // derrick
    stroke(c, 0.9, 1);
    seg(c, x0 - 33, 27, x0 - 26, 86); seg(c, x0 - 19, 27, x0 - 24, 86);
    for (let i = 1; i < 7; i++) {
      const f = i / 7, y = 27 + 59 * f, a = -33 + 7 * f, b = -19 - 5 * f;
      seg(c, x0 + a, y, x0 + b, y);
      seg(c, x0 + a, y, x0 + (i % 2 ? b : a) + 0, y + 8);
    }
    // flare boom
    seg(c, x0 + 36, 30, x0 + 70, 86); seg(c, x0 + 33, 30, x0 + 67, 86);
    // crane
    seg(c, x0 - 36, 27, x0 - 36, 36); seg(c, x0 - 36, 36, x0 - 70, 60); seg(c, x0 - 36, 33, x0 - 66, 56);
    seg(c, x0 - 66, 58, x0 - 66, 48);
  }

  function mast(c, xt) {
    const sb = seabed(xt);
    stroke(c, 0.5, 1);
    rect(c, xt - 4.5, sb, xt + 4.5, 20, null);          // monopile and transition piece (lower part underwater)
    stroke(c, 0.95, 1);
    seg(c, xt - 4.5, 20, xt - 4.5, 0.001);
    seg(c, xt + 4.5, 20, xt + 4.5, 0.001);
    poly(c, [[xt - 4.2, 20], [xt + 4.2, 20], [xt + 2.8, HUB - 2], [xt - 2.8, HUB - 2]], tileLight);
    rect(c, xt - 7, 17.5, xt + 7, 20, tileMass);        // platform
    seg(c, xt - 4.5, 4, xt - 7.5, 4); seg(c, xt - 7.5, 4, xt - 7.5, 17.5);   // boat landing
    rect(c, xt - 4, HUB - 4, xt + 16, HUB + 4, tileMass); // nacelle
  }

  // ---------- grain beneath, above and around ----------
  function build() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = hero.clientWidth; h = hero.clientHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    k = Math.min(h * 0.0019, (w * 0.94) / (SPAN[1] - SPAN[0]));
    cx = w / 2 - ((SPAN[0] + SPAN[1]) / 2) * k;
    wl = Math.round(h * 0.6);
    tileMass = tile(0.5); tileLight = tile(0.2);

    const L = layer(), c = L.x;
    c.fillStyle = `rgb(${CREAM})`;

    // sky: thin at the top, denser toward the water
    for (let i = 0, n = w * wl * 0.05; i < n; i++) {
      const x = Math.random() * w, y = Math.random() * wl, g = Math.pow(y / wl, 3);
      if (Math.random() < g * 0.9) { c.globalAlpha = 0.15 + 0.4 * g; c.fillRect(x, y, 1.2, 1.2); }
    }
    // water column: dense at the surface, fading with depth
    for (let i = 0, n = w * (h - wl) * 0.1; i < n; i++) {
      const x = Math.random() * w, sb = Y(seabed((x - cx) / k));
      const u = Math.pow(Math.random(), 1.4), y = wl + u * (sb - wl);
      c.globalAlpha = 0.06 + 0.42 * Math.pow(1 - u, 1.8);
      c.fillRect(x, y, 1.15, 1.15);
    }
    // sediment below the seabed
    for (let i = 0, n = w * h * 0.03; i < n; i++) {
      const x = Math.random() * w, sb = Y(seabed((x - cx) / k));
      const y = sb + Math.pow(Math.random(), 1.6) * (h - sb);
      if (y > sb) { c.globalAlpha = 0.32 * Math.pow(1 - (y - sb) / (h - sb), 1.4) + 0.02; c.fillRect(x, y, 1.15, 1.15); }
    }
    c.globalAlpha = 1;

    // seabed line, with two dashed strata below it
    stroke(c, 0.9, 1);
    [0, 14, 38].forEach((off, i) => {
      c.setLineDash(i ? [3, 7] : []);
      c.strokeStyle = `rgba(${CREAM},${i ? 0.25 : 0.9})`;
      c.beginPath();
      for (let x = SPAN[0] - 60; x <= SPAN[1] + 60; x += 8) {
        const px = X(x), py = Y(seabed(x) - off);
        x === SPAN[0] - 60 ? c.moveTo(px, py) : c.lineTo(px, py);
      }
      c.stroke();
    });
    c.setLineDash([]);

    jacket(c, PLAT_X);
    TURBINES.forEach(xt => mast(c, xt));

    // dimension marks and labels
    c.font = '500 10.5px "IBM Plex Mono", monospace';
    if ('letterSpacing' in c) c.letterSpacing = '1.4px';
    const label = (txt, x, y, align = 'left', a = 0.62) => {
      c.fillStyle = `rgba(${CREAM},${a})`; c.textAlign = align; c.fillText(txt, x, y);
    };
    const vdim = (xw, y1, y2, txt, side = 1) => {
      stroke(c, 0.4, 1);
      seg(c, xw, y1, xw, y2);
      [y1, y2].forEach(y => { c.beginPath(); c.moveTo(X(xw) - 4, Y(y)); c.lineTo(X(xw) + 4, Y(y)); c.stroke(); });
      label(txt, X(xw) + side * 8, Y((y1 + y2) / 2) + 4, side > 0 ? 'left' : 'right');
    };
    const hdim = (x1, x2, yw, txt) => {
      stroke(c, 0.4, 1);
      seg(c, x1, yw, x2, yw);
      [x1, x2].forEach(x => { c.beginPath(); c.moveTo(X(x), Y(yw) - 4); c.lineTo(X(x), Y(yw) + 4); c.stroke(); });
      label(txt, X((x1 + x2) / 2), Y(yw) - 9, 'center');
    };
    // waterline datum, running the full width
    c.setLineDash([2, 6]); stroke(c, 0.3, 1);
    c.beginPath(); c.moveTo(0, wl); c.lineTo(w, wl); c.stroke(); c.setLineDash([]);
    label('LAT ±0.00', w - 16, wl - 8, 'right');
    const t1 = TURBINES[0];
    vdim(t1 + 24, 0, HUB, 'HUB +150.0');
    hdim(t1 - BLADE - 4, t1 + BLADE + 4, HUB + BLADE + 14, 'Ø 236 M');
    vdim(PLAT_X - 70, 0, 28, 'DECK +28.0', -1);
    vdim(PLAT_X + 58, 0, 37.4, '');
    label('HELIDECK +37.4', X(PLAT_X + 58) - 4, Y(37.4) - 9, 'left');
    vdim(PLAT_X - 54, seabed(PLAT_X - 54), 0, `${Math.round(-seabed(PLAT_X))} M`, -1);
    label(`SEABED −${Math.round(-seabed(t1))}`, X(t1 + 14), Y(seabed(t1)) + 34);
    // scale bar
    const sbx = 16, sby = h - 34;
    stroke(c, 0.7, 1);
    c.beginPath(); c.moveTo(sbx, sby); c.lineTo(sbx + 100 * k, sby);
    [0, 50, 100].forEach(m => { c.moveTo(sbx + m * k, sby - 4); c.lineTo(sbx + m * k, sby + 4); });
    c.stroke();
    label('0', sbx, sby - 10, 'center'); label('50', sbx + 50 * k, sby - 10, 'center'); label('100 M', sbx + 100 * k, sby - 10, 'center');
    // sheet marks
    label('FIG. 01 / SECTION A–A', 16, 96, 'left', 0.7);
    label('DEPTHS TO LAT', w - 16, 96, 'right', 0.45);

    bg = L.c;
  }

  // ---------- moving parts ----------
  const hullAt = (t) => {
    // bob and pitch from the swell under the vessel
    const a = wave(PSV_X, t), b = wave(PSV_X + PSV_L, t);
    return { heave: (a + b) / 2 * 0.8, pitch: Math.atan2(b - a, PSV_L) * 0.7 };
  };

  function vessel(t) {
    const { heave, pitch } = hullAt(t);
    const pivotX = X(PSV_X + PSV_L / 2), pivotY = Y(0);
    ctx.save();
    ctx.translate(pivotX, pivotY - heave * k);
    ctx.rotate(-pitch);
    ctx.translate(-pivotX, -pivotY);
    const loc = pts => pts.map(([x, y]) => [PSV_X + x, y]);
    stroke(ctx, 0.95, 1);
    poly(ctx, loc([[0, -6], [60, -6.5], [76, -2], [82, 6], [70, 8], [0, 6]]), tileMass);   // hull
    poly(ctx, loc([[56, 6], [56, 22], [73, 22], [73, 6]]), tileMass);                      // deckhouse
    poly(ctx, loc([[54, 22], [75, 22], [75, 26], [54, 26]]), tileLight);                   // bridge
    stroke(ctx, 0.6, 1);
    seg(ctx, PSV_X + 58, 18, PSV_X + 71, 18);
    seg(ctx, PSV_X + 64, 26, PSV_X + 64, 38); seg(ctx, PSV_X + 60, 35, PSV_X + 68, 35);    // mast
    stroke(ctx, 0.6, 1);
    seg(ctx, PSV_X + 2, 9, PSV_X + 54, 9);                                                  // rail
    for (let x = 2; x <= 54; x += 6) seg(ctx, PSV_X + x, 6, PSV_X + x, 9);
    stroke(ctx, 0.9, 1);
    rect(ctx, PSV_X + 8, 6, PSV_X + 24, 10.5, tileLight);                                   // containers
    rect(ctx, PSV_X + 28, 6, PSV_X + 44, 10.5, tileLight);
    ctx.restore();
  }

  function rotor(t) {
    TURBINES.forEach((xt, n) => {
      const hubx = xt - 6;
      const spin = t * 0.5 + n * 1.3;
      stroke(ctx, 0.95, 1);
      for (let b = 0; b < 3; b++) {
        const a = spin + (b * Math.PI * 2) / 3;
        const ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
        const prof = [[4, 3.2], [10, 5.2], [22, 5.5], [60, 3.2], [118, 0.4]];
        const front = prof.map(([r, wd]) => [hubx + ux * r + nx * wd * 0.5, HUB + uy * r + ny * wd * 0.5]);
        const back = prof.slice().reverse().map(([r, wd]) => [hubx + ux * r - nx * wd * 0.5, HUB + uy * r - ny * wd * 0.5]);
        poly(ctx, front.concat(back), tileLight);
      }
      ctx.beginPath(); ctx.arc(X(hubx), Y(HUB), 4.4 * k, 0, 6.3);
      ctx.fillStyle = tileMass; ctx.fill(); stroke(ctx, 0.95, 1); ctx.stroke();
    });
  }

  function waterline(t) {
    stroke(ctx, 0.85, 1.1);
    ctx.beginPath();
    for (let px = 0; px <= w; px += 4) {
      const x = (px - cx) / k;
      const y = wl - wave(x, t) * k * 0.9;
      px ? ctx.lineTo(px, y) : ctx.moveTo(px, y);
    }
    ctx.stroke();
  }

  function point(t) {
    const { heave, pitch } = hullAt(t);
    const deckLocal = 34;                                           // aft cargo deck, metres from the stern
    const dx = PSV_X + deckLocal, dy = 6 + heave - Math.sin(pitch) * deckLocal * 0.1;
    const cycle = 18, u = (t % cycle) / cycle;
    const e = v => v * v * (3 - 2 * v);
    const sx = PSV_X + 130, sy = 125;                               // arrival point
    let x, y, a = 1;
    if (u < 0.5) { const f = e(u / 0.5); x = sx + (dx - sx) * f; y = sy + (dy + 3 - sy) * f; }
    else if (u < 0.78) { x = dx + Math.sin(t * 1.4) * 0.35; y = dy + 3 + Math.sin(t * 1.9) * 0.3; }
    else { const f = e((u - 0.78) / 0.22); x = dx + (sx - dx) * f; y = dy + 3 + (sy - dy - 3) * f; }
    a = u < 0.05 ? u / 0.05 : u > 0.94 ? (1 - u) / 0.06 : 1;
    const px = X(x), py = Y(y);

    ctx.setLineDash([2, 5]);
    ctx.strokeStyle = `rgba(${SIGNAL},${0.5 * a})`; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(X(dx), Y(dy)); ctx.stroke();
    ctx.setLineDash([]);
    const g = ctx.createRadialGradient(px, py, 0, px, py, 15);
    g.addColorStop(0, `rgba(${SIGNAL},${0.4 * a})`); g.addColorStop(1, `rgba(${SIGNAL},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, 15, 0, 6.3); ctx.fill();
    ctx.fillStyle = `rgba(${SIGNAL},${a})`; ctx.beginPath(); ctx.arc(px, py, 2.6, 0, 6.3); ctx.fill();
    // deck mark
    ctx.strokeStyle = `rgba(${SIGNAL},.9)`; ctx.beginPath();
    ctx.moveTo(X(dx) - 5, Y(dy)); ctx.lineTo(X(dx) + 5, Y(dy)); ctx.moveTo(X(dx), Y(dy) - 5); ctx.lineTo(X(dx), Y(dy) + 5); ctx.stroke();
  }

  function frame(now) {
    raf = 0;
    const t = reduced ? 4 : (now - t0) / 1000;
    mx += (tx - mx) * 0.05;
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(bg, mx * -3, 0, w, h);
    rotor(t);
    vessel(t);
    waterline(t);
    point(t);
    if (visible && !reduced) raf = requestAnimationFrame(frame);
  }

  const start = () => { if (!raf && visible && bg) raf = requestAnimationFrame(frame); };
  hero.addEventListener('pointermove', e => { tx = (e.clientX / hero.clientWidth) - 0.5; });

  let rt;
  const rebuild = () => { build(); if (reduced) frame(performance.now()); else start(); };
  new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(rebuild, 150); }).observe(hero);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; start(); }).observe(hero);
  (document.fonts?.ready || Promise.resolve()).then(rebuild);
})();
