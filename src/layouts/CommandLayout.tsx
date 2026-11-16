import type { CommandSlide, SlideProps } from '../deck/types';
import './static.css';

/** Preserve leading indentation even though the font is proportional. */
function indent(line: string): string {
  const m = /^[ ]+/.exec(line);
  return m ? '\u00A0'.repeat(m[0].length) + line.slice(m[0].length) : line;
}

export function CommandLayout({ slide }: SlideProps<CommandSlide>) {
  return (
    <div className="sl-command">
      <div className="sl-header">
        <span>{slide.header[0]}</span>
        <span>{slide.header[1]}</span>
      </div>
      <div className="sl-command-lines">
        {slide.lines.map((line, i) => (
          <span
            key={i}
            className={i === slide.active ? 'sl-command-line sl-command-line--active' : 'sl-command-line'}
          >
            {indent(line)}
          </span>
        ))}
      </div>
      <div className="sl-command-side">
        <div className="sl-command-title">{slide.title}</div>
        <div className="sl-command-body">{slide.body}</div>
      </div>
    </div>
  );
}
