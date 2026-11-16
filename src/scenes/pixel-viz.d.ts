import type { SceneKind, PixelOpts } from '../deck/types';

export interface SceneHandle {
  setOpts(opts: Partial<PixelOpts> & Framing): void;
  /** 'view' resets the camera, 'rotate' ±1 turns 90°, everything else goes to the scene (play, step, k, …) */
  action(name: string, arg?: unknown): void;
  dispose(): void;
}

/** scene state objects differ per kind; see design/handoff/pixel-scenes/NOTES.md */
export type SceneState = Record<string, unknown>;

export interface Framing {
  /** view target x as a fraction of canvas width (0.5 = centred) */
  cx?: number;
  /** >1 zooms out */
  fit?: number;
}

export function mount(el: HTMLElement, kind: SceneKind, opts?: Partial<PixelOpts> & Framing, onState?: (s: SceneState) => void): SceneHandle;
