// Hero: a sea of points. Drag sideways to turn the view, up and down to change
// the sea state. A flat deck rides the swell and a point settles onto it.
(() => {
  const hero = document.querySelector('.hero');
  const canvas = document.getElementById('sea');
  const ctx = canvas.getContext('2d');
  const rSS = document.getElementById('r-ss');
  const rHeave = document.getElementById('r-heave');
  const rYaw = document.getElementById('r-yaw');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const COLS = 120, ROWS = 76;
  const XW = 46, ZD = 70, ZMIN = -4;          // world width and depth of the grid
  const CAM_H = 6.2, Z0 = 9;       // camera height and near-plane offset
  const DECK_Z = 8;                // where the deck floats
  const CREAM = '239,230,214', SIGNAL = '255,79,26';

  let w = 0, h = 0, dpr = 1;
  let yaw = 0, yawT = 0;           // radians
  let sea = 0.45, seaT = 0.45;     // 0..1, drives wave height
  let dragging = false, lastX = 0, lastY = 0;
  let visible = true, raf = 0, t0 = performance.now();

  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = hero.clientWidth; h = hero.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const wave = (x, z, t, a) =>
    a * (0.6 * Math.sin(0.34 * x + 0.9 * t) +
         0.8 * Math.sin(0.21 * z + 0.7 * t + 0.1 * x) +
         0.25 * Math.sin(0.6 * x - 0.4 * z + 1.3 * t));

  // World (x, y, z) to screen. Yaw turns the scene around the deck.
  const project = (x, y, z) => {
    const dz = z - DECK_Z;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const rx = x * c - dz * s;
    const rz = x * s + dz * c + DECK_Z;
    const f = h * 0.52;
    const k = f / (rz + Z0);
    return { x: w / 2 + rx * k, y: h * 0.3 + (CAM_H - y) * k, k, z: rz };
  };

  const frame = now => {
    raf = 0;
    const t = reduced ? 2 : (now - t0) / 1000;
    yaw += (yawT - yaw) * 0.06;
    sea += (seaT - sea) * 0.06;
    const amp = 0.12 + sea * 1.1;

    ctx.clearRect(0, 0, w, h);

    // Sea surface as points.
    for (let r = 0; r < ROWS; r++) {
      const z = ZMIN + (r / (ROWS - 1)) ** 1.6 * (ZD - ZMIN);
      for (let c = 0; c < COLS; c++) {
        const x = (c / (COLS - 1) - 0.5) * XW * (1 + z * 0.05);
        const y = wave(x, z, t, amp);
        const p = project(x, y, z);
        if (p.x < -4 || p.x > w + 4 || p.y < 0 || p.y > h + 4) continue;
        const depthFade = Math.max(0, 1 - p.z / (ZD * 0.95));
        const crest = Math.min(1, Math.max(0, (y / amp + 1) / 2));
        const edge = Math.min(1, (h - p.y) / (h * 0.16));
        const a = (0.2 + 0.8 * crest) * Math.min(1, depthFade * 1.4) * edge;
        ctx.fillStyle = `rgba(${CREAM},${a.toFixed(3)})`;
        const size = Math.max(0.7, p.k * 0.045);
        ctx.fillRect(p.x, p.y, size, size);
      }
    }

    // Deck: four corners each ride the swell, so it tilts with it.
    const hw = 3.4, hd = 2.2;
    const corner = (dx, dz) => project(dx, wave(dx, DECK_Z + dz, t, amp) + 0.08, DECK_Z + dz);
    const q = [corner(-hw, -hd), corner(hw, -hd), corner(hw, hd), corner(-hw, hd)];
    ctx.strokeStyle = `rgba(${CREAM},.9)`;
    ctx.fillStyle = `rgba(${CREAM},.08)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    q.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.closePath(); ctx.fill(); ctx.stroke();

    const deckY = wave(0, DECK_Z, t, amp) + 0.08;
    const dc = project(0, deckY, DECK_Z);

    // Crosshair on the deck.
    const cr = Math.max(4, dc.k * 0.28);
    ctx.strokeStyle = `rgba(${SIGNAL},.9)`;
    ctx.beginPath();
    ctx.moveTo(dc.x - cr, dc.y); ctx.lineTo(dc.x + cr, dc.y);
    ctx.moveTo(dc.x, dc.y - cr); ctx.lineTo(dc.x, dc.y + cr);
    ctx.stroke();

    // The point: down, hold, up, rest. Loops every 12 seconds.
    const cycle = (t % 12) / 12;
    const ease = u => u * u * (3 - 2 * u);
    let lift = 0;                                   // 0 on the deck, 1 high above
    if (cycle < 0.08) lift = 1 - ease(cycle / 0.08) * 0;      // waiting high up
    else if (cycle < 0.45) lift = 1 - ease((cycle - 0.08) / 0.37);
    else if (cycle < 0.7) lift = 0;
    else if (cycle < 0.9) lift = ease((cycle - 0.7) / 0.2);
    else lift = 1;
    const altitude = 0.1 + lift * 10;
    const lp = project(0, deckY + altitude, DECK_Z);
    const vis = cycle >= 0.08 && cycle < 0.9 ? 1 : 0.15;

    ctx.strokeStyle = `rgba(${SIGNAL},${(0.35 * vis).toFixed(3)})`;
    ctx.setLineDash([2, 6]);
    ctx.beginPath(); ctx.moveTo(lp.x, lp.y); ctx.lineTo(dc.x, dc.y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = `rgba(${SIGNAL},${vis})`;
    ctx.beginPath(); ctx.arc(lp.x, lp.y, Math.max(2.5, dc.k * 0.07), 0, 6.2832); ctx.fill();

    // Readouts, throttled by rounding.
    rSS.textContent = String(Math.round(1 + sea * 6)).padStart(2, '0');
    const heave = deckY - 0.08;
    rHeave.textContent = (heave >= 0 ? '+' : '−') + Math.abs(heave).toFixed(2);
    rYaw.textContent = String(Math.round(((yaw * 180) / Math.PI + 360) % 360)).padStart(3, '0');

    if (visible && !reduced) raf = requestAnimationFrame(frame);
  };

  const start = () => { if (!raf && visible) raf = requestAnimationFrame(frame); };

  hero.addEventListener('pointerdown', e => {
    dragging = true; lastX = e.clientX; lastY = e.clientY;
    hero.classList.add('dragging');
    hero.setPointerCapture(e.pointerId);
  });
  hero.addEventListener('pointermove', e => {
    if (!dragging) return;
    yawT = Math.max(-0.7, Math.min(0.7, yawT + (e.clientX - lastX) * 0.004));
    seaT = Math.max(0, Math.min(1, seaT - (e.clientY - lastY) * 0.003));
    lastX = e.clientX; lastY = e.clientY;
  });
  const up = () => { dragging = false; hero.classList.remove('dragging'); };
  hero.addEventListener('pointerup', up);
  hero.addEventListener('pointercancel', up);

  new ResizeObserver(() => { resize(); if (reduced) frame(performance.now()); }).observe(hero);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; start(); }).observe(hero);

  resize();
  start();
})();
