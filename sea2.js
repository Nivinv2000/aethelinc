// Single screen: open sea, drawn as a reflecting surface. The water is a rippled,
// darker copy of the sky, so it reads as sea. Two looks, set by <html data-look>:
//   dawn : calm ocean before sunrise, cool white light low on the horizon
//   moon : glassy sea at night, a small white moon and its silver path
(() => {
  const canvas = document.getElementById('sky');
  const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false });
  if (!gl) return;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const look = (new URLSearchParams(location.search).get('look') || document.documentElement.dataset.look || 'dawn') === 'moon' ? 1 : 0;

  const VS = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }';
  const FS = `precision highp float;
  uniform vec2 uRes; uniform float uT; uniform float uLook; uniform float uBank;
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
    return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }

  // light position (x in height units, elevation above the horizon)
  vec2 lightPos(float asp){ return uLook < .5 ? vec2(-0.12 * asp * .5, -0.02) : vec2(0.30 * asp * .5, 0.23); }

  vec3 sky(float e, float dx, float asp, float disc){
    vec3 col;
    if (uLook < .5) {
      // pre-dawn: slate overhead, a pale cool band at the horizon, white glow where the sun will rise
      col = mix(vec3(0.035, 0.05, 0.075), vec3(0.28, 0.32, 0.37), exp(-max(e, 0.) * 7.));
      col = mix(col, vec3(0.62, 0.66, 0.70), exp(-max(e, 0.) * 38.) * 0.75);
      float g = exp(-dx*dx*2.4) * exp(-max(e, 0.) * 9.);
      col += vec3(0.95, 0.94, 0.92) * g * 0.42;
      col += vec3(1.0, 0.99, 0.97) * exp(-pow(e * 140., 2.)) * exp(-dx*dx*1.6) * 0.65;   // thin bright rim
    } else {
      // night: deep navy, a faint lift at the horizon, a small white moon with a halo
      col = mix(vec3(0.012, 0.018, 0.035), vec3(0.06, 0.08, 0.12), exp(-max(e, 0.) * 6.));
      vec2 m = lightPos(asp);
      float r = length(vec2(dx, e - m.y));
      col += vec3(0.96, 0.97, 1.0) * smoothstep(0.024, 0.021, r) * disc;                        // disc
      col += vec3(0.55, 0.6, 0.7) * exp(-r * 22.) * 0.35 + vec3(0.3, 0.34, 0.42) * exp(-r * 5.) * 0.18;
    }
    return col;
  }

  void main(){
    vec2 px = gl_FragCoord.xy;
    float asp = uRes.x / uRes.y;
    vec2 uv = px / uRes;
    float bank = uBank * (uLook < .5 ? 0.012 : 0.006) * sin(uT * 0.21);
    vec2 c = vec2((uv.x - 0.5) * asp, uv.y - 0.5);
    c = mat2(cos(bank), -sin(bank), sin(bank), cos(bank)) * c;
    float x = c.x, y = c.y + 0.5 - 0.46;
    vec2 L = lightPos(asp);
    float dx = x - L.x;

    vec3 col;
    if (y >= 0.) {
      col = sky(y, dx, asp, 1.);
      if (uLook > .5) col += vec3(0.8) * step(0.9965, h(floor(px / 1.5))) * smoothstep(0.02, 0.2, y) * (0.5 + 0.5 * sin(uT * 2. + h(floor(px)) * 40.));
    } else {
      float d = -y;
      float z = 1. / (d + 0.0025);
      vec2 p = vec2(x * z, z + uT * (uLook < .5 ? 2.2 : 1.1));
      // long swells running across the frame, plus a little chop
      float amp = uLook < .5 ? 1. : 0.6;
      float sz = 0.5 * 0.55 * sin(p.y * 0.55 + p.x * 0.08 - uT * 0.9)
               + 0.3 * 1.3 * sin(p.y * 1.3 - p.x * 0.3 - uT * 1.4)
               + 0.18 * 2.7 * sin(p.y * 2.7 + p.x * 0.9 - uT * 2.1);
      float sx = 0.3 * 0.3 * sin(p.y * 1.3 - p.x * 0.3 - uT * 1.4) - 0.18 * 0.9 * sin(p.y * 2.7 + p.x * 0.9 - uT * 2.1);
      float chop = n(vec2(p.x * 1.6, p.y * 4.2 - uT * 1.5)) - 0.5;
      float fade = smoothstep(0.0, 0.06, d);                       // calm the far field to avoid shimmer
      float e = d + amp * (sz * 0.022 + chop * 0.03) * (0.35 + 0.65 * fade);
      float rx = dx + amp * sx * 0.03;
      vec3 refl = sky(max(e, 0.), rx, asp, 0.);      // the moon itself shows only as glitter, below
      float fres = mix(0.95, 0.42, smoothstep(0.0, 0.5, d));      // grazing angles reflect more
      vec3 deep = uLook < .5 ? vec3(0.02, 0.03, 0.045) : vec3(0.006, 0.01, 0.02);
      col = mix(deep, refl, fres);
      // sparkle on the path of the light
      float path = exp(-dx*dx / (0.003 + d * d * (uLook < .5 ? 0.6 : 0.25)));
      float spark = smoothstep(uLook < .5 ? 0.78 : 0.7, 0.98, n(vec2(p.x * 3.5, p.y * 7. - uT * 2.)));
      col += (uLook < .5 ? vec3(0.95, 0.95, 0.93) : vec3(0.85, 0.88, 0.95)) * path * spark * (uLook < .5 ? 0.35 : 0.9) * exp(-d * 2.5);
    }

    col *= 1. - 0.32 * pow(length((uv - 0.5) * vec2(1., 1.2)), 2.);
    col += (h(px + fract(uT * 7.) * 91.) - 0.5) * 0.018;
    gl_FragColor = vec4(col, 1.);
  }`;
  const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s)); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog); gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(prog, 'uRes'), uT = gl.getUniformLocation(prog, 'uT'), uLook = gl.getUniformLocation(prog, 'uLook'), uBank = gl.getUniformLocation(prog, 'uBank');

  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round((canvas.clientWidth || innerWidth) * dpr); canvas.height = Math.round((canvas.clientHeight || innerHeight) * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  const t0 = performance.now();
  let raf = 0, onScreen = true;
  const frame = now => {
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uLook, look);
    gl.uniform1f(uBank, document.documentElement.dataset.bank === 'off' ? 0 : 1);
    gl.uniform1f(uT, reduced ? 20 : 20 + (now - t0) / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!reduced && !document.hidden && onScreen) raf = requestAnimationFrame(frame);
  };
  addEventListener('resize', () => { resize(); if (reduced) frame(performance.now()); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !reduced) { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); } });
  // The sea is one section of a longer page: stop drawing while it is off screen.
  if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => {
    onScreen = e.isIntersecting;
    if (onScreen && !reduced) { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
  }).observe(canvas);
  resize();
  raf = requestAnimationFrame(frame);
})();
