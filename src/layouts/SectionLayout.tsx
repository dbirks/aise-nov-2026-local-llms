import type { SectionSlide, SlideProps } from '../deck/types';
import './static.css';

export function SectionLayout({ slide }: SlideProps<SectionSlide>) {
  return (
    <div className="sl-section">
      <div className="sl-header">
        <span>{slide.header[0]}</span>
        <span>{slide.header[1]}</span>
      </div>
      <div className="sl-section-bottom">
        <div className="sl-section-number">{slide.number}</div>
        <div className="sl-section-right">
          <div className="sl-section-title">{slide.title}</div>
          <div className="sl-section-framing">{slide.framing}</div>
        </div>
      </div>
    </div>
  );
}
