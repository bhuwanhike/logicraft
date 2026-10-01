import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BRAND } from '../hero.constants';
import { createRoadTexture, createWindowsTexture } from '../textures/world';

import type { HeroState } from '../heroTimeline';

import type { HeroQuality } from '../HeroScene3D';

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

/** Props for World: the city backdrop, ring road and signal bulbs. */
export interface WorldProps {
  state: HeroState;
  quality: HeroQuality;
}

const CITY_COOL = new THREE.Color('#0d1526');
const CITY_WARM = new THREE.Color('#16233f');

/**
 * The world the truck drives through: highway, verge, light poles and a
 * stylised skyline. It exists to give the silos something to float above and to
 * make the "one blind spot" line land — without a road there is no route, and
 * without a route there is no incident.
 */
export function World({ state, quality }: WorldProps) {
  const roadTex = useMemo(() => createRoadTexture(), []);
  const winTex = useMemo(() => createWindowsTexture(), []);
  const cityRef = useRef<THREE.InstancedMesh>(null);
  const count = quality === 'high' ? 58 : 28;

  const buildings = useMemo(() => {
    const out = [];
    let seed = 20240607;
    const rand = (): number => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };
    for (let i = 0; i < count; i++) {
      const x = -78 + (i / count) * 156 + (rand() - 0.5) * 9;
      const z = -34 - rand() * 48;
      const tall = rand() > 0.76;
      out.push({
        x,
        z,
        height: 6 + rand() * (tall ? 56 : 26),
        width: 3 + rand() * 6,
        depth: 3 + rand() * 6,
        lit: 0.35 + rand() * 0.9
      });
    }
    return out;
  }, [count]);

  useEffect(() => {
    const mesh = cityRef.current;
    if (!mesh) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    buildings.forEach((b, i) => {
      dummy.position.set(b.x, b.height / 2, b.z);
      dummy.scale.set(b.width, b.height, b.depth);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      color.setRGB(0.06 * b.lit + 0.03, 0.09 * b.lit + 0.04, 0.15 * b.lit + 0.07);
      mesh.setColorAt(i, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [buildings]);

  useFrame(() => {
    const mesh = cityRef.current;
    if (!mesh) return;
    const mat = oneMaterial(mesh);
    mat.emissiveIntensity = (0.8 - state.dim * 0.6) * (1 + state.tone * 0.3);
    mat.color.copy(CITY_COOL).lerp(CITY_WARM, state.tone);
  });

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, -20]}>
        <planeGeometry args={[300, 200]} />
        <meshStandardMaterial color="#080c15" roughness={1} metalness={0} />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[180, 15]} />
        <meshStandardMaterial map={roadTex} roughness={0.72} metalness={0.14} color="#c6d1e2" />
      </mesh>

      {[-7.9, 7.9].map((z) => (
        <mesh key={z} position={[0, 0.13, z]}>
          <boxGeometry args={[180, 0.26, 0.7]} />
          <meshStandardMaterial color="#1b2434" roughness={0.9} />
        </mesh>
      ))}

      <LightPoles state={state} />
      <Pothole state={state} />

      <instancedMesh ref={cityRef} args={[undefined, undefined, count]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          map={winTex}
          emissiveMap={winTex}
          emissive="#ffffff"
          emissiveIntensity={0.8}
          color="#101a2e"
          roughness={0.65}
          metalness={0.1}
        />
      </instancedMesh>
    </group>
  );
}

/**
 * The thing that causes the blind spot. It sits in the truck's lane, just past
 * where the truck stops, so the audience connects the jolt to a cause rather
 * than to the animation itself.
 */
function Pothole({ state }: { state: HeroState }) {
  const X = 3.35;
  const ring = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!ring.current) return;
    // `shake` is the one thing the timeline actually spikes at the moment of
    // impact, so it is what the ring expands on.
    const hit = Math.max(0, state.shake);
    oneMaterial(ring.current).opacity = hit * 0.35;
    ring.current.scale.setScalar(1 + (1 - hit) * 1.4);
  });

  return (
    <group position={[X, 0.01, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.62, 20]} />
        <meshStandardMaterial color="#05070c" roughness={1} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0]}>
        <ringGeometry args={[0.6, 0.72, 20]} />
        <meshStandardMaterial color="#2a3444" roughness={0.9} side={THREE.DoubleSide} />
      </mesh>
      {/* Impact ring — a single pulse at the moment of contact */}
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.7, 0.86, 24]} />
        <meshBasicMaterial color="#cfe4ff" transparent opacity={0} depthWrite={false} />
      </mesh>
      {/* Debris */}
      {[
        [-0.9, 0.55, 0.16],
        [1.05, -0.4, 0.12],
        [0.55, 0.95, 0.1]
      ].map(([x, z, s], i) => (
        <mesh key={i} position={[x, 0.05, z]} rotation={[0.3 * i, i, 0.2]}>
          <boxGeometry args={[s, s * 0.6, s]} />
          <meshStandardMaterial color="#2b3546" roughness={0.9} />
        </mesh>
      ))}
      {/* Bent guardrail marker */}
      <mesh position={[1.6, 0.5, -1.3]} rotation={[0, 0, 0.42]}>
        <boxGeometry args={[0.12, 1.1, 0.12]} />
        <meshStandardMaterial color={BRAND.amber} roughness={0.6} metalness={0.2} />
      </mesh>
    </group>
  );
}

function LightPoles({ state }: { state: HeroState }) {
  const poles = useMemo(() => {
    const out = [];
    for (let x = -44; x <= 44; x += 11) out.push(x);
    return out;
  }, []);
  const bulbs = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!bulbs.current) return;
    const warm = 0.3 + state.tone * 0.5;
    const time = performance.now() * 0.001;
    bulbs.current.children.forEach((child, i) => {
      oneMaterial(child as THREE.Mesh).opacity =
        0.4 + warm * 0.35 + Math.sin(time * 0.7 + i * 1.7) * 0.04;
    });
  });

  return (
    <group>
      {poles.map((x) =>
        [-9.2, 9.2].map((z) => (
          <group key={`${x}-${z}`} position={[x, 0, z]}>
            <mesh position={[0, 2.4, 0]}>
              <cylinderGeometry args={[0.09, 0.14, 4.8, 6]} />
              <meshStandardMaterial color="#141c2b" roughness={0.85} />
            </mesh>
            <mesh position={[z > 0 ? -0.62 : 0.62, 4.76, 0]} rotation={[0, 0, z > 0 ? 0.52 : -0.52]}>
              <boxGeometry args={[1.45, 0.13, 0.17]} />
              <meshStandardMaterial color="#141c2b" roughness={0.85} />
            </mesh>
          </group>
        ))
      )}
      <group ref={bulbs}>
        {poles.flatMap((x) =>
          [-9.2, 9.2].map((z) => (
            <mesh key={`${x}-${z}`} position={[x + (z > 0 ? -1.15 : 1.15), 4.6, z]}>
              <sphereGeometry args={[0.18, 8, 8]} />
              <meshBasicMaterial color="#cfe2ff" transparent opacity={0.6} depthWrite={false} />
            </mesh>
          ))
        )}
      </group>
    </group>
  );
}
