// Hero v6: the deck's print look, alive. Cobalt, navy and cream, with grain.
// The scene (stars, moon, rig, ships, turbines, sea) is drawn as flat tones onto a
// hidden canvas every frame; a WebGL shader then turns those tones into three
// printed inks with ragged edges and speckle. Rotors turn, ships drift, stars
// twinkle. Scrolling drains the cream sea back to blue and fades the scene,
// uncovering the footer fixed underneath.
//   data-variant="field"   : hundreds of turbines receding to the horizon
//   data-variant="handful" : six turbines on the horizon, like the deck
(() => {
  const hero = document.querySelector('.hero');
  const stage = document.querySelector('.stage');
  const glc = document.getElementById('gl');
  const dotc = document.getElementById('dot');
  const dctx = dotc.getContext('2d');
  const variant = document.documentElement.dataset.variant || 'field';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TAU = Math.PI * 2;

  let seed = 21;
  const R = () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const ease = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };

  // ---------- WebGL: tones in, three inks out ----------
  const gl = glc.getContext('webgl', { alpha: true, premultipliedAlpha: false, antialias: false });
  if (!gl) return;
  const VS = `attribute vec2 p; varying vec2 vUv; void main(){ vUv = p*0.5+0.5; gl_Position = vec4(p,0.,1.); }`;
  const FS = `precision highp float;
    uniform sampler2D uTex; uniform vec2 uRes; uniform float uDrain; uniform float uTime;
    varying vec2 vUv;
    float hash(vec2 p){ p = fract(p*vec2(123.34,456.21)); p += dot(p,p+45.32); return fract(p.x*p.y); }
    float vn(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
      return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
    void main(){
      vec2 px = vec2(vUv.x*uRes.x, (1.-vUv.y)*uRes.y);
      vec2 warp = (vec2(vn(px*0.33), vn(px*0.33+17.))-0.5)*2.4;            // ragged edges
      vec2 uv = vec2((px.x+warp.x)/uRes.x, 1.-(px.y+warp.y)/uRes.y);
      vec4 s = texture2D(uTex, uv);
      float yt = 1.-vUv.y;
      float g = s.r;
      g = mix(g, 0.4, clamp(uDrain*1.7 - (1.-yt)*0.35, 0., 1.));            // ink drains toward blue
      float n = vn(px*0.55)*0.45 + hash(floor(px))*0.55;                    // mid and fine grain
      float t = g + (n-0.5)*0.42;
      if (s.b > 0.5) t = 1.0;                                                // stars, moon, arc stay cream
      vec3 navy = vec3(0.055,0.145,0.43), cobalt = vec3(0.086,0.25,0.70), cream = vec3(0.98,0.82,0.60);
      cobalt = mix(cobalt, vec3(0.07,0.2,0.6), vn(px*0.012)*0.6);
      vec3 col = t < 0.2 ? navy : (t < 0.62 ? cobalt : cream);
      float sp = hash(floor(px*0.9)+7.);
      if (col == cream && sp > 0.972) col = cobalt;                           // paper showing through
      if (col == cobalt && sp < 0.006) col = cream;                           // stray flecks
      gl_FragColor = vec4(col, 1.);
    }`;
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog); gl.useProgram(prog);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const uRes = gl.getUniformLocation(prog, 'uRes'), uDrain = gl.getUniformLocation(prog, 'uDrain'), uTime = gl.getUniformLocation(prog, 'uTime');

  // ---------- scene (flat tones on a hidden 2D canvas) ----------
  const scene = document.createElement('canvas');
  const c = scene.getContext('2d');
  const seaLayer = document.createElement('canvas');
  let w = 0, h = 0, dpr = 1, hz = 0, F = 1;
  let stars = [], sparkles = [], turbines = [], ships = [], rig = null;
  let S = 1, portrait = false, nodes = [], links = [], pulses = [];

  const tone = (L, extra = 0) => `rgb(${Math.round(L * 255)},0,${extra})`;     // r = tone, b = "always cream"
  const poly = (pts, fill) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.closePath(); c.fillStyle = fill; c.fill(); };

  // silhouettes: origin at the waterline, x along the hull, scaled by k
  function drawCargo(x, y, k, L) {
    c.save(); c.translate(x, y); c.scale(k, k); const f = tone(L);
    poly([[-150, -4], [160, -4], [178, -26], [-150, -26]], f);
    for (let r = 0; r < 2; r++) for (let i = 0; i < 8; i++) c.fillRect(-138 + i * 26, -26 - 15 * (r + 1) + 1, 22, 13);
    c.fillRect(100, -78, 30, 52); c.fillRect(96, -88, 38, 10); c.fillRect(138, -50, 8, 24);
    c.fillRect(114, -108, 2.4, 22); c.fillRect(108, -102, 14, 2);
    c.restore();
  }
  function drawTanker(x, y, k, L) {
    c.save(); c.translate(x, y); c.scale(k, k); const f = tone(L);
    poly([[-160, -2], [152, -2], [176, -20], [-160, -20]], f);
    c.fillRect(-146, -62, 34, 42); c.fillRect(-150, -72, 42, 10); c.fillRect(-112, -42, 6, 22);
    for (let i = 0; i < 5; i++) c.fillRect(-70 + i * 36, -32, 5, 12);
    c.fillRect(-60, -29, 190, 3); c.fillRect(140, -50, 2.4, 30); c.fillRect(100, -44, 2.4, 24); c.fillRect(-130, -96, 2.4, 24);
    c.restore();
  }
  function drawTrawler(x, y, k, L) {
    c.save(); c.translate(x, y); c.scale(k, k); const f = tone(L);
    poly([[-50, -2], [48, -2], [64, -22], [-50, -22]], f);
    c.fillRect(-14, -50, 26, 28); c.fillRect(-18, -56, 34, 6);
    c.fillRect(-34, -88, 2.4, 66); c.fillRect(24, -70, 2.4, 48);
    c.strokeStyle = f; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-33, -86); c.lineTo(48, -22); c.moveTo(-33, -86); c.lineTo(-50, -22); c.stroke();
    c.fillRect(34, -46, 30, 3); c.restore();
  }
  function drawRig(x, y, k, L) {
    c.save(); c.translate(x, y); c.scale(k, k); const f = tone(L);
    [-58, -30, -2, 26].forEach(lx => c.fillRect(lx, -46, 9, 46));
    c.fillRect(-84, -78, 140, 12); c.fillRect(-72, -64, 112, 20);
    c.fillRect(-62, -104, 40, 26); c.fillRect(-14, -96, 34, 18); c.fillRect(26, -116, 24, 38);
    poly([[-52, -104], [-34, -104], [-43, -178]], f);
    c.fillRect(-46, -190, 6, 14);
    c.strokeStyle = f; c.lineWidth = 6; c.beginPath(); c.moveTo(50, -92); c.lineTo(92, -150); c.stroke();
    c.lineWidth = 3; c.beginPath(); c.moveTo(70, -112); c.lineTo(104, -90); c.stroke();
    c.fillRect(-116, -72, 36, 4); c.restore();
  }
  function drawTurbine(x, base, s, L, ang, spin) {
    const f = tone(L), hh = 150 * s, bw = Math.max(0.7, 3.4 * s);
    poly([[x - bw, base], [x + bw, base], [x + bw * 0.55, base - hh], [x - bw * 0.55, base - hh]], f);
    c.fillStyle = f; c.fillRect(x - 2 * s, base - hh - 4 * s, 16 * s, 8 * s);
    const hx = x, hy = base - hh;
    for (let b = 0; b < 3; b++) {
      const a = ang + spin + b * 2.0944, ux = Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux, len = 118 * s, wd = Math.max(0.8, 4.4 * s);
      poly([[hx + nx * wd * 0.4, hy + ny * wd * 0.4], [hx + ux * len * 0.22 + nx * wd, hy + uy * len * 0.22 + ny * wd], [hx + ux * len, hy + uy * len], [hx + ux * len * 0.22 - nx * wd * 0.3, hy + uy * len * 0.22 - ny * wd * 0.3], [hx - nx * wd * 0.4, hy - ny * wd * 0.4]], f);
    }
    c.beginPath(); c.arc(hx, hy, Math.max(1, 4 * s), 0, TAU); c.fill();
  }
  function pool(x, y, rx, k) {                       // thin ripple rings and a short reflection under the hull
    c.lineWidth = Math.max(1, 1.5 * k);
    for (let i = 0; i < 3; i++) {
      c.strokeStyle = tone(i === 1 ? 0.97 : 0.3);
      c.beginPath(); c.ellipse(x, y + 3, rx * (1.05 + i * 0.13), rx * (0.075 + i * 0.012) + 2, 0, 0, TAU); c.stroke();
    }
    c.fillStyle = tone(0.0);
    for (let i = 0; i < 3; i++) c.fillRect(x - rx * (0.78 - i * 0.2), y + 6 + i * 5 * k, rx * (1.5 - i * 0.4), Math.max(1.2, 2 * k));
  }

  function layout() {
    seed = 21;
    portrait = w / h < 0.9;
    S = clamp(Math.min(w / 1440, h / 810), 0.4, 1.15);
    hz = Math.round(h * (portrait ? 0.54 : 0.58));
    F = portrait ? w * clamp(0.9 - w / 2200, 0.5, 0.78) : Math.max(w * 0.3, h * 0.55);

    // sea strokes, drawn once: cobalt streaks that thicken toward the viewer
    const SW = w + 60;                                 // spare width so the drifting slices never show an edge
    seaLayer.width = SW; seaLayer.height = h - hz;
    const s = seaLayer.getContext('2d');
    const g = s.createLinearGradient(0, 0, 0, h - hz);
    g.addColorStop(0, tone(0.93)); g.addColorStop(0.5, tone(0.82)); g.addColorStop(1, tone(0.56));
    s.fillStyle = g; s.fillRect(0, 0, SW, h - hz);
    for (let i = 0, n = SW * (h - hz) / 90; i < n; i++) {
      const u = Math.pow(R(), 0.8), y = u * (h - hz), len = 6 + R() * (24 + u * 130), th = 0.8 + R() * (0.6 + u * 3.2);
      s.fillStyle = tone(R() < 0.82 ? 0.36 : 0.0); s.fillRect(R() * SW, y, len, th);
    }
    for (let i = 0, n = SW * (h - hz) / 260; i < n; i++) {
      const u = 0.25 + R() * 0.75, y = u * (h - hz), len = 10 + R() * (30 + u * 110);
      s.fillStyle = tone(0.97); s.fillRect(R() * SW, y, len, 1 + R() * (0.5 + u * 2));
    }

    // sky
    stars = []; sparkles = [];
    const nStars = clamp(Math.round(330 * (w * h) / (1440 * 810)), 110, 420);
    for (let i = 0; i < nStars; i++) stars.push([R() * w, R() * hz * 0.96, 0.8 + R() * 1.6, R() * TAU]);
    for (let i = 0; i < 16; i++) sparkles.push([R() * w, R() * hz * 0.7, 5 + R() * 7, R() * TAU]);

    // objects: depth d runs from the horizon (0) toward the viewer (1)
    const at = d => hz + d * (h - hz) * 0.9;
    rig = { x: w * 0.13, d: 0.3 };
    rig.y = at(rig.d); rig.k = (0.7 + rig.d * 2.1) * S;
    ships = [
      { type: 'cargo', x: w * 0.30, d: 0.78, sp: 3.0 }, { type: 'tanker', x: w * 0.68, d: 0.42, sp: -2.2 },
      { type: 'trawler', x: w * 0.9, d: 0.2, sp: -1.5 }, { type: 'trawler', x: w * 0.78, d: 0.86, sp: 2.4 },
      { type: 'tanker', x: w * 0.74, d: 0.07, sp: 1.0 }
    ].map(o => ({ ...o, cx: o.x, y: at(o.d), k: ((o.type === 'trawler' ? 0.5 : 0.42) + o.d * (o.type === 'trawler' ? 1.5 : 1.7)) * S, ph: R() * TAU }));

    turbines = [];
    if (variant === 'handful') {
      const sc = [0.9, 0.82, 0.72, 0.64, 0.56, 0.5];
      sc.forEach((s2, i) => turbines.push({ x: w * (0.4 + i * 0.054), base: hz + 7 + (0.9 - s2) * 8, s: s2 * S * 0.9, L: 0, ang: R() * TAU, om: 0.5 + R() * 0.3 }));
    } else {
      for (let zi = 0; zi < 19; zi++) {
        const z = 380 * Math.pow(1.16, zi), sp = 460 + z * 0.06, sS = F / z;
        const xr = Math.ceil((w * 0.7) / sS / sp);
        for (let xi = -xr; xi <= xr; xi++) {
          if (R() < 0.08) continue;
          const wx = xi * sp + (zi % 2 ? sp / 2 : 0) + (R() - 0.5) * 10;
          const fog = clamp(1 - z / 5200);
          turbines.push({ x: w / 2 + wx * sS, base: hz + 36 * sS, s: sS, L: (1 - fog) * 0.34, ang: R() * TAU, om: 0.36 + R() * 0.22, z });
        }
      }
      turbines.sort((p, q) => q.z - p.z);
    }
    // keep the area behind the rig clean
    const rl = rig.x - 130 * rig.k, rr = rig.x + 125 * rig.k;
    turbines = turbines.filter(tb => !(tb.x + 118 * tb.s > rl && tb.x - 118 * tb.s < rr));
    buildNetwork();
  }

  // ---------- the network layer: a clean overlay above the printed world ----------
  function buildNetwork() {
    nodes = []; links = []; pulses = [];
    const cols = portrait ? 4 : 8, rows = portrait ? 4 : 3;
    const top = h * 0.07, band = hz * (portrait ? 0.5 : 0.4);
    for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
      nodes.push({ x: w * (0.06 + 0.88 * (q + 0.5 + (R() - 0.5) * 0.7) / cols), y: top + band * (r + 0.5 + (R() - 0.5) * 0.7) / rows, ph: R() * TAU, mesh: true });
    }
    const meshN = nodes.length;
    const have = new Set();
    const link = (a, b, dashed) => { const key = a < b ? a + '_' + b : b + '_' + a; if (a === b || have.has(key)) return; have.add(key); links.push({ a, b, dashed }); };
    for (let i = 0; i < meshN; i++) {
      const near = [];
      for (let j = 0; j < meshN; j++) if (j !== i) near.push([Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y), j]);
      near.sort((p, q) => p[0] - q[0]);
      for (let k = 0; k < 2 + (R() < 0.5 ? 1 : 0); k++) link(i, near[k][1], false);
    }
    // assets: the rig crown, ship masts and a few turbine hubs
    const assets = [{ get: () => [rig.x - 43 * rig.k, rig.y - 190 * rig.k] }];
    ships.forEach(sh => {
      const off = sh.type === 'cargo' ? [115, -108] : sh.type === 'tanker' ? [-129, -96] : [-33, -88];
      if (sh.d > 0.15) assets.push({ get: () => [sh.cx + off[0] * sh.k, sh.y + off[1] * sh.k] });
    });
    const big = turbines.slice().sort((p, q) => q.s - p.s);
    const picked = [];
    for (const tb of big) { if (picked.length >= (portrait ? 2 : 4)) break; if (picked.every(p => Math.abs(p.x - tb.x) > w * 0.16)) picked.push(tb); }
    picked.forEach(tb => assets.push({ get: () => [tb.x, tb.base - 150 * tb.s] }));
    assets.forEach(as => {
      const [ax, ay] = as.get();
      const idx = nodes.length; nodes.push({ x: ax, y: ay, ph: 0, asset: as });
      const near = [];
      for (let j = 0; j < meshN; j++) near.push([Math.hypot(ax - nodes[j].x, ay - nodes[j].y), j]);
      near.sort((p, q) => p[0] - q[0]);
      link(idx, near[0][1], true); link(idx, near[1][1], true);
    });
    for (let i = 0; i < (portrait ? 8 : 14); i++) pulses.push(newPulse(null));
  }
  function newPulse(from) {
    const assetIdx = nodes.map((n, i) => (n.asset ? i : -1)).filter(i => i >= 0);
    const start = from !== null ? from : assetIdx[(R() * assetIdx.length) | 0];
    const opts = links.filter(l => l.a === start || l.b === start);
    const l = opts[(Math.random() * opts.length) | 0];
    if (!l) return { a: start, b: start, u: 1, sp: 0.4 };
    return { a: start, b: l.a === start ? l.b : l.a, u: from !== null ? 0 : Math.random(), sp: 0.22 + Math.random() * 0.3 };
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    w = hero.clientWidth; h = hero.clientHeight;
    scene.width = w; scene.height = h;
    glc.width = Math.round(w * dpr); glc.height = Math.round(h * dpr);
    dotc.width = Math.round(w * dpr); dotc.height = Math.round(h * dpr);
    dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    gl.viewport(0, 0, glc.width, glc.height);
    layout();
  }

  // ---------- frame ----------
  let visible = true, raf = 0, t0 = performance.now();
  function frame(now) {
    raf = 0;
    const t = reduced ? 7 : (now - t0) / 1000;
    const sr = stage.getBoundingClientRect();
    const ds = clamp(-sr.top / (0.9 * innerHeight));
    if (ds >= 1) { glc.style.opacity = 0; dotc.style.opacity = 0; if (visible && !reduced) raf = requestAnimationFrame(frame); return; }
    const intro = reduced ? 0 : 1 - ease(0.2, 3.2, t);                         // the ink floods in
    const drain = Math.max(ds * 1.0, intro);
    glc.style.opacity = (1 - ease(0.45, 0.95, ds)).toFixed(3);
    dotc.style.opacity = (1 - ease(0.1, 0.5, ds)).toFixed(3);

    // sky
    c.fillStyle = tone(0.4); c.fillRect(0, 0, w, hz);
    const hg = c.createLinearGradient(0, hz - 90, 0, hz);
    hg.addColorStop(0, tone(0.4)); hg.addColorStop(1, tone(0.6));
    c.fillStyle = hg; c.fillRect(0, hz - 90, w, 90);
    // sea with drifting slices
    c.fillStyle = tone(0.9); c.fillRect(0, hz, w, h - hz);
    for (let y = 0; y < h - hz; y += 5) {
      const d = y / (h - hz);
      c.drawImage(seaLayer, 0, y, w + 60, 5, -30 + Math.sin(y * 0.04 + t * 0.55) * (1 + d * 7), hz + y, w + 60, 5);
    }
    // stars, sparkles, moon, the dotted arc: drawn into the blue channel so they stay cream
    stars.forEach(([x, y, r, ph]) => { const tw = 0.5 + 0.5 * Math.sin(t * 1.3 + ph); if (tw > 0.28) { c.fillStyle = 'rgb(0,0,255)'; c.fillRect(x, y, r, r); } });
    sparkles.forEach(([x, y, r, ph]) => {
      const tw = 0.55 + 0.45 * Math.sin(t * 0.9 + ph); const s = r * tw; c.fillStyle = 'rgb(0,0,255)';
      poly([[x, y - s], [x + s * 0.18, y - s * 0.18], [x + s, y], [x + s * 0.18, y + s * 0.18], [x, y + s], [x - s * 0.18, y + s * 0.18], [x - s, y], [x - s * 0.18, y - s * 0.18]], c.fillStyle);
    });
    const mr = Math.max(15, 31 * S), mx = w * 0.86, my = Math.max(h * 0.15, mr * 2.6);
    c.fillStyle = 'rgb(0,0,255)'; c.beginPath(); c.arc(mx, my, mr, 0, TAU); c.fill();
    c.fillStyle = tone(0.4); c.beginPath(); c.arc(mx + mr * 0.42, my - mr * 0.18, mr * 0.86, 0, TAU); c.fill();

    // water pools and ripples first, then the silhouettes on top
    const bob = Math.sin(t * 0.8) * 1.2;
    pool(rig.x, rig.y, 150 * rig.k, rig.k);
    ships.forEach(s => {
      const span = w + 700, x = ((s.x + s.sp * t + 350) % span + span) % span - 350;
      s.cx = x; pool(x, s.y, (s.type === 'trawler' ? 62 : 178) * s.k, s.k);
    });
    turbines.forEach(tb => drawTurbine(tb.x, tb.base, tb.s, tb.L, tb.ang, t * tb.om));
    drawRig(rig.x, rig.y + bob, rig.k, 0);
    ships.forEach(s => {
      const yy = s.y + Math.sin(t * 0.9 + s.ph) * 1.6;
      (s.type === 'cargo' ? drawCargo : s.type === 'tanker' ? drawTanker : drawTrawler)(s.cx, yy, s.k, 0);
    });

    // upload and print
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, scene);
    gl.uniform2f(uRes, w, h); gl.uniform1f(uDrain, drain); gl.uniform1f(uTime, t);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // the network layer, crisp and clean over the print
    dctx.clearRect(0, 0, w, h);
    const alive = 1 - intro;
    const pos = nodes.map(n => n.asset ? n.asset.get() : [n.x + Math.sin(t * 0.3 + n.ph) * 5, n.y + Math.cos(t * 0.27 + n.ph) * 4]);
    dctx.lineWidth = 1;
    links.forEach(l => {
      const A = pos[l.a], B = pos[l.b];
      dctx.setLineDash(l.dashed ? [3, 5] : []);
      dctx.strokeStyle = `rgba(255,236,200,${(l.dashed ? 0.42 : 0.3) * alive})`;
      dctx.beginPath(); dctx.moveTo(A[0], A[1]); dctx.lineTo(B[0], B[1]); dctx.stroke();
    });
    dctx.setLineDash([]);
    nodes.forEach((n, i) => {
      const [x, y] = pos[i];
      if (n.asset) {
        dctx.strokeStyle = `rgba(255,236,200,${0.7 * alive})`; dctx.beginPath(); dctx.arc(x, y, 4.5, 0, TAU); dctx.stroke();
        dctx.fillStyle = `rgba(255,236,200,${alive})`; dctx.beginPath(); dctx.arc(x, y, 2, 0, TAU); dctx.fill();
      } else {
        const rr = 5 + 1.6 * Math.sin(t * 0.9 + n.ph);
        dctx.strokeStyle = `rgba(255,236,200,${0.22 * alive})`; dctx.beginPath(); dctx.arc(x, y, rr, 0, TAU); dctx.stroke();
        dctx.fillStyle = `rgba(255,236,200,${0.85 * alive})`; dctx.beginPath(); dctx.arc(x, y, 2.1, 0, TAU); dctx.fill();
      }
    });
    const dtp = reduced ? 0 : 1 / 60;
    pulses.forEach((p, i) => {
      p.u += p.sp * dtp;
      if (p.u >= 1) { pulses[i] = Object.assign(p, newPulse(p.b)); return; }
      const A = pos[p.a], B = pos[p.b];
      const x = A[0] + (B[0] - A[0]) * p.u, y = A[1] + (B[1] - A[1]) * p.u;
      const u0 = Math.max(0, p.u - 0.14), tx = A[0] + (B[0] - A[0]) * u0, ty = A[1] + (B[1] - A[1]) * u0;
      const gr = dctx.createLinearGradient(tx, ty, x, y);
      gr.addColorStop(0, 'rgba(255,236,200,0)'); gr.addColorStop(1, `rgba(255,236,200,${0.9 * alive})`);
      dctx.strokeStyle = gr; dctx.lineWidth = 1.6; dctx.beginPath(); dctx.moveTo(tx, ty); dctx.lineTo(x, y); dctx.stroke();
      dctx.fillStyle = `rgba(255,248,225,${alive})`; dctx.beginPath(); dctx.arc(x, y, 2.4, 0, TAU); dctx.fill();
    });
    dctx.lineWidth = 1;

    if (visible && !reduced) raf = requestAnimationFrame(frame);
  }

  const start = () => { if (!raf && visible) raf = requestAnimationFrame(frame); };
  let rt;
  const rebuild = () => { resize(); if (reduced) frame(performance.now()); else start(); };
  new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(rebuild, 150); }).observe(hero);
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; start(); }).observe(stage);
  if (reduced) addEventListener('scroll', () => frame(performance.now()), { passive: true });
  rebuild();
  window.__riso = () => ({ variant, turbines: turbines.length });
})();
