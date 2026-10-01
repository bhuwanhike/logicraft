// Suppress deprecated THREE.Clock warning emitted by Three.js (r183+) when R3F / Three initializes.
if (typeof window !== 'undefined') {
  const origWarn = console.warn;
  console.warn = (...args) => {
    if (
      typeof args[0] === 'string' &&
      (args[0].includes('THREE.Clock: This module has been deprecated') ||
       args[0].includes('Clock: This module has been deprecated'))
    ) {
      return;
    }
    origWarn.apply(console, args);
  };
}
