import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BRAND } from '../hero.constants';
import { DashboardScreen } from '../textures/dashboard';

/** A position/euler triple, as R3F accepts it. */
type Vec3 = [number, number, number];

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

/** Props for DispatchDesk: the laptop that lights up when the signal lands. */
export interface DispatchDeskProps {
  state: HeroState;
  quality: HeroQuality;
}

const DESK: { position: Vec3; yaw: number } = { position: [7.4, 0, 3.2], yaw: -0.42 };

/**
 * The dispatcher's desk and the single pane of glass.
 *
 * The laptop screen is a live canvas texture, not a video or a stack of flat
 * quads — that is what lets the alert toast, the KPI grid, the status badge and
 * the route recalculation all animate *inside* the 3D shot.
 */
export function DispatchDesk({ state, quality }: DispatchDeskProps) {
  const screen = useMemo(() => new DashboardScreen(), []);
  const lid = useRef<THREE.Group>(null);
  const halo = useRef<THREE.Mesh>(null);
  const screenLight = useRef<THREE.PointLight>(null);
  const haloLight = useRef<THREE.PointLight>(null);
  const clock = useRef(0);

  useFrame(({ camera }, dt: number) => {
    const s = state;

    // Drive the dashboard texture. `render` throttles itself to ~12fps once the
    // scene goes idle, so the live ticking costs almost nothing.
    screen.state.wake = s.screen.wake;
    screen.state.flash = s.screen.flash;
    screen.state.toast = s.screen.toast;
    screen.state.actions = s.screen.actions;
    screen.state.badge = s.screen.badge;
    screen.state.reroute = s.screen.reroute;
    screen.state.live = s.screen.live;
    screen.state.noise = s.screen.noise;
    clock.current += dt * 1000;
    screen.render(clock.current);

    if (lid.current) {
      // The screen tilts up to attention as it wakes.
      lid.current.rotation.x = -0.3 - s.laptop.screenOn * 0.14;
    }

    if (halo.current) {
      const glow = s.laptop.glowRed;
      const pulse = 0.6 + 0.4 * Math.sin(performance.now() * 0.004);
      halo.current.visible = glow > 0.01;
      oneMaterial(halo.current).opacity = glow * (0.3 + pulse * 0.36);
      halo.current.quaternion.copy(camera.quaternion);
      halo.current.scale.setScalar(1 + glow * 0.1 + pulse * 0.025);
    }
    if (haloLight.current) haloLight.current.intensity = s.laptop.glowRed * 4;
    if (screenLight.current) {
      screenLight.current.intensity = s.laptop.screenOn * (quality === 'high' ? 6 : 3.5);
    }
  });

  return (
    <group position={DESK.position} rotation={[0, DESK.yaw, 0]}>
      <mesh position={[0, 0.78, 0]}>
        <boxGeometry args={[5.4, 0.16, 3]} />
        <meshStandardMaterial color="#1a2434" roughness={0.7} metalness={0.15} />
      </mesh>
      {([
        [-2.5, -1.3],
        [2.5, -1.3],
        [-2.5, 1.3],
        [2.5, 1.3]
      ] as [number, number][]).map(([x, z]) => (
        <mesh key={`${x}-${z}`} position={[x, 0.36, z]}>
          <boxGeometry args={[0.14, 0.76, 0.14]} />
          <meshStandardMaterial color="#151d2b" roughness={0.6} metalness={0.5} />
        </mesh>
      ))}

      {/* Desk edge light — warms up as the scene unifies */}
      <mesh position={[0, 0.7, 1.52]}>
        <boxGeometry args={[5.3, 0.045, 0.045]} />
        <meshBasicMaterial color={BRAND.blueBright} transparent opacity={0.5} />
      </mesh>

      <group position={[0, 0.9, 0]}>
        <mesh position={[0, 0, 0.28]}>
          <boxGeometry args={[2.1, 0.06, 1.35]} />
          <meshStandardMaterial color="#2b3646" roughness={0.34} metalness={0.72} />
        </mesh>
        <mesh position={[0, 0.032, 0.28]}>
          <planeGeometry args={[1.86, 0.9]} />
          <meshStandardMaterial color="#1d2634" roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.033, 0.8]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.7, 0.3]} />
          <meshStandardMaterial color="#333f52" roughness={0.28} metalness={0.6} />
        </mesh>

        <group ref={lid} position={[0, 0.04, -0.36]} rotation={[-0.3, 0, 0]}>
          <mesh position={[0, 0.66, 0]}>
            <boxGeometry args={[2.1, 1.32, 0.05]} />
            <meshStandardMaterial color="#2b3646" roughness={0.3} metalness={0.75} />
          </mesh>

          {/* THE dashboard */}
          <mesh position={[0, 0.66, 0.028]}>
            <planeGeometry args={[1.92, 1.2]} />
            <meshBasicMaterial map={screen.texture} toneMapped={false} transparent />
          </mesh>

          <pointLight
            ref={screenLight}
            position={[0, 0.7, 0.9]}
            color={BRAND.blueBright}
            intensity={0}
            distance={10}
            decay={2}
          />
        </group>
      </group>

      {/* Red siren halo — a soft bloom edge, deliberately never a hard strobe */}
      <mesh ref={halo} position={[0, 1.55, 0.4]}>
        <planeGeometry args={[3.6, 2.6]} />
        <meshBasicMaterial
          color={BRAND.red}
          transparent
          opacity={0}
          depthWrite={false}
          depthTest={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      <pointLight ref={haloLight} position={[0, 1.7, 1.6]} color={BRAND.red} intensity={0} distance={9} decay={2} />
    </group>
  );
}
