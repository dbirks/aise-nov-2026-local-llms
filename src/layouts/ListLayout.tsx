import type { ListSlide, SlideProps } from '../deck/types';
import './static.css';

export function ListLayout({ slide }: SlideProps<ListSlide>) {
  return (
    <div className="sl-list">
      <div className="sl-header">
        <span>{slide.header[0]}</span>
        <span>{slide.header[1]}</span>
      </div>
      <div className="sl-list-title">{slide.title}</div>
      <div className="sl-list-items">
        {slide.items.map((item, i) => (
          <div key={i} className="sl-list-row">
            <span className="sl-list-num">{String(i + 1).padStart(2, '0')}</span>
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
