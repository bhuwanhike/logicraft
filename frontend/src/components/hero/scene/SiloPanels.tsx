import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SILOS, BRAND } from '../hero.constants';
import type { Silo } from '../hero.constants';
import { createSiloTextures } from '../textures/panels';
import { NOISE } from './shaders';

/**
 * Reads an object's material as a single material.
 *
 * three types `object.material` as `Material | Material[]`, but every object in
 * this scene is built with one material, so this narrows it once here instead of
 * casting at each animation site.
 */
function oneMaterial(object: THREE.Object3D): THREE.MeshStandardMaterial {
  const material = (object as THREE.Mesh).material;
  return material as THREE.MeshStandardMaterial;
}
import type { HeroState } from '../heroTimeline';

import type { SiloPanel } from '../textures/panels';

/** Props for SiloPanels. */
export interface SiloPanelsProps {
  state: HeroState;
  /** Publishes the baked panels so the GSAP timeline can blank them. */
  register: (panels: SiloPanel[]) => void;
}


const COOL_TINT = new THREE.Color(BRAND.cool);
const WARM_TINT = new THREE.Color(BRAND.blueBright);

/**
 * The four disconnected systems floating over the city.
 *
 * Each panel runs on its own pulse period so nothing ever looks synchronised,
 * then glitches, blanks and finally dissolves as the signal wavefront sweeps
 * through. This is the "before LogiCraft" state: four tools, no shared truth,
 * and a visible blind spot.
 */
export function SiloPanels({ state, register }: SiloPanelsProps) {
  const panels = useMemo(() => createSiloTextures(), []);

  useEffect(() => {
    register?.(panels);
  }, [register, panels]);

  const uniforms = useMemo(
    () =>
      // Textures are bound up front: a null sampler2D on the very first frame
      // renders undefined rather than the panel.
      SILOS.map((_, i) => ({
        uMap: { value: panels[i]?.texture ?? null },
        uTime: { value: 0 },
        uGlitch: { value: 0 },
        uDissolve: { value: 0 },
        uOpacity: { value: 1 },
        uPulse: { value: 0 },
        uTint: { value: COOL_TINT.clone() }
      })),
    [panels]
  );

  useFrame(() => {
    const time = performance.now() * 0.001;
    panels.forEach((_panel, i) => {
      const u = uniforms[i];
      const silo = SILOS[i];
      const s = state.silos[i];
      u.uTime.value = time;
      u.uGlitch.value = s.glitch;
      u.uDissolve.value = s.dissolve;
      u.uOpacity.value = s.opacity;
      // Out of sync on purpose: each system breathes on its own clock.
      u.uPulse.value = 0.5 + 0.5 * Math.sin((time / silo.pulsePeriod) * Math.PI * 2 + silo.phase);
      u.uTint.value.copy(COOL_TINT).lerp(WARM_TINT, state.tone);
    });
  });

  return (
    <group>
      {SILOS.map((silo, i) => (
        <Silo key={silo.id} index={i} silo={silo} uniforms={uniforms[i]} state={state} />
      ))}
    </group>
  );
}

interface SiloProps {
  index: number;
  silo: Silo;
  uniforms: { [key: string]: { value: unknown } };
  state: HeroState;
}

function Silo({ index, silo, uniforms, state }: SiloProps) {
  const group = useRef<THREE.Group>(null);
  const frame = useRef<THREE.LineSegments>(null);
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.PlaneGeometry(...silo.size)), [silo.size]);

  useFrame(() => {
    const s = state.silos[index];
    const g = group.current;
    if (!g) return;

    const time = performance.now() * 0.001;
    g.position.set(
      silo.position[0] + Math.sin(time * 0.4 + silo.phase) * 0.25,
      silo.position[1] + Math.sin(time * 0.55 + silo.phase) * 0.3,
      silo.position[2]
    );
    const pulse = 0.5 + 0.5 * Math.sin((time / silo.pulsePeriod) * Math.PI * 2 + silo.phase);
    g.rotation.y = silo.rotation + Math.sin(time * 0.3 + silo.phase) * 0.05;
    g.rotation.z = Math.sin(time * 0.45 + silo.phase) * 0.015;
    if (s.glitch > 0.01) g.position.x += (Math.random() - 0.5) * 0.32 * s.glitch;
    g.scale.setScalar((0.97 + pulse * 0.05) * (1 - s.dissolve * 0.2));

    if (frame.current) oneMaterial(frame.current).opacity = 0.32 + state.tone * 0.4;
  });

  return (
    <group ref={group} position={silo.position}>
      <mesh>
        <planeGeometry args={silo.size} />
        <shaderMaterial
          uniforms={uniforms}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          vertexShader={/* glsl */ `
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={/* glsl */ `
            precision highp float;
            varying vec2 vUv;
            uniform sampler2D uMap;
            uniform float uTime, uGlitch, uDissolve, uOpacity, uPulse;
            uniform vec3 uTint;
            ${NOISE}

            void main() {
              vec2 uv = vUv;

              // --- glitch: horizontal tearing + channel split ---
              float g = uGlitch;
              if (g > 0.001) {
                float band = floor(uv.y * 22.0);
                float kick = hash11(band + floor(uTime * 22.0)) - 0.5;
                uv.x += kick * 0.09 * g * step(0.55, hash11(band * 3.7 + floor(uTime * 18.0)));
              }
              float split = (hash11(floor(uTime * 26.0)) - 0.5) * 0.02 * g;

              vec4 tex;
              tex.r = texture2D(uMap, uv + split).r;
              tex.g = texture2D(uMap, uv).g;
              tex.b = texture2D(uMap, uv - split).b;
              tex.a = texture2D(uMap, uv).a;

              // --- dissolve: noisy burn with a lit front ---
              float front = 0.0;
              if (uDissolve > 0.001) {
                float n = valueNoise(vUv * 7.0) * 0.65 + valueNoise(vUv * 19.0) * 0.35;
                float d = n - (1.0 - (uDissolve * 1.35 - 0.18));
                if (d < 0.02) discard;
                front = smoothstep(0.0, 0.10, d) * (1.0 - smoothstep(0.01, 0.22, d));
              }

              // --- independent pulse + cool/warm grade ---
              float lum = dot(tex.rgb, vec3(0.299, 0.587, 0.114));
              vec3 col = mix(vec3(lum) * uTint * 1.15, tex.rgb, 0.72);
              col *= 0.82 + uPulse * 0.3;

              // Stale-data static wash
              col += vec3(0.05, 0.07, 0.11)
                * hash21(vUv * 640.0 + floor(uTime * 12.0))
                * (0.5 + uPulse * 0.4);

              col += uTint * front * 2.4;
              col = mix(col, vec3(lum) * 0.6 + vec3(0.06, 0.08, 0.12), g * 0.55);

              float alpha = tex.a * uOpacity * (0.72 + uPulse * 0.2);
              alpha = mix(alpha, alpha * 0.35, g * 0.6);
              gl_FragColor = vec4(col, alpha);
            }
          `}
        />
      </mesh>

      <lineSegments ref={frame} geometry={edges}>
        <lineBasicMaterial color={BRAND.cool} transparent opacity={0.35} depthWrite={false} />
      </lineSegments>

      {/* Stalk down to the city — sells the "floating UI" read. */}
      <mesh position={[0, -silo.size[1] / 2 - 3.4, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 6.8, 4]} />
        <meshBasicMaterial color={BRAND.cool} transparent opacity={0.12} depthWrite={false} />
      </mesh>
    </group>
  );
}
