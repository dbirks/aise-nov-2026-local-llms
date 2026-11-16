import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import type { PixelOpts, SceneKind } from '../deck/types';
import { mount } from './pixel-viz';
import type { SceneHandle, SceneState } from './pixel-viz';

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
export function useScene(kind: SceneKind, opts: PixelOpts, enabled: boolean): SceneRef {
  const ref = useRef<HTMLDivElement | null>(null);
  const [handle, setHandle] = useState<SceneHandle | null>(null);
  const [state, setState] = useState<SceneState | null>(null);

  // Latest opts, without making the mount effect depend on the object identity.
  const optsRef = useRef(opts);
  useEffect(() => { optsRef.current = opts; }, [opts]);

  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el) return;
    const h = mount(el, kind, optsRef.current, setState);
    setHandle(h);
    return () => {
      h.dispose();
      setState(null);
      setHandle(null);
    };
  }, [kind, enabled]);

  useEffect(() => {
    if (handle) handle.setOpts(opts);
  }, [handle, opts]);

  return { ref, handle, state };
}
