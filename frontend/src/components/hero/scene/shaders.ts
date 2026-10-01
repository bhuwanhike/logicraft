/** Small shared GLSL fragments. Kept tiny — the hero runs on weak GPUs too. */

export const NOISE = /* glsl */ `
  float hash11(float p) {
    p = fract(p * 0.1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
  }
  float hash21(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash21(i), hash21(i + vec2(1.0, 0.0)), u.x),
      mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), u.x),
      u.y
    );
  }
`;

/**
 * Fade a surface out along an arbitrary axis using a noisy front, and light up
 * the front itself so the edge reads as energy rather than a hard cut.
 * Returns .x = discard amount, .y = front intensity.
 */
export const DISSOLVE = /* glsl */ `
  float dissolveMask(vec2 uv, float amount, float scale, out float front) {
    float n = valueNoise(uv * scale);
    front = 0.0;
    if (amount <= 0.001) return 0.0;
    float edge = amount * 1.25 - 0.12;
    float d = n - (1.0 - edge);
    front = smoothstep(0.0, 0.16, d) * (1.0 - smoothstep(0.02, 0.3, d));
    return step(0.0, d) * step(d, 0.02);
  }
`;
