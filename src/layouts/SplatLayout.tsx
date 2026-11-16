import { useEffect, useMemo } from 'react';
import type { SplatSlide, SlideProps } from '../deck/types';
import { useScene } from '../scenes/useScene';
import './splat.css';

/**
 * Type GS · Gaussian splat through the pixel pipeline: full-bleed low-res render, floating chip,
 * narrower caption card, and a "SPLAT LAB" method tag top-right so every experiment says how its
 * splats were made. `.` toggles the turntable, `r` resets the camera.
 */
export function SplatLayout({ slide, active, pixelOpts, thumb }: SlideProps<SplatSlide>) {
  const { ref, handle, state } = useScene(
    'splat',
    pixelOpts,
    !thumb,
    { src: slide.src, proc: slide.proc, view: slide.view, transform: slide.transform, spin: slide.spin },
  );

  // Keyboard: '.' toggles the turntable, 'r' resets the view (same grammar as the scene slides).
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

  const playing = state?.playing !== false;
  const loaded = state?.loaded === true;
  const line = useMemo(() => {
    if (!loaded) return 'loading…';
    const count = typeof state?.count === 'number' ? state.count : null;
    return count === null ? 'splat mesh ready' : `${count.toLocaleString('en-US')} splats`;
  }, [loaded, state]);

  return (
    <div className="sp-root">
      {thumb
        ? <div className="sp-thumb" />
        : <div className="sp-canvas" ref={ref} />}

      <div className="sp-chip">{slide.chip}</div>

      <div className="sp-method">
        <div className="sp-method-label">SPLAT LAB · {slide.method.label}</div>
        <div className="sp-method-how">{slide.method.how}</div>
        <div className="sp-method-compute">{slide.method.compute}</div>
      </div>

      <div className="sp-card">
        <div className="sp-title">{slide.caption.title}</div>
        <div className="sp-body">{slide.caption.body}</div>

        {!thumb && (
          <div className="sp-controls">
            <button
              className="sp-btn"
              onClick={() => { handle?.action('play'); }}
              aria-label={playing ? 'pause' : 'play'}
            >
              {playing ? '❚❚' : '▶'}
            </button>
            <button className="sp-btn" onClick={() => { handle?.action('view'); }}>reset view</button>
          </div>
        )}

        {!thumb && <div className="sp-readout">{line}</div>}
      </div>

      <div className="sp-hint">← → slide · drag to orbit · wheel to zoom</div>
    </div>
  );
}
