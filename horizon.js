// Single screen: open water before dawn. A low light travels slowly along the
// horizon, throwing a long horizontal streak and a broken path across the sea.
// Everything is one fragment shader; grain is added to hide banding.
(() => {
  const canvas = document.getElementById('sky');
  const gl = canvas.getContext('webgl', { antialias: false, premultipliedAlpha: false });
  if (!gl) return;                                   // CSS gradient fallback stays visible
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const VS = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0., 1.); }';
  const FS = `precision highp float;
  uniform vec2 uRes; uniform float uT;
  float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
    return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
  void main(){
    vec2 px = gl_FragCoord.xy;
    vec2 uv = px / uRes;
    float asp = uRes.x / uRes.y;
    float hz = 0.47;                                     // horizon, from the bottom
    float y = uv.y - hz;
    float x = (uv.x - 0.5) * asp;

    // the light: drifts slowly across, never quite leaving the frame
    float lx = (sin(uT * 0.045 - 1.2) * 0.62) * asp * 0.5;
    float dx = x - lx;
    float pulse = 0.85 + 0.15 * sin(uT * 0.31) * sin(uT * 0.17 + 1.);

    // sky: near-black at the top, cooler and lifted toward the horizon
    vec3 col = mix(vec3(0.02, 0.027, 0.047), vec3(0.075, 0.095, 0.14), smoothstep(0.55, 0.0, y));
    // warm dome of light above the source
    float dome = exp(-dx*dx*1.6) * exp(-max(y, 0.) * 5.5);
    col += vec3(0.55, 0.36, 0.22) * dome * 0.55 * pulse;

    // the streak: a thin, very wide horizontal flare at the horizon
    float core = exp(-pow(y * uRes.y / 2.2, 2.)) * exp(-dx*dx*3.5);
    float wide = exp(-pow(y * 34., 2.)) * exp(-abs(dx) * 1.1);
    float flare = exp(-pow(y * 9., 2.)) * exp(-dx*dx*9.);
    col += vec3(1.0, 0.86, 0.66) * core * 1.4 * pulse;
    col += vec3(1.0, 0.72, 0.48) * wide * 0.55 * pulse;
    col += vec3(1.0, 0.78, 0.55) * flare * 0.35 * pulse;

    // sea: darker below the horizon, with a broken path of light under the source
    if (y < 0.) {
      float d = -y;
      col = mix(col, vec3(0.012, 0.018, 0.032), smoothstep(0.0, 0.25, d) * 0.85);
      vec2 wp = vec2(x / (d + 0.004), 1. / (d + 0.004));   // perspective: world position on the water
      float waves = n(vec2(wp.x * 2.2 + uT * 0.04, wp.y * 7. + uT * 0.6)) * 0.65 + n(vec2(wp.x * 5.5, wp.y * 17. - uT * 0.9)) * 0.35;
      float ripple = smoothstep(0.58, 0.82, waves);
      float path = exp(-dx*dx / (0.003 + d * d * 0.35)) * exp(-d * 5.5);
      col += vec3(1.0, 0.78, 0.55) * path * ripple * 0.9 * pulse;
      col += vec3(0.14, 0.17, 0.22) * ripple * exp(-d * 9.) * 0.25;     // faint swell everywhere near the horizon
    }

    // vignette and grain
    col *= 1. - 0.35 * pow(length((uv - 0.5) * vec2(1., 1.2)), 2.);
    col += (h(px + fract(uT) * 91.) - 0.5) * 0.018;
    gl_FragColor = vec4(col, 1.);
  }`;
  const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const prog = gl.createProgram();
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(prog); gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const uRes = gl.getUniformLocation(prog, 'uRes'), uT = gl.getUniformLocation(prog, 'uT');

  const resize = () => {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    canvas.width = Math.round(innerWidth * dpr); canvas.height = Math.round(innerHeight * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  const t0 = performance.now();
  let raf = 0;
  const frame = now => {
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uT, reduced ? 14 : 14 + (now - t0) / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!reduced && !document.hidden) raf = requestAnimationFrame(frame);
  };
  addEventListener('resize', () => { resize(); if (reduced) frame(performance.now()); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && !reduced) { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); } });
  resize();
  raf = requestAnimationFrame(frame);
})();
