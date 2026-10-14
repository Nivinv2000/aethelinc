// Single screen: flying low and fast over open water before dawn. The sea streams
// toward the viewer, the horizon banks gently, and a low light breathes on the horizon.
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
    float asp = uRes.x / uRes.y;
    vec2 uv = px / uRes;
    // camera: flying low and fast over open water. A slow bank and a little altitude bob.
    float bank = 0.045 * sin(uT * 0.23) + 0.02 * sin(uT * 0.61 + 1.3);
    float bob = 0.012 * sin(uT * 0.37);
    vec2 c = vec2((uv.x - 0.5) * asp, uv.y - 0.5);
    c = mat2(cos(bank), -sin(bank), sin(bank), cos(bank)) * c;
    float x = c.x;
    float y = c.y + 0.5 - (0.47 + bob);                   // height above the horizon

    // the light on the horizon: wanders a little and breathes on a ten-second cycle
    float lx = 0.22 * asp * 0.5 * sin(uT * 0.11 - 0.6);
    float dx = x - lx;
    float br = 0.5 + 0.5 * sin(uT * 0.62 - 1.57);          // 0..1
    float pulse = 0.55 + 0.75 * br * br;

    // sky
    vec3 col = mix(vec3(0.02, 0.027, 0.047), vec3(0.075, 0.095, 0.14), smoothstep(0.55, 0.0, y));
    float dome = exp(-dx*dx*(2.2 - br)) * exp(-max(y, 0.) * (6.5 - 2.5 * br));
    col += vec3(0.55, 0.36, 0.22) * dome * 0.6 * pulse;
    // horizon streak
    float core = exp(-pow(y * uRes.y / 2.2, 2.)) * exp(-dx*dx*3.);
    float wide = exp(-pow(y * 34., 2.)) * exp(-abs(dx) * 1.1);
    float flare = exp(-pow(y * 9., 2.)) * exp(-dx*dx*9.);
    col += vec3(1.0, 0.86, 0.66) * core * 1.5 * pulse;
    col += vec3(1.0, 0.72, 0.48) * wide * 0.6 * pulse;
    col += vec3(1.0, 0.78, 0.55) * flare * 0.4 * pulse;

    // sea, streaming toward the viewer
    if (y < 0.) {
      float d = -y;
      col = mix(col, vec3(0.012, 0.018, 0.032), smoothstep(0.0, 0.22, d) * 0.88);
      float z = 1. / (d + 0.003);                           // distance along the water
      vec2 wp = vec2(x * z, z + uT * 9.);                   // forward motion
      float waves = n(vec2(wp.x * 2.0, wp.y * 0.55)) * 0.6 + n(vec2(wp.x * 5.2 + 3., wp.y * 1.6 - uT * 0.7)) * 0.4;
      float ripple = smoothstep(0.56, 0.8, waves);
      float fine = smoothstep(0.7, 0.95, n(vec2(wp.x * 11., wp.y * 3.4 + uT * 1.3)));
      float path = exp(-dx*dx / (0.004 + d * d * 0.5)) * exp(-d * 4.5);
      col += vec3(1.0, 0.78, 0.55) * path * (ripple * 0.85 + fine * 0.5) * pulse;
      col += vec3(0.16, 0.19, 0.25) * (ripple * 0.6 + fine * 0.4) * exp(-d * 5.) * 0.3;   // starlight on the swell
    }

    // vignette and grain
    col *= 1. - 0.38 * pow(length((uv - 0.5) * vec2(1., 1.2)), 2.);
    col += (h(px + fract(uT * 7.) * 91.) - 0.5) * 0.02;
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
