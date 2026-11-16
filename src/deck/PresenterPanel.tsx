import type { PixelOpts, Slide, Tones } from './types';
import './chrome.css';

const PIXELS = [1, 1.5, 2, 3, 4, 6];
const TONES: { label: string; value: Tones }[] = [
  { label: '4', value: '4' },
  { label: '6', value: '6' },
  { label: '8', value: '8' },
  { label: '16', value: '16' },
  { label: '32', value: '32' },
  { label: 'smooth', value: 'smooth' },
];

/** Keep focus on the window so ← / → keep navigating slides after a click. */
function blur(e: React.MouseEvent<HTMLButtonElement>) { e.currentTarget.blur(); }

/**
 * Presenter panel (P): position, pixel-render controls, speaker notes and key cheat sheet.
 * Real screen pixels, bottom-right of the window — not part of a slide.
 */
export function PresenterPanel({ slide, index, total, pixelOpts, onPixelOpts, onClose }: {
  slide: Slide;
  index: number;
  total: number;
  pixelOpts: PixelOpts;
  onPixelOpts: (o: PixelOpts) => void;
  onClose: () => void;
}) {
  return (
    <div className="ch-panel">
      <div className="ch-row">
        <div>{`${index + 1} / ${total} · ${slide.id}`}</div>
        <button className="ch-close" onClick={e => { blur(e); onClose(); }} aria-label="Close presenter panel">×</button>
      </div>

      <div>
        <div className="ch-label">Render</div>
        <div className="ch-line">
          <span className="ch-field">pixel</span>
          {PIXELS.map(v => (
            <button key={v} className="ch-seg" data-on={pixelOpts.pixel === v}
              onClick={e => { blur(e); onPixelOpts({ ...pixelOpts, pixel: v }); }}>
              {v}
            </button>
          ))}
        </div>
        <div className="ch-line">
          <span className="ch-field">tones</span>
          {TONES.map(t => (
            <button key={t.value} className="ch-seg" data-on={pixelOpts.tones === t.value}
              onClick={e => { blur(e); onPixelOpts({ ...pixelOpts, tones: t.value }); }}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="ch-line">
          <span className="ch-field">dither</span>
          <button className="ch-seg" data-on={pixelOpts.dither}
            onClick={e => { blur(e); onPixelOpts({ ...pixelOpts, dither: !pixelOpts.dither }); }}>
            {pixelOpts.dither ? 'on' : 'off'}
          </button>
        </div>
      </div>

      <div>
        <div className="ch-label">Notes</div>
        <div className="ch-notes">
          {slide.example && <div>EXAMPLE slide (placeholder)</div>}
          <div>{slide.notes ?? '—'}</div>
        </div>
      </div>

      <div>
        <div className="ch-label">Keys</div>
        <div className="ch-keys">
          ← → step / slide · ↑ ↓ slide · . play/pause · r reset view · O overview · P panel · F fullscreen
        </div>
      </div>
    </div>
  );
}
