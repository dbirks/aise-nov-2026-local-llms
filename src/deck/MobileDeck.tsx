import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PixelOpts, Slide } from './types';
import { SlideView } from '../layouts';
import { initialIndex, saveIndex } from './position';
import './mobile.css';

const W = 1920, H = 1080;

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Usable area: the visual viewport minus the notch / home-indicator safe areas (needs viewport-fit=cover). */
function measureFit() {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const px = (v: string) => parseFloat(v) || 0;
  const insetX = px(cs.paddingLeft) + px(cs.paddingRight), insetY = px(cs.paddingTop) + px(cs.paddingBottom);
  probe.remove();
  const vw = (window.visualViewport?.width ?? window.innerWidth) - insetX;
  const vh = (window.visualViewport?.height ?? window.innerHeight) - insetY;
  return { scale: Math.min(vw / W, vh / H), portrait: vh > vw };
}

const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches
  || (navigator as Navigator & { standalone?: boolean }).standalone === true;
/** Element fullscreen works on Android Chrome/Firefox and iPad Safari, not on iPhone Safari. */
const canFullscreen = () => !!document.documentElement.requestFullscreen && document.fullscreenEnabled;
const TIP_KEY = 'mb-a2hs-tip-dismissed';

/**
 * Touch deck: a vertical snap-scrolling feed, one slide per screen. The 1920×1080 stage is
 * scaled to fit; only the current page and its neighbours mount live WebGL scenes (the rest
 * render the hatch placeholder). URL hash follows the page in view; ↑ ↓ / PgUp PgDn Space
 * scroll a page at a time.
 */
export function MobileDeck({ slides, pixelOpts }: { slides: Slide[]; pixelOpts: PixelOpts }) {
  const [current, setCurrent] = useState(() => initialIndex(slides));
  const [drag, setDrag] = useState<{ index: number; y: number } | null>(null);
  const dragRef = useRef<{ index: number; y: number } | null>(null);
  const [fit, setFit] = useState(measureFit);
  const [tip, setTip] = useState(false);
  const feedRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLElement | null)[]>([]);

  // Fit the 16:9 slide box to the viewport.
  useEffect(() => {
    // orientationchange fires before the new size settles on iOS, so re-measure a beat later too.
    const measure = () => { setFit(measureFit()); setTimeout(() => setFit(measureFit()), 350); };
    measure();
    window.addEventListener('resize', measure);
    window.addEventListener('orientationchange', measure);
    window.visualViewport?.addEventListener('resize', measure);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('orientationchange', measure);
      window.visualViewport?.removeEventListener('resize', measure);
    };
  }, []);

  // Landscape → full screen where the browser allows it. Browsers require a user gesture, so the
  // first tap after rotating enters fullscreen (Android Chrome, iPad Safari). iPhone Safari has no
  // element fullscreen at all: show a one-time "Add to Home Screen" tip instead.
  useEffect(() => {
    if (fit.portrait || isStandalone()) { setTip(false); return; }
    if (canFullscreen()) {
      const go = () => {
        if (!document.fullscreenElement && window.innerWidth > window.innerHeight) {
          document.documentElement.requestFullscreen({ navigationUI: 'hide' }).catch(() => { /* denied */ });
        }
      };
      window.addEventListener('touchend', go, { once: true });
      return () => window.removeEventListener('touchend', go);
    }
    if (isIOS) {
      let dismissed = false;
      try { dismissed = localStorage.getItem(TIP_KEY) === '1'; } catch { /* storage blocked */ }
      setTip(!dismissed);
    }
  }, [fit.portrait]);

  const dismissTip = () => {
    setTip(false);
    try { localStorage.setItem(TIP_KEY, '1'); } catch { /* storage blocked */ }
  };

  // Start on the slide named in the hash, before the observer reports its first position.
  useLayoutEffect(() => {
    pageRefs.current[current]?.scrollIntoView({ block: 'start' });
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
    saveIndex(current);
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
  const slideTitle = (slide: Slide) => {
    if (slide.type === 'title') return slide.headline.replace(/\n/g, ' ');
    if (slide.type === 'scene' || slide.type === 'splat') return slide.caption.title;
    return slide.title || slide.id;
  };
  const updateDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    const next = { index: Math.round((y / rect.height) * (slides.length - 1)), y };
    dragRef.current = next;
    setDrag(next);
  };

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
      <div className="mb-scrub" role="slider" aria-label="Slide navigation"
        aria-valuemin={1} aria-valuemax={slides.length} aria-valuenow={(drag?.index ?? current) + 1}
        onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); updateDrag(event); }}
        onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) updateDrag(event); }}
        onPointerUp={event => {
          updateDrag(event);
          const target = dragRef.current?.index;
          if (target !== undefined) pageRefs.current[target]?.scrollIntoView({ block: 'start', behavior: 'auto' });
          dragRef.current = null;
          setDrag(null);
        }}
        onPointerCancel={() => { dragRef.current = null; setDrag(null); }}>
        <div className="mb-scrub-track" />
        <div className="mb-scrub-thumb" style={{ top: drag ? `${drag.y}px` : `${slides.length > 1 ? current / (slides.length - 1) * 100 : 0}%` }} />
        {drag && <div className="mb-scrub-bubble" style={{ top: `clamp(38px, ${drag.y}px, calc(100% - 38px))` }}>
          <div>{pad2(drag.index + 1)} / {slides.length}</div>
          <div>{slideTitle(slides[drag.index])}</div>
        </div>}
      </div>
      {tip && (
        <button className="mb-tip" onClick={dismissTip}>
          For true full screen: Share → Add to Home Screen, then open it from the icon. ×
        </button>
      )}
      <div className="mb-progress" aria-hidden>
        {slides.map((s, i) => <i key={s.id} data-current={i === current} />)}
      </div>
    </div>
  );
}
