import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { PixelOpts, SceneKind } from '../deck/types';
import { mount } from './pixel-viz';
import type { MountKind, SceneHandle, SceneState, SplatOpts } from './pixel-viz';

export interface SceneRef {
  /** attach to the div that hosts the WebGL canvas */
  ref: RefObject<HTMLDivElement | null>;
  /** null while unmounted (thumb mode, or before the first effect run) */
  handle: SceneHandle | null;
  /** last state emitted by the scene; shape depends on the kind */
  state: SceneState | null;
}

/**
 * Mounts a pixel-viz scene into `ref` while `enabled` and `!thumb`, and disposes it on
 * unmount / kind change / enabled → false. Safe under StrictMode: the effect disposes in
 * cleanup, so the dev double-invoke leaves exactly one live context.
 * Changing `opts` (pixel, tones, dither) updates the live renderer instead of remounting.
 */
// Scene slides have the caption card on the left (x 96–996 of 1920), so each scene is framed in the
// free space on the right: cx ≈ 0.74 of the width, zoomed out (fit) until it fits that space.
const FRAMING: Record<SceneKind, { cx: number; fit: number }> = {
  moe: { cx: 0.74, fit: 1.35 },
  spec: { cx: 0.74, fit: 1.6 },
  offload: { cx: 0.74, fit: 1.6 },
  sample: { cx: 0.75, fit: 1.8 },
  attn: { cx: 0.74, fit: 2.05 },
  flow: { cx: 0.74, fit: 1.75 },
};

// Splat slides use a narrower caption card (760px), so the view sits a little more centred.
const SPLAT_FRAMING = { cx: 0.62, fit: 1 };

export function useScene(kind: MountKind, opts: PixelOpts, enabled: boolean, splat?: SplatOpts): SceneRef {
  const ref = useRef<HTMLDivElement | null>(null);
  const [handle, setHandle] = useState<SceneHandle | null>(null);
  const [state, setState] = useState<SceneState | null>(null);

  // Latest opts, without making the mount effect depend on the object identity.
  const optsRef = useRef(opts);
  useEffect(() => { optsRef.current = opts; }, [opts]);
  // Same for the splat config: only a change of asset/generator remounts (see splatKey).
  const splatRef = useRef(splat);
  useEffect(() => { splatRef.current = splat; }, [splat]);
  const splatKey = kind === 'splat' ? `${splat?.src ?? ''}|${splat?.proc ?? ''}` : '';

  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    const framing = kind === 'splat' ? SPLAT_FRAMING : FRAMING[kind as SceneKind];
    const h = mount(el, kind, { ...optsRef.current, ...framing, splat: splatRef.current }, setState);
    setHandle(h);
    return () => {
      h.dispose();
      setState(null);
      setHandle(null);
    };
  }, [kind, enabled, splatKey]);

  useEffect(() => {
    if (handle) handle.setOpts(opts);
  }, [handle, opts]);

  return { ref, handle, state };
}
