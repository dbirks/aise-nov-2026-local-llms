import type { SceneKind, PixelOpts } from '../deck/types';

export interface SceneHandle {
  setOpts(opts: Partial<PixelOpts>): void;
  /** 'view' resets the camera, 'rotate' ±1 turns 90°, everything else goes to the scene (play, step, k, …) */
  action(name: string, arg?: unknown): void;
  dispose(): void;
}

/** scene state objects differ per kind; see design/handoff/pixel-scenes/NOTES.md */
export type SceneState = Record<string, unknown>;

export function mount(el: HTMLElement, kind: SceneKind, opts?: Partial<PixelOpts>, onState?: (s: SceneState) => void): SceneHandle;
