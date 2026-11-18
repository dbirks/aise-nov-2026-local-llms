import { useEffect, useMemo, useRef, useState } from 'react';
import type { SceneControl, SceneKind, SceneSlide, SlideProps } from '../deck/types';
import type { SceneHandle, SceneState } from '../scenes/pixel-viz';
import { useScene } from '../scenes/useScene';
import './scene.css';

type Selection = Record<string, string | number | boolean>;

function initialSelections(controls: SceneControl[] | undefined): Selection {
  const sel: Selection = {};
  for (const c of controls ?? []) sel[c.action] = c.initial;
  return sel;
}

const num = (v: unknown): string => (typeof v === 'number' ? String(v) : '–');
const text = (v: unknown): string => (typeof v === 'string' ? v : '–');
const list = (v: unknown): string => (Array.isArray(v) && v.length ? v.join(', ') : '–');
const word = (v: unknown): string => (typeof v === 'string' && v ? ` · picked “${v}”` : '');

/** One-line human summary of the live scene state. All numbers are simulated. */
function readout(kind: SceneKind, s: SceneState): string {
  // builders in src/scenes/builders emit their own one-line readout
  if (typeof s.readout === 'string') return s.readout;
  switch (kind) {
    case 'moe':
      return `layer ${num(s.layer)}/${num(s.L)} · experts ${list(s.chosen)} · ≈${num(s.k)}/${num(s.E)} weights active · ${s.residency === 'ram' ? 'experts in RAM' : `all ${num(s.E)} resident`}`;
    case 'spec':
      return `${text(s.phase)} · ${text(s.mode)} · accepted ${num(s.a)}/${num(s.K)} · target passes ${num(s.rounds)}`;
    case 'offload':
      return `GPU layers ${num(s.ngl)}/${num(s.NL)} · CPU ${num(s.cpu)} · each CPU layer streams weights from RAM/token`;
    case 'sample':
      return `T=${num(s.T)} · top-p ${num(s.topP)} · ${num(s.k)} of ${num(s.NT)} tokens kept${word(s.word)}`;
    case 'attn':
      return `${text(s.mode)} · query ${num(s.q)}/${num(s.N)} · window ${num(s.win)}`;
    case 'flow':
      return `~${num(s.per)} tok/s per user · ~${num(s.tot)} total (relative)`;
    default:
      return '';
  }
}

/** Play / pause drawn on a 7×7 pixel grid so it matches the pixel font. */
const ICONS: Record<'play' | 'pause', [number, number, number][]> = {
  // [x, y, width] runs
  play: [[1, 0, 1], [1, 1, 2], [1, 2, 3], [1, 3, 4], [1, 4, 3], [1, 5, 2], [1, 6, 1]],
  pause: [0, 1, 2, 3, 4, 5, 6].flatMap(y => [[1, y, 2], [4, y, 2]] as [number, number, number][]),
};
function PixelIcon({ kind }: { kind: 'play' | 'pause' }) {
  return (
    <svg className="sc-icon" viewBox="0 0 7 7" shapeRendering="crispEdges" aria-hidden>
      {ICONS[kind].map(([x, y, w]) => <rect key={`${x}-${y}`} x={x} y={y} width={w} height={1} fill="currentColor" />)}
    </svg>
  );
}

/**
 * Type C · full-bleed pixel scene with floating chip, caption card (concept controls + live
 * readout) and hint. While the slide is active, → steps a paused scene instead of advancing
 * the deck; `.` toggles play, `r` resets the camera.
 */
export function SceneLayout({ slide, active, pixelOpts, onStepKey, thumb }: SlideProps<SceneSlide>) {
  const { ref, handle, state } = useScene(slide.scene, pixelOpts, !thumb);
  const controls = slide.controls;
  const [sel, setSel] = useState<Selection>(() => initialSelections(controls));

  // Agree with the scene's own defaults once per mount: push every control's `initial`
  // (toggles that start off are already off, so they are left alone).
  const primed = useRef<Set<SceneHandle>>(new Set());
  useEffect(() => {
    if (!handle || primed.current.has(handle)) return;
    primed.current.add(handle);
    for (const c of controls ?? []) {
      if (c.kind === 'toggle') { if (c.initial) handle.action(c.action, true); }
      else handle.action(c.action, c.initial);
    }
  }, [handle, controls]);

  // → steps the animation while paused; otherwise (and always for ←) the deck navigates.
  useEffect(() => {
    if (!active || thumb || !onStepKey) return;
    onStepKey((dir: 1 | -1) => {
      // ↓ = next beat, ↑ = previous beat ('back'; builders that can't go back ignore it). Both pause playback.
      handle?.action(dir === 1 ? 'step' : 'back');
      return true;
    });
    return () => onStepKey(null);
  }, [active, thumb, onStepKey, handle, state]);

  useEffect(() => {
    if (!active || thumb || !handle) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === '.') { e.preventDefault(); handle.action('play'); }
      else if (e.key === 'r') { e.preventDefault(); handle.action('view'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, thumb, handle]);

  const pick = (c: SceneControl, value: string | number | boolean) => {
    setSel(prev => ({ ...prev, [c.action]: value }));
    handle?.action(c.action, value);
  };

  const playing = state?.playing !== false;
  const line = useMemo(() => (state ? readout(slide.scene, state) : null), [state, slide.scene]);

  return (
    <div className="sc-root">
      {thumb
        ? <div className="sc-thumb" />
        : <div className="sc-canvas" ref={ref} />}

      <div className="sc-chip">{slide.chip}</div>
      {slide.page && <div className="sc-page">{slide.page}</div>}

      <div className="sc-card">
        <div className="sc-title">{slide.caption.title}</div>
        <div className="sc-body">{slide.caption.body}</div>

        {!thumb && (
          <div className="sc-controls">
            <button
              className="sc-btn"
              onClick={() => { handle?.action('play'); }}
              aria-label={playing ? 'pause' : 'play'}
            >
              <PixelIcon kind={playing ? 'pause' : 'play'} />
            </button>
            <button className="sc-btn" onClick={() => { handle?.action('view'); }}>reset view</button>

            {(controls ?? []).map(c => c.kind === 'choice' ? (
              <span className="sc-ctl" key={c.action}>
                <span className="sc-label">{c.label}</span>
                {c.options.map(o => (
                  <button
                    key={String(o.value)}
                    className={'sc-btn' + (sel[c.action] === o.value ? ' sc-on' : '')}
                    onClick={() => pick(c, o.value)}
                  >
                    {o.label}
                  </button>
                ))}
              </span>
            ) : (
              <span className="sc-ctl" key={c.action}>
                <span className="sc-label">{c.label}</span>
                <button
                  className={'sc-btn' + (sel[c.action] ? ' sc-on' : '')}
                  onClick={() => pick(c, !sel[c.action])}
                >
                  {sel[c.action] ? 'on' : 'off'}
                </button>
              </span>
            ))}
          </div>
        )}

        {!thumb && <div className="sc-readout">{line ? (/^(simulated|speaker|spec|mechanism|measured)\b/.test(line) ? line : `simulated · ${line}`) : 'simulated · initialising…'}</div>}
      </div>

      <div className="sc-hint">{slide.hint ?? '← → slide · ↓ ↑ step · drag to orbit'}</div>
    </div>
  );
}
