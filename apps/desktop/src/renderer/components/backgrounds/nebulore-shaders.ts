export const vertexShaderGLSL = `
attribute vec2 position;
varying vec2 vUv;

void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

export const fragmentShaderGLSL = `
precision highp float;

varying vec2 vUv;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_speed;
uniform float u_grain;
uniform vec3 u_colorBack;
uniform vec3 u_colors[3];

vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  mat2 rot = mat2(0.87, 0.48, -0.48, 0.87);

  for (int i = 0; i < 5; i++) {
    value += amplitude * snoise(p);
    p = rot * p * 2.05;
    amplitude *= 0.5;
  }

  return value;
}

void main() {
  vec2 uv = vUv;
  float ratio = u_resolution.x / max(u_resolution.y, 1.0);
  vec2 p = (uv - 0.5) * vec2(ratio, 1.0);
  float t = u_time * u_speed;

  vec2 warp = vec2(
    fbm(p * 1.4 + vec2(t * 0.08, t * 0.04)),
    fbm(p * 1.4 + vec2(-t * 0.06, t * 0.05) + 4.2)
  );
  vec2 q = p + warp * 0.35;

  float ribbonA = abs(snoise(vec2(q.x * 1.8 + t * 0.12, q.y * 2.4 - t * 0.08)));
  float ribbonB = abs(snoise(vec2(q.x * 2.6 - t * 0.1, q.y * 1.6 + t * 0.06 + ribbonA)));
  float nebula = pow(1.0 - smoothstep(0.0, 0.55, ribbonA + ribbonB * 0.6), 2.2);

  float drift = fbm(p * 0.9 + vec2(t * 0.05, -t * 0.03));
  nebula *= smoothstep(-0.4, 0.8, drift + 0.2);
  nebula *= smoothstep(0.05, 0.55, uv.y) * smoothstep(1.0, 0.35, uv.y);

  vec3 col = u_colorBack;
  col = mix(col, u_colors[0], smoothstep(-0.2, 0.9, drift) * 0.35);
  col = mix(col, u_colors[1], nebula * 0.85);
  col += u_colors[2] * pow(nebula, 3.5) * 0.75;

  float vignette = smoothstep(1.15, 0.25, length(uv - 0.5));
  col *= vignette;

  float grain = fract(sin(dot(uv * u_resolution, vec2(12.9898, 78.233)) + u_time * 60.0) * 43758.5453);
  col += (grain - 0.5) * u_grain * 0.04;

  gl_FragColor = vec4(col, 1.0);
}
`;
