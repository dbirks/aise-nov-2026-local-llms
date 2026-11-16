import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PixelOpts, Slide } from './types';
import { SlideView } from '../layouts';
import './mobile.css';

const W = 1920, H = 1080;

/** Same rule as Deck.indexFromHash: '#/<id>' → slide index, 0 when unknown. */
function indexFromHash(slides: Slide[]): number {
  const id = decodeURIComponent(location.hash.replace(/^#\/?/, ''));
  const i = slides.findIndex(s => s.id === id);
  return i < 0 ? 0 : i;
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Touch deck: a vertical snap-scrolling feed, one slide per screen. The 1920×1080 stage is
 * scaled to fit; only the current page and its neighbours mount live WebGL scenes (the rest
 * render the hatch placeholder). URL hash follows the page in view; ↑ ↓ / PgUp PgDn Space
 * scroll a page at a time.
 */
export function MobileDeck({ slides, pixelOpts }: { slides: Slide[]; pixelOpts: PixelOpts }) {
  const [current, setCurrent] = useState(() => indexFromHash(slides));
  const [fit, setFit] = useState(() => ({
    scale: Math.min(window.innerWidth / W, window.innerHeight / H),
    portrait: window.innerHeight > window.innerWidth,
  }));
  const feedRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLElement | null)[]>([]);

  // Fit the 16:9 slide box to the viewport.
  useEffect(() => {
    const measure = () => setFit({
      scale: Math.min(window.innerWidth / W, window.innerHeight / H),
      portrait: window.innerHeight > window.innerWidth,
    });
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
    };
  }, []);

  // Start on the slide named in the hash, before the observer reports its first position.
  useLayoutEffect(() => {
    pageRefs.current[indexFromHash(slides)]?.scrollIntoView({ block: 'start' });
    // mount only: later hash changes come from the feed itself
  }, []);

  // Which page is on screen.
  useEffect(() => {
    const feed = feedRef.current;
    if (!feed) return;
    const ratios = new Map<number, number>();
    const io = new IntersectionObserver(entries => {
      for (const e of entries) {
        const i = Number(e.target.getAttribute('data-index'));
        if (!Number.isInteger(i) || i < 0 || i >= slides.length) continue;
        ratios.set(i, e.isIntersecting ? e.intersectionRatio : 0);
      }
      // Most-visible page wins; 0.55 avoids flicker while a swipe is still settling.
      let best = -1, bestRatio = 0;
      ratios.forEach((r, i) => { if (r > bestRatio) { bestRatio = r; best = i; } });
      if (best >= 0 && bestRatio >= 0.55) setCurrent(best);
    }, { root: feed, threshold: 0.6 });
    feed.querySelectorAll<HTMLElement>('.mb-page').forEach(p => io.observe(p));
    return () => io.disconnect();
  }, [slides]);

  // Keep the URL in sync (preserving ?mobile=1 and any other query).
  useEffect(() => {
    history.replaceState(null, '', location.pathname + location.search + '#/' + slides[current].id);
  }, [slides, current]);

  // Keyboard paging for desktop-forced mobile.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof HTMLInputElement || t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key;
      let dir = 0;
      if (k === 'ArrowDown' || k === 'PageDown' || k === ' ') dir = 1;
      else if (k === 'ArrowUp' || k === 'PageUp') dir = -1;
      if (!dir) return;
      e.preventDefault();
      const n = Math.max(0, Math.min(slides.length - 1, current + dir));
      pageRefs.current[n]?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [current, slides.length]);

  const { scale, portrait } = fit;

  return (
    <div className="mb-feed" ref={feedRef}>
      {slides.map((s, i) => (
        // Current slide + one neighbour on each side are live; the rest are thumbnails.
        <section key={s.id} className="mb-page" data-index={i}
          ref={el => { pageRefs.current[i] = el; }}>
          <div className="mb-box" style={{ width: W * scale, height: H * scale }}>
            <div className="mb-stage" style={{ transform: `scale(${scale})` }}>
              <SlideView slide={s} active={i === current} pixelOpts={pixelOpts}
                thumb={Math.abs(i - current) > 1} />
            </div>
          </div>
          {portrait && (
            <div className="mb-caption">
              {`${pad2(i + 1)} / ${slides.length} · swipe ↑ · rotate for a bigger view`}
            </div>
          )}
        </section>
      ))}
      <div className="mb-progress" aria-hidden>
        {slides.map((s, i) => <i key={s.id} data-current={i === current} />)}
      </div>
    </div>
  );
}
