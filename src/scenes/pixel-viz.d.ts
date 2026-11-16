import type { SceneKind, PixelOpts, SplatView } from '../deck/types';

export interface SceneHandle {
  setOpts(opts: Partial<PixelOpts> & Framing): void;
  /** 'view' resets the camera, 'rotate' ±1 turns 90°, everything else goes to the scene (play, step, k, …) */
  action(name: string, arg?: unknown): void;
  dispose(): void;
}

/** scene state objects differ per kind; see design/handoff/pixel-scenes/NOTES.md */
export type SceneState = Record<string, unknown>;

/** `opts.splat` for kind 'splat': one asset (file `src` or generator `proc`) in one scene. */
export interface SplatOpts {
  /** file in public/ (no leading slash): .spz .ply .splat .ksplat .sog */
  src?: string;
  /** key in src/scenes/splat-procs/<name>.ts */
  proc?: string;
  /** ortho camera; defaults to { target:[0,0,0], radius:40, theta:0.6, phi:1.1, size:2.2 } */
  view?: SplatView;
  transform?: { position?: [number, number, number]; quaternion?: [number, number, number, number]; scale?: number };
  /** turntable radians/second, toggled by action('play') */
  spin?: number;
}

export type MountKind = SceneKind | 'splat';

export interface MountOpts extends Partial<PixelOpts>, Framing {
  splat?: SplatOpts;
}

export interface Framing {
  /** view target x as a fraction of canvas width (0.5 = centred) */
  cx?: number;
  /** >1 zooms out */
  fit?: number;
}

export function mount(el: HTMLElement, kind: MountKind, opts?: MountOpts, onState?: (s: SceneState) => void): SceneHandle;
