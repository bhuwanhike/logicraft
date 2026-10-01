import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BRAND, DOMAINS } from '../hero.constants';
import { NOISE } from './shaders';

import type { HeroState } from '../heroTimeline';

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

/** Props for Signal: the wavefront, rings and converging trail. */
export interface SignalProps {
  state: HeroState;
}

const ORIGIN = new THREE.Vector3(2.2, 3.0, 0);
const LENS = new THREE.Vector3(7.4, 1.65, 3.1);

/**
 * Act three: detection, then convergence.
 *
 * A single blue wavefront pulses out of the truck's roof sensor, sweeps the
 * dead silo panels away as it passes, and is drawn into one light trail that
 * streams rightward into the dispatcher's screen. Four systems, one signal.
 */
export function Signal({ state }: SignalProps) {
  const waveRef = useRef<THREE.Mesh>(null);
  const rings = useRef<(THREE.Mesh | null)[]>([]);
  const trailRef = useRef<THREE.Mesh>(null);
  const beads = useRef<(THREE.Mesh | null)[]>([]);

  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3(
        [
          new THREE.Vector3(-6.5, 5.6, -11),
          new THREE.Vector3(-1.5, 7.6, -7.5),
          new THREE.Vector3(3.4, 6.4, -2.5),
          new THREE.Vector3(6.6, 3.2, 1.2),
          LENS.clone()
        ],
        false,
        'catmullrom',
        0.4
      ),
    []
  );

  const tube = useMemo(() => new THREE.TubeGeometry(curve, 180, 0.16, 10, false), [curve]);

  const waveUniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(BRAND.blueBright) },
      uOpacity: { value: 0 },
      uTime: { value: 0 }
    }),
    []
  );

  const trailUniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(BRAND.blueBright) },
      uHot: { value: new THREE.Color('#eaf2ff') },
      uProgress: { value: 0 },
      uOpacity: { value: 0 },
      uTime: { value: 0 }
    }),
    []
  );

  const beadTemp = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const s = state;
    const time = performance.now() * 0.001;

    /* --- the wavefront ------------------------------------------------ */
    if (waveRef.current) {
      const p = s.signal;
      waveRef.current.position.set(ORIGIN.x + (s.truck.x - 0.6) * 0.35, ORIGIN.y, ORIGIN.z);
      // A ping that appears, peaks and dies — not a growing permanent bubble.
      const envelope = Math.sin(Math.min(1, p) * Math.PI);
      const opacity = envelope * s.signalOpacity * 0.85;
      waveRef.current.visible = opacity > 0.004;
      waveRef.current.scale.setScalar(0.6 + p * 40);
      // ShaderMaterial ignores the built-in `opacity`, so the shader uniform is
      // the only thing that actually drives alpha here.
      waveUniforms.uOpacity.value = opacity;
      waveUniforms.uTime.value = time;
    }

    // Three ground rings, staggered, to sell the heartbeat rhythm.
    rings.current.forEach((ring, i) => {
      if (!ring) return;
      const offset = i * 0.16;
      const p = (s.signal - offset) / 0.72;
      if (p <= 0 || p >= 1) {
        ring.visible = false;
        return;
      }
      ring.visible = true;
      const radius = 1 + p * 34;
      ring.scale.setScalar(radius);
      oneMaterial(ring).opacity = Math.sin(p * Math.PI) * s.signalOpacity * 0.4;
    });

    /* --- the converging trail ---------------------------------------- */
    if (trailRef.current) {
      trailRef.current.visible = s.trailOpacity > 0.01;
      trailUniforms.uProgress.value = s.trail;
      trailUniforms.uOpacity.value = s.trailOpacity;
      trailUniforms.uTime.value = time;
    }

    // One bead per domain, riding the trail as it streams to the laptop.
    DOMAINS.forEach((_, i) => {
      const bead = beads.current[i];
      if (!bead) return;
      const head = s.trail * 1.18 - i * 0.06;
      if (head <= 0.001 || head > 1 || s.trailOpacity < 0.02) {
        bead.visible = false;
        return;
      }
      bead.visible = true;
      curve.getPointAt(Math.min(0.999, head), beadTemp);
      bead.position.copy(beadTemp);
      const fade = Math.min(1, (1 - head) * 3.2) * Math.min(1, head * 6);
      bead.scale.setScalar(0.5 + fade * 0.9);
      oneMaterial(bead).opacity = fade * s.trailOpacity;
    });
  });

  return (
    <group>
      {/* Expanding shell */}
      <mesh ref={waveRef}>
        <sphereGeometry args={[1, 32, 24]} />
        <shaderMaterial
          uniforms={waveUniforms}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          vertexShader={/* glsl */ `
            varying vec3 vNormalW;
            varying vec3 vViewW;
            varying vec3 vPos;
            void main() {
              vPos = position;
              vec4 world = modelMatrix * vec4(position, 1.0);
              vNormalW = normalize(mat3(modelMatrix) * normal);
              vViewW = normalize(cameraPosition - world.xyz);
              gl_Position = projectionMatrix * viewMatrix * world;
            }
          `}
          fragmentShader={/* glsl */ `
            precision highp float;
            varying vec3 vNormalW;
            varying vec3 vViewW;
            varying vec3 vPos;
            uniform vec3 uColor;
            uniform float uOpacity;
            uniform float uTime;
            ${NOISE}

            void main() {
              float f = 1.0 - abs(dot(normalize(vNormalW), normalize(vViewW)));
              f = pow(clamp(f, 0.0, 1.0), 3.5);

              // Banding along the shell makes it read as a propagating wave,
              // not a soap bubble.
              float band = 0.5 + 0.5 * sin(vPos.y * 6.0 - uTime * 3.0);
              float ring = smoothstep(0.45, 1.0, band) * 0.5 + 0.5;

              float a = f * ring * uOpacity;
              if (a < 0.002) discard;
              gl_FragColor = vec4(uColor * (1.0 + f * 1.4), a);
            }
          `}
        />
      </mesh>

      {/* Ground rings */}
      {[0, 1, 2].map((i) => (
        <mesh
          key={i}
          ref={(el: THREE.Mesh | null) => { rings.current[i] = el; }}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[ORIGIN.x, 0.06, ORIGIN.z]}
          visible={false}
        >
          <ringGeometry args={[0.96, 1, 64]} />
          <meshBasicMaterial
            color={BRAND.blueBright}
            transparent
            opacity={0}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}

      {/* The converging light trail */}
      <mesh ref={trailRef} geometry={tube} visible={false}>
        <shaderMaterial
          uniforms={trailUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
          vertexShader={/* glsl */ `
            varying vec2 vUv;
            varying vec3 vNormalW;
            varying vec3 vViewW;
            void main() {
              vUv = uv;
              vec4 world = modelMatrix * vec4(position, 1.0);
              vNormalW = normalize(mat3(modelMatrix) * normal);
              vViewW = normalize(cameraPosition - world.xyz);
              gl_Position = projectionMatrix * viewMatrix * world;
            }
          `}
          fragmentShader={/* glsl */ `
            precision highp float;
            varying vec2 vUv;
            varying vec3 vNormalW;
            varying vec3 vViewW;
            uniform vec3 uColor;
            uniform vec3 uHot;
            uniform float uProgress;
            uniform float uOpacity;
            uniform float uTime;

            void main() {
              if (vUv.x > uProgress) discard;

              // Soft glowing rope: bright at the silhouette, hollow in the middle.
              float body = pow(sin(vUv.y * 3.14159), 0.6);
              float fres = pow(1.0 - abs(dot(normalize(vNormalW), normalize(vViewW))), 1.6);

              // Energy flowing toward the screen.
              float flow = 0.5 + 0.5 * sin(vUv.x * 46.0 - uTime * 7.0);

              // Leading edge of the reveal.
              float head = exp(-pow((vUv.x - uProgress) * 22.0, 2.0));

              vec3 col = mix(uColor, uHot, head * 0.85 + fres * 0.25);
              float a = uOpacity * body * (0.35 + flow * 0.35 + fres * 0.5 + head * 0.9);
              if (a < 0.002) discard;
              gl_FragColor = vec4(col * (1.0 + head * 1.6), a);
            }
          `}
        />
      </mesh>

      {/* Domain beads: fleet, shipment, warehouse, transport */}
      {DOMAINS.map((domain, i) => (
        <mesh key={domain.label} ref={(el: THREE.Mesh | null) => { beads.current[i] = el; }} visible={false}>
          <sphereGeometry args={[0.34, 12, 12]} />
          <meshBasicMaterial color={domain.color} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      ))}
    </group>
  );
}
