import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { BRAND } from '../hero.constants';
import type { HeroState } from '../heroTimeline';

import type { HeroQuality } from '../HeroScene3D';

/** Props for Stage: the lighting rig that responds to the story's tone. */
export interface StageProps {
  state: HeroState;
  quality: HeroQuality;
}


const COOL = new THREE.Color('#5d7ba8');
const WARM = new THREE.Color(BRAND.blueBright);

/**
 * Camera rig + lighting for the whole piece.
 *
 * Two things matter here narratively: the camera shake on impact, and the
 * `tone` cross-fade that re-grades the entire scene from cold/desaturated
 * ("fragmented") to warm brand blue ("unified"). The tone shift is the visual
 * thesis of the animation, so it drives the lights, the fog and the exposure.
 */
export function Stage({ state, quality }: StageProps) {
  const { camera } = useThree();
  // The rig animates `fov`, which only exists on a PerspectiveCamera. The Canvas
  // is created with a perspective camera, so this narrowing matches runtime.
  const perspective = camera as THREE.PerspectiveCamera;
  const keyRef = useRef<THREE.DirectionalLight>(null);
  const rimRef = useRef<THREE.DirectionalLight>(null);
  const ambRef = useRef<THREE.AmbientLight>(null);
  const lookTarget = useMemo(() => new THREE.Vector3(), []);

  const cool = useMemo(() => new THREE.Color(), []);
  const fogColor = useMemo(() => new THREE.Color(), []);
  const fogWarm = useMemo(() => new THREE.Color('#101d38'), []);
  const sceneFog = useMemo(() => new THREE.Fog('#0a1120', 20, 78), []);

  useFrame((_, dt: number) => {
    const s = state;
    const t = s.tone;

    // --- camera -------------------------------------------------------
    const shake = s.shake * s.shake;
    const time = performance.now() * 0.001;
    camera.position.set(
      s.camera.x + (Math.sin(time * 61.3) + Math.sin(time * 37.1)) * 0.5 * shake * 0.5,
      s.camera.y + (Math.sin(time * 53.7) + Math.sin(time * 43.9)) * 0.5 * shake * 0.4,
      s.camera.z
    );
    lookTarget.set(
      s.camera.tx + Math.sin(time * 71.9) * shake * 0.35,
      s.camera.ty + Math.cos(time * 67.3) * shake * 0.25,
      s.camera.tz
    );
    camera.lookAt(lookTarget);
    if (Math.abs(perspective.fov - s.camera.fov) > 0.01) {
      perspective.fov += (s.camera.fov - perspective.fov) * Math.min(1, dt * 6);
      perspective.updateProjectionMatrix();
    }

    // --- grade --------------------------------------------------------
    cool.copy(COOL).lerp(WARM, t);
    const lift = 0.55 + t * 0.75 + s.ambient * 0.22;
    if (ambRef.current) ambRef.current.intensity = lift * (1 - s.dim * 0.72);
    if (keyRef.current) {
      keyRef.current.intensity = (1.1 + t * 1.5 + s.ambient * 0.5) * (1 - s.dim * 0.8);
      keyRef.current.color.copy(cool);
    }
    if (rimRef.current) {
      rimRef.current.intensity = 0.6 + t * 2.1 + s.ambient * 0.6;
      rimRef.current.color.copy(cool);
    }

    fogColor.set('#0a1120').lerp(fogWarm, t).multiplyScalar(1 - s.dim * 0.45);
    sceneFog.color.copy(fogColor);
  });

  return (
    <>
      <primitive object={sceneFog} attach="fog" />

      <ambientLight ref={ambRef} intensity={0.6} color={COOL} />
      <directionalLight ref={keyRef} position={[-14, 16, 10]} intensity={1.1} color={COOL} />
      <directionalLight ref={rimRef} position={[12, 7, -14]} intensity={0.7} color={WARM} />
      {/* Bounce off the road so the truck never floats. */}
      <hemisphereLight args={['#3d5b8a', '#0a0e18', 0.45]} />

      {quality === 'high' && (
        <Environment resolution={64} frames={1}>
          <Lightformer form="rect" intensity={2.2} color="#7aa7e8" position={[-6, 6, 6]} scale={[10, 6, 1]} />
          <Lightformer form="rect" intensity={1.4} color={BRAND.blueBright} position={[8, 3, -4]} scale={[8, 4, 1]} />
          <Lightformer form="ring" intensity={0.9} color="#ffffff" position={[0, 10, 0]} scale={6} />
        </Environment>
      )}
    </>
  );
}
