// PROTOTYPE / THROWAWAY — verifies `recognizers/runtime-action-probe
// .prototype.ts`'s `probeBroadcastPutCounter` against the two real `kind:
// 'custom'` closures this task's own tier-3-elimination pass considered
// (fin/1-5). NOT wired into anything real, read-only, diagnostic. Run with:
//   npx vite-node functional-model/scripts/prototype-verify-action-probe-fin1-5.mjs
import { probeBroadcastPutCounter } from '../recognizers/runtime-action-probe.ts';
import { aerithGainsborough } from '../cards/aerith-gainsborough/definition.ts';
import { aerithRescueMission } from '../cards/aerith-rescue-mission/definition.ts';

function stableStringify(v) {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (v !== null && typeof v === 'object') {
    const keys = Object.keys(v).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

console.log('=== Aerith Gainsborough — onDies custom effect ===');
const onDiesEffect = aerithGainsborough.triggers[1].effects[0];
if (onDiesEffect.kind !== 'custom') throw new Error('fixture assumption broken: expected a custom effect');
const real0 = onDiesEffect.authoredFact[0]; // the SOURCE putCounter fact this task is trying to mechanize
console.log('real authoredFact[0]:', stableStringify(real0));

const result = probeBroadcastPutCounter(onDiesEffect.run, { selfCounters: { '+1/+1': 2 } });
if (!result.classified) {
  console.log('PROBE DECLINED:', result.reason);
  process.exitCode = 1;
} else {
  console.log('PROBE derived  :', stableStringify(result.fact));
  const { value, targeted: _t1, ...realRest } = real0;
  const derivedForCompare = { ...result.fact, targeted: result.fact.targeted };
  // Compare everything except `value` (a magnitude weight, never asserted by
  // any recognizer — same convention every recognizer in this catalog uses).
  const realForCompare = { event: realRest.event, counterType: realRest.counterType, controller: realRest.controller, target: realRest.target, targeted: real0.targeted };
  const match = stableStringify(derivedForCompare) === stableStringify(realForCompare);
  console.log(match ? 'MATCH (modulo value) — fact [0] is mechanically derivable via the action probe.' : 'MISMATCH — see above.');
  if (!match) process.exitCode = 1;
}

console.log('\n=== Aerith Rescue Mission — tap+stun custom effect (expected to DECLINE) ===');
const modalEffect = aerithRescueMission.effects[0];
if (modalEffect.kind !== 'modal') throw new Error('fixture assumption broken: expected a modal effect');
const tapStunEffect = modalEffect.modes[1].effects[0];
if (tapStunEffect.kind !== 'custom') throw new Error('fixture assumption broken: expected a custom effect');
const rescueResult = probeBroadcastPutCounter(tapStunEffect.run, {});
console.log(rescueResult.classified ? `UNEXPECTED: classified as ${stableStringify(rescueResult.fact)}` : `Correctly declined: ${rescueResult.reason}`);
if (rescueResult.classified) process.exitCode = 1;
