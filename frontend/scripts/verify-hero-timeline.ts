/**
 * Narrative verification for the hero timeline.
 * Runs the real GSAP score headlessly and asserts the story actually reads:
 * fragmentation -> blind spot -> detection -> dashboard -> resolution.
 */
import gsap from 'gsap';
import { buildHeroTimeline, createHeroState, resetHeroState } from '../src/components/hero/heroTimeline';
import type { HeroState } from '../src/components/hero/heroTimeline';
import { BEATS, SILOS, SEQUENCE_DURATION } from '../src/components/hero/hero.constants';

let failures = 0;
let checks = 0;

function check(label: string, condition: boolean, detail = ''): void {
  checks++;
  if (condition) {
    console.log(`  ok   ${label}${detail ? ` — ${detail}` : ''}`);
  } else {
    failures++;
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

const glitches: number[] = [];
const s = createHeroState();
const tl = buildHeroTimeline(s, {
  onSiloGlitch: (i) => glitches.push(i),
  onCopy: () => copyFired.push(true)
});
const copyFired: boolean[] = [];

function at(time: number): HeroState {
  tl.pause(time);
  return s;
}

console.log('\nACT 1 — fragmented world (0–2.1s)');
let f = at(0.1);
check('truck starts off-screen left', f.truck.x < -10, `x=${f.truck.x.toFixed(1)}`);
check('all four silos visible', f.silos.every((x) => x.opacity === 1));
check('scene is in the cool/fragmented grade', f.tone === 0, `tone=${f.tone}`);

f = at(1.2);
check('truck has driven in', f.truck.x > -8 && f.truck.x < 2, `x=${f.truck.x.toFixed(2)}`);
check('wheels are rolling', f.truck.wheelSpin > 5, `spin=${f.truck.wheelSpin.toFixed(1)}`);
check('nothing has gone dark yet', f.silos.every((x) => x.opacity === 1 && x.glitch === 0));

console.log('\nACT 2 — the incident / blind spot (2.1–3.5s)');
f = at(BEATS.incident + 0.2);
check('camera shake fired', f.shake > 0.2, `shake=${f.shake.toFixed(2)}`);
check('truck is jolted off level', Math.abs(f.truck.pitch) > 0.02 || Math.abs(f.truck.roll) > 0.02,
  `pitch=${f.truck.pitch.toFixed(3)} roll=${f.truck.roll.toFixed(3)}`);
check('cargo is rattling', f.truck.rattle > 0.2, `rattle=${f.truck.rattle.toFixed(2)}`);
check('hazard lights are on', f.truck.hazard > 0.5, `hazard=${f.truck.hazard}`);

f = at(3.4);
check('silos are NOT all down yet (staggered)', f.silos.some((x) => x.opacity > 0.9),
  `opacities=[${f.silos.map((x) => x.opacity.toFixed(2)).join(', ')}]`);
check('scene dims into the blind beat', f.dim > 0.7, `dim=${f.dim.toFixed(2)}`);
check('grader tone has NOT shifted yet', f.tone === 0, `tone=${f.tone}`);

console.log('\nACT 3 — the signal / convergence (3.5–5.0s)');
f = at(BEATS.signal + 0.6);
check('wavefront is expanding', f.signal > 0.1 && f.signal < 0.95, `signal=${f.signal.toFixed(2)}`);
check('silos are dissolving behind the wave', f.silos.some((x) => x.dissolve > 0.1),
  `dissolve=[${f.silos.map((x) => x.dissolve.toFixed(2)).join(', ')}]`);
check('grade is warming toward unified', f.tone > 0.1, `tone=${f.tone.toFixed(2)}`);
check('blindness is lifting', f.dim < 0.6, `dim=${f.dim.toFixed(2)}`);

f = at(4.7);
check('converging trail is streaming right', f.trail > 0.4 && f.trail < 1, `trail=${f.trail.toFixed(2)}`);
check('all silos fully consumed by now', f.silos.every((x) => x.opacity < 0.05),
  `opacities=[${f.silos.map((x) => x.opacity.toFixed(2)).join(', ')}]`);

console.log('\nACT 4 — the single pane of glass (5.0–7.0s)');
f = at(5.3);
check('dashboard screen is awake', f.screen.wake > 0.7, `wake=${f.screen.wake.toFixed(2)}`);

f = at(BEATS.alertFlash + 0.04);
check('red flash fires — once, briefly', f.screen.flash > 0.5, `flash=${f.screen.flash.toFixed(2)}`);
f = at(5.9);
check('red flash has already decayed', f.screen.flash < 0.25, `flash=${f.screen.flash.toFixed(2)}`);

f = at(5.9);
check('siren halo is glowing', f.laptop.glowRed > 0.3, `glow=${f.laptop.glowRed.toFixed(2)}`);
check('alert toast has slid in', f.screen.toast > 0.6, `toast=${f.screen.toast.toFixed(2)}`);
check('status badge reads Incident', Math.round(f.screen.badge) === 0, `badge=${f.screen.badge.toFixed(2)}`);

f = at(6.6);
check('next-action panel auto-populates', f.screen.actions > 0.5, `actions=${f.screen.actions.toFixed(2)}`);

console.log('\nACT 5 — control restored (7.0–9.0s)');
f = at(7.6);
check('route is recalculating', f.screen.reroute > 0.3 && f.screen.reroute < 1, `reroute=${f.screen.reroute.toFixed(2)}`);
check('badge has moved to Response Dispatched', f.screen.badge > 0.5 && f.screen.badge < 1.5, `badge=${f.screen.badge.toFixed(2)}`);
check('hazard lights STILL on during response', f.truck.hazard > 0.5, `hazard=${f.truck.hazard}`);

f = at(8.6);
check('badge has resolved', Math.round(f.screen.badge) === 2, `badge=${f.screen.badge.toFixed(2)}`);
check('hazard lights have cleared', f.truck.hazard < 0.3, `hazard=${f.truck.hazard.toFixed(2)}`);
check('scene has brightened', f.ambient > 1, `ambient=${f.ambient.toFixed(2)}`);
check('ambient is fully unified', f.tone === 1, `tone=${f.tone}`);
check('truck has settled level', Math.abs(f.truck.pitch) < 0.02 && Math.abs(f.truck.roll) < 0.02,
  `pitch=${f.truck.pitch.toFixed(3)} roll=${f.truck.roll.toFixed(3)}`);
check('live ticking engaged for idle', f.screen.live > 0, `live=${f.screen.live.toFixed(2)}`);

console.log('\nORDERING + REPLAY');
check('silos died in a stagger, not all at once', new Set(glitches).size === SILOS.length,
  `order=[${glitches.join(', ')}]`);
check('silo glitch beats are strictly increasing',
  SILOS.every((silo, i) => i === 0 || silo.glitchAt > SILOS[i - 1].glitchAt));

resetHeroState(s);
check('reset returns the truck to the off-screen start', s.truck.x === -15, `x=${s.truck.x}`);
check('reset restores all four silos', s.silos.every((x) => x.opacity === 1));
check('reset clears the screen', s.screen.wake === 0 && s.screen.badge === 0);
check('reset returns the grade to fragmented', s.tone === 0 && s.dim === 0);

check('copy is revealed at the end of the sequence', copyFired.length > 0, `at ${BEATS.copyIn}s`);
check('beats are ordered', Object.values(BEATS).every((v, i, arr) => i === 0 || v >= arr[i - 1]),
  Object.values(BEATS).join(' < '));
check('sequence duration covers the last beat', SEQUENCE_DURATION > BEATS.copyIn,
  `${SEQUENCE_DURATION}s > ${BEATS.copyIn}s`);

tl.kill();
console.log(`\n${failures ? 'FAILED' : 'PASSED'} — ${checks - failures}/${checks} checks\n`);
process.exit(failures ? 1 : 0);
