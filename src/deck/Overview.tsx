import { useEffect, useRef, useState } from 'react';
import type { PixelOpts, Slide } from './types';
import { SlideView } from '../layouts';
import './chrome.css';

const W = 1920;
const H = 1080;
const THUMB_OPTS: PixelOpts = { pixel: 1.5, tones: '16', dither: true };

/**
 * Full-screen overview grid (O). Every cell renders the real slide as a thumbnail
 * (`thumb` → layouts skip WebGL/interaction and scenes show the hatch placeholder),
 * scaled down from the 1920×1080 authoring size to the measured cell width.
 */
export function Overview({ slides, index, onPick }: {
  slides: Slide[];
  index: number;
  onPick: (i: number) => void;
}) {
  const firstBox = useRef<HTMLDivElement | null>(null);
  const cells = useRef<(HTMLButtonElement | null)[]>([]);
  const [thumbW, setThumbW] = useState(0);

  // All cells are the same width, so measuring the first one is enough.
  useEffect(() => {
    const el = firstBox.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width ?? el.clientWidth;
      if (w > 0) setThumbW(prev => (Math.abs(prev - w) > 0.5 ? w : prev));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    cells.current[index]?.scrollIntoView({ block: 'center', inline: 'nearest' });
    // Runs on open only: the overview remounts every time it is shown.
  }, []);

  const scale = thumbW / W;

  return (
    <div className="ch-overview">
      <div className="ch-head">
        <div className="ch-title">Slides</div>
        <div className="ch-hint">O / Esc to close</div>
      </div>
      <div className="ch-grid">
        {slides.map((s, i) => (
          <button
            key={s.id}
            ref={el => { cells.current[i] = el; }}
            className="ch-cell"
            data-current={i === index}
            onClick={() => onPick(i)}
            aria-label={`${String(i + 1).padStart(2, '0')} ${s.id}`}
          >
            <div className="ch-thumb" ref={i === 0 ? firstBox : undefined}>
              {scale > 0 && (
                <div
                  className="ch-slide"
                  style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: '0 0' }}
                >
                  <SlideView slide={s} active={false} thumb pixelOpts={THUMB_OPTS} />
                </div>
              )}
            </div>
            <div className="ch-cap">
              {`${String(i + 1).padStart(2, '0')} · ${s.id}`}
              {s.example && <span className="ch-cap-x"> · example</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
