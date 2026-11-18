import type { ListSlide, SlideProps } from '../deck/types';
import './static.css';

/** Text with `backtick` spans rendered as code (CLI flags). */
function Rich({ text }: { text: string }) {
  const parts = text.split('`');
  return <>{parts.map((p, i) => (i % 2 ? <code key={i} className="sl-code">{p}</code> : p))}</>;
}

export function ListLayout({ slide }: SlideProps<ListSlide>) {
  return (
    <div className="sl-list">
      <div className="sl-header">
        <span>{slide.header[0]}</span>
        <span>{slide.header[1]}</span>
      </div>
      {slide.title && <div className="sl-list-title">{slide.title}</div>}
      <div className="sl-list-items">
        {slide.items.map((item, i) => (
          <div key={i} className="sl-list-row">
            {slide.marker === 'square'
              ? <span className="sl-list-square" aria-hidden />
              : <span className="sl-list-num">{String(i + 1).padStart(2, '0')}</span>}
            <span>
              <Rich text={item} />
              {slide.subs?.[i] && (
                <span className="sl-list-subs">
                  {slide.subs[i].map((s, j) => (
                    <span key={j} className="sl-list-sub"><span className="sl-list-sub-mark" aria-hidden /><span><Rich text={s} /></span></span>
                  ))}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
      {slide.note && <div className="sl-list-note">{slide.note}</div>}
    </div>
  );
}
