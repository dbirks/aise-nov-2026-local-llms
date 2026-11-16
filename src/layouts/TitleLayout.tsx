import type { TitleSlide, SlideProps } from '../deck/types';
import './static.css';

export function TitleLayout({ slide }: SlideProps<TitleSlide>) {
  const lines = slide.headline.split('\n');
  return (
    <div className="sl-title">
      <div className="sl-header">
        <span>{slide.header[0]}</span>
        <span>{slide.header[1]}</span>
      </div>
      <div className="sl-title-headline">
        {lines.map((line, i) => (
          <span key={i}>
            {line}
            {i < lines.length - 1 && <br />}
          </span>
        ))}
      </div>
      <div className="sl-title-chapters">
        {slide.chapters.map(([num, label]) => (
          <div key={num} className="sl-title-row">
            <span className="sl-title-num">{num}</span>
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
