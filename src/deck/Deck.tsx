import { useCallback, useEffect, useRef, useState } from 'react';
import type { PixelOpts, Slide } from './types';
import { SlideView } from '../layouts';
import { Overview } from './Overview';
import { PresenterPanel } from './PresenterPanel';
import { MobileDeck } from './MobileDeck';
import './deck.css';

const W = 1920, H = 1080;
const DEFAULT_OPTS: PixelOpts = { pixel: 1.5, tones: '16', dither: true };

function indexFromHash(slides: Slide[]): number {
  const id = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  const i = slides.findIndex(s => s.id === id);
  return i < 0 ? 0 : i;
}

/** True when `?mobile=1` is in the URL (lets you test the touch feed on a desktop browser). */
function forcedMobile(): boolean {
  return new URLSearchParams(location.search).get('mobile') === '1';
}

/** Live CSS media query (pointer: coarse on touch devices). */
function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatch(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return match;
}

function loadOpts(): PixelOpts {
  try { return { ...DEFAULT_OPTS, ...JSON.parse(localStorage.getItem('pixelOpts') ?? '{}') }; } catch { return DEFAULT_OPTS; }
}

/**
 * Deck shell: scales a 1920×1080 stage to the window (letterboxed on --page),
 * keyboard navigation, URL hash per slide, overview grid (O), presenter panel (P), fullscreen (F).
 * ← → first go to the active slide's step handler (scenes step their animation), then change slide.
 */
export function Deck({ slides }: { slides: Slide[] }) {
  const [index, setIndex] = useState(() => indexFromHash(slides));
  const [scale, setScale] = useState(1);
  const [overview, setOverview] = useState(false);
  const [panel, setPanel] = useState(false);
  const [pixelOpts, setPixelOptsState] = useState<PixelOpts>(loadOpts);
  const stepHandler = useRef<((dir: 1 | -1) => boolean) | null>(null);
  const mobile = useMediaQuery('(pointer: coarse)') || forcedMobile();

  const setPixelOpts = useCallback((o: PixelOpts) => {
    setPixelOptsState(o);
    try { localStorage.setItem('pixelOpts', JSON.stringify(o)); } catch { /* ignore */ }
  }, []);

  const go = useCallback((i: number) => {
    const n = Math.max(0, Math.min(slides.length - 1, i));
    stepHandler.current = null;
    setIndex(n);
    history.replaceState(null, '', `#/${slides[n].id}`);
  }, [slides]);

  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / W, window.innerHeight / H));
    fit();
    window.addEventListener('resize', fit);
    const onHash = () => setIndex(indexFromHash(slides));
    window.addEventListener('hashchange', onHash);
    return () => { window.removeEventListener('resize', fit); window.removeEventListener('hashchange', onHash); };
  }, [slides]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (mobile) return; // the touch feed owns keyboard paging
      const k = e.key;
      if (overview) {
        if (k === 'Escape' || k === 'o' || k === 'O') setOverview(false);
        return;
      }
      if (k === 'ArrowRight' || k === 'ArrowLeft') {
        const dir = k === 'ArrowRight' ? 1 : -1;
        if (stepHandler.current?.(dir)) return;
        go(index + dir);
      } else if (k === 'PageDown' || k === ' ' || k === 'ArrowDown') { e.preventDefault(); go(index + 1); }
      else if (k === 'PageUp' || k === 'ArrowUp') { e.preventDefault(); go(index - 1); }
      else if (k === 'Home') go(0);
      else if (k === 'End') go(slides.length - 1);
      else if (k === 'o' || k === 'O' || k === 'Escape') setOverview(v => !v && k !== 'Escape');
      else if (k === 'p' || k === 'P') setPanel(v => !v);
      else if (k === 'f' || k === 'F') {
        if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, index, mobile, overview, slides.length]);

  const onStepKey = useCallback((h: ((dir: 1 | -1) => boolean) | null) => { stepHandler.current = h; }, []);

  if (mobile) return <MobileDeck slides={slides} pixelOpts={pixelOpts} />;

  return (
    <div className="deck">
      <div className="deck-stage" style={{ width: W * scale, height: H * scale }}>
        {slides.map((s, i) => (
          // Only the current slide and its neighbours are mounted, so at most 3 WebGL contexts exist.
          Math.abs(i - index) <= 1 && (
            <div key={s.id} className="deck-slide" data-active={i === index}
              style={{ transform: `scale(${scale})`, visibility: i === index ? 'visible' : 'hidden' }}>
              <SlideView slide={s} active={i === index} pixelOpts={pixelOpts} onStepKey={i === index ? onStepKey : undefined} />
            </div>
          )
        ))}
      </div>
      <div className="deck-progress" style={{ width: `${((index + 1) / slides.length) * 100}%` }} />
      {overview && <Overview slides={slides} index={index} onPick={i => { go(i); setOverview(false); }} />}
      {panel && <PresenterPanel slide={slides[index]} index={index} total={slides.length}
        pixelOpts={pixelOpts} onPixelOpts={setPixelOpts} onClose={() => setPanel(false)} />}
    </div>
  );
}
