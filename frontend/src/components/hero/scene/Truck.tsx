import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BRAND } from '../hero.constants';
import { createLiveryTexture } from '../textures/panels';

/** A position/euler triple, as R3F accepts it. */
type Vec3 = [number, number, number];

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

/** Props for Truck. */
export interface TruckProps {
  state: HeroState;
}

const WHEEL_R = 0.46;

/**
 * The LogiCraft delivery truck. Everything about it is procedural — no GLTF, no
 * texture atlas, nothing to download — which is what keeps the 3D bundle small
 * enough to lazy-load behind the poster frame.
 *
 * The group transform carries the whole performance: `x` drives the drive-in,
 * `pitch/roll/yaw` the pothole, `rattle` the cargo shifting inside the box, and
 * `hazard` the amber blinkers.
 */
export function Truck({ state }: TruckProps) {
  const root = useRef<THREE.Group>(null);
  const chassis = useRef<THREE.Group>(null);
  const box = useRef<THREE.Group>(null);
  const wheels = useRef<(THREE.Group | null)[]>([]);
  const hazards = useRef<(THREE.Mesh | null)[]>([]);
  const headlights = useRef<THREE.MeshBasicMaterial>(null);
  const cone = useRef<THREE.Mesh>(null);
  const livery = useMemo(() => createLiveryTexture(), []);

  const wheelPositions = useMemo<Vec3[]>(
    () => [
      [1.55, WHEEL_R, 1.02],
      [1.55, WHEEL_R, -1.02],
      [-1.5, WHEEL_R, 1.02],
      [-1.5, WHEEL_R, -1.02]
    ],
    []
  );

  useFrame(() => {
    const t = state.truck;
    const g = root.current;
    if (!g) return;

    const time = performance.now() * 0.001;
    // Idle suspension keeps breathing once the story is over.
    const idle = state.finished ? 1 : 0.35;
    const bounce = Math.sin(time * 2.1) * 0.035 * t.bounce * idle + Math.sin(time * 5.3) * 0.012 * idle;

    g.position.set(t.x, t.y + bounce, 0);
    g.rotation.order = 'YXZ';
    g.rotation.set(t.roll, t.yaw, t.pitch);

    // Cargo rattles in the box after the impact, and never fully settles.
    if (chassis.current) {
      chassis.current.rotation.z = t.roll * 0.6;
      chassis.current.rotation.x = t.pitch * 0.5;
    }
    if (box.current && t.rattle > 0.01) {
      const r = t.rattle * 0.045;
      box.current.position.x = -0.55 + Math.sin(time * 41) * r;
      box.current.position.y = 1.98 + Math.sin(time * 33) * r;
      box.current.rotation.z = Math.sin(time * 27) * r * 0.6;
    }

    wheels.current.forEach((wheel) => {
      if (wheel) wheel.rotation.z = -t.wheelSpin;
    });

    // Amber blinkers: ~2.4Hz, on/off, both ends in sync.
    const blink = t.hazard > 0.01 ? (Math.sin(time * 15) > 0 ? 1 : 0.06) : 0;
    const amber = t.hazard * blink;
    hazards.current.forEach((h, i) => {
      if (!h) return;
      const mat = oneMaterial(h);
      mat.emissiveIntensity = 0.15 + amber * 3.2;
      mat.opacity = 0.25 + amber * 0.75;
      h.scale.setScalar(1 + amber * 0.12);
      void i;
    });

    // The ref is attached to <meshBasicMaterial>, not its parent mesh.
    // Treat it as a material directly so a frame cannot throw while R3F mounts
    // or replaces the material during a hot reload.
    const lamp = headlights.current;
    if (lamp && lamp.isMaterial) {
      lamp.opacity = 0.75 + Math.sin(time * 9) * 0.05;
    }
    if (cone.current) {
      oneMaterial(cone.current).opacity = 0.055 + t.brake * 0.02;
    }
  });

  return (
    <group ref={root}>
      <group ref={chassis}>
        {/* Chassis rails */}
        <mesh position={[0, 0.62, 0]}>
          <boxGeometry args={[4.6, 0.26, 1.9]} />
          <meshStandardMaterial color="#151c28" roughness={0.75} metalness={0.35} />
        </mesh>

        {/* Cargo box */}
        <group ref={box} position={[-0.55, 1.98, 0]}>
          <mesh castShadow={false}>
            <boxGeometry args={[3.5, 2.15, 2.16]} />
            <meshStandardMaterial map={livery} roughness={0.5} metalness={0.08} color="#ffffff" />
          </mesh>
          {/* Roof rib */}
          <mesh position={[0, 1.12, 0]}>
            <boxGeometry args={[3.4, 0.08, 2.0]} />
            <meshStandardMaterial color="#dfe7f1" roughness={0.6} />
          </mesh>
          {/* Rear roller door */}
          <mesh position={[-1.78, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[1.7, 1.8]} />
            <meshStandardMaterial color="#c9d4e2" roughness={0.55} metalness={0.15} />
          </mesh>
        </group>

        {/* Cab */}
        <group position={[1.62, 0, 0]}>
          <mesh position={[0, 1.5, 0]}>
            <boxGeometry args={[1.55, 1.7, 2.1]} />
            <meshStandardMaterial color={BRAND.blueDeep} roughness={0.34} metalness={0.42} />
          </mesh>
          <mesh position={[0, 2.5, 0]}>
            <boxGeometry args={[1.35, 0.34, 1.95]} />
            <meshStandardMaterial color="#1c4fb8" roughness={0.3} metalness={0.4} />
          </mesh>
          {/* Windshield */}
          <mesh position={[0.79, 1.86, 0]} rotation={[0, 0, -0.12]}>
            <planeGeometry args={[1.5, 0.86]} />
            <meshStandardMaterial
              color="#0c1626"
              roughness={0.08}
              metalness={0.9}
              emissive="#1a3557"
              emissiveIntensity={0.35}
            />
          </mesh>
          {/* Side glass */}
          {[-1.06, 1.06].map((z) => (
            <mesh key={z} position={[-0.05, 1.9, z]} rotation={[0, z > 0 ? 0 : Math.PI, 0]}>
              <planeGeometry args={[1.15, 0.7]} />
              <meshStandardMaterial color="#0c1626" roughness={0.1} metalness={0.85} />
            </mesh>
          ))}
          {/* Bumper + grille */}
          <mesh position={[0.8, 0.78, 0]}>
            <boxGeometry args={[0.18, 0.3, 2.0]} />
            <meshStandardMaterial color="#1a2230" roughness={0.6} metalness={0.5} />
          </mesh>

          {/* Headlights */}
          {[-0.72, 0.72].map((z) => (
            <group key={z}>
              <mesh position={[0.86, 1.06, z]} rotation={[0, Math.PI / 2, 0]}>
                <circleGeometry args={[0.19, 16]} />
                <meshBasicMaterial ref={z < 0 ? headlights : null} color="#eaf3ff" transparent opacity={0.85} />
              </mesh>
              <mesh position={[0.87, 1.06, z]}>
                <sphereGeometry args={[0.2, 10, 10]} />
                <meshBasicMaterial color="#cfe4ff" transparent opacity={0.22} depthWrite={false} />
              </mesh>
            </group>
          ))}

          {/* Hazard lamps: two front, two rear */}
          {([
            [0.87, 1.42, -0.86],
            [0.87, 1.42, 0.86],
            [-1.72, 1.2, -0.9],
            [-1.72, 1.2, 0.9]
          ] as Vec3[]).map((p, i) => (
            <mesh key={i} position={p} ref={(el: THREE.Mesh | null) => { hazards.current[i] = el; }}>
              <sphereGeometry args={[0.1, 8, 8]} />
              <meshStandardMaterial
                color="#5a3a10"
                emissive={BRAND.amber}
                emissiveIntensity={0.2}
                transparent
                opacity={0.3}
              />
            </mesh>
          ))}
        </group>

        {/* Headlight throw — apex at the truck, cone opening down the road */}
        <mesh ref={cone} position={[7.2, 0.95, 0]} rotation={[0, 0, Math.PI / 2]}>
          <coneGeometry args={[2.3, 12, 18, 1, true]} />
          <meshBasicMaterial
            color="#cfe4ff"
            transparent
            opacity={0.06}
            depthWrite={false}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>

      {/* Wheels. The truck runs along +X, so the rolling axis is Z. */}
      {wheelPositions.map((p, i) => (
        <group key={i} position={p}>
          <group ref={(el: THREE.Group | null) => { wheels.current[i] = el; }}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[WHEEL_R, WHEEL_R, 0.36, 20]} />
              <meshStandardMaterial color="#0e131c" roughness={0.85} metalness={0.1} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, p[2] > 0 ? 0.19 : -0.19]}>
              <cylinderGeometry args={[WHEEL_R * 0.56, WHEEL_R * 0.56, 0.05, 16]} />
              <meshStandardMaterial color="#8d9cb0" roughness={0.35} metalness={0.85} />
            </mesh>
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, p[2] > 0 ? -0.19 : 0.19]}>
              <cylinderGeometry args={[WHEEL_R * 0.56, WHEEL_R * 0.56, 0.05, 16]} />
              <meshStandardMaterial color="#8d9cb0" roughness={0.35} metalness={0.85} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}
