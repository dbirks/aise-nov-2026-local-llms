// Shared helpers for scene builders in this folder (copied from pixel-viz.js so builders stay independent).
// A builder file default-exports `build(scene, emit, ctx)` returning { view, update(dt), action(name, arg), resize?(W,H) }.
// The file name (without .js) is the scene kind. See design/handoff/pixel-scenes/NOTES.md for conventions.
import * as THREE from 'three';
export { THREE };

/** deterministic PRNG (mulberry32) */
export function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** greyscale Lambert material; colour comes only from the post shader */
export const lam = (c, extra = {}) => new THREE.MeshLambertMaterial({ color: c, ...extra });
/** translucent unlit material for plates/slabs */
export const ghost = (c, opacity) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity, depthWrite: false });
/** scratch objects for InstancedMesh.setMatrixAt */
export const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3();
/** exponential smoothing factor */
export const ease = (dt, k) => Math.min(1, dt * k);
/** emit helper: only calls emit when the JSON changes */
export function emitter(emit) { let last = ''; return st => { const k = JSON.stringify(st); if (k !== last) { last = k; emit(st); } }; }
