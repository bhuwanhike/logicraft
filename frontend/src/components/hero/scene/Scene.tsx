import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { BlendFunction } from 'postprocessing';
import { Stage } from './Stage';
import { World } from './World';
import { SiloPanels } from './SiloPanels';
import { Truck } from './Truck';
import { DispatchDesk } from './DispatchDesk';
import { Signal } from './Signal';
import type { HeroQuality } from '../HeroScene3D';
import type { HeroState } from '../heroTimeline';
import type { SiloPanel } from '../textures/panels';

/** Props passed down to every scene component. */
export interface SceneProps {
  /** The shared animation state bag the GSAP timeline writes into. */
  state: HeroState;
  quality: HeroQuality;
  /** Publishes the baked silo panels so the timeline can blank them. */
  registerPanels: (panels: SiloPanel[]) => void;
}

/**
 * Everything that lives inside the R3F canvas. Props are the shared animation
 * state bag and the register callback the GSAP timeline uses to blank silo
 * panels when their system goes dark.
 */
export function Scene({ state, quality, registerPanels }: SceneProps) {
  return (
    <>
      <Stage state={state} quality={quality} />

      <World state={state} quality={quality} />
      <SiloPanels state={state} register={registerPanels} />
      <Truck state={state} />
      <DispatchDesk state={state} quality={quality} />
      <Signal state={state} />

      {quality === 'high' && (
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <Bloom intensity={0.85} luminanceThreshold={0.55} luminanceSmoothing={0.28} mipmapBlur radius={0.72} />
          <Vignette offset={0.26} darkness={0.6} blendFunction={BlendFunction.NORMAL} />
        </EffectComposer>
      )}
    </>
  );
}
