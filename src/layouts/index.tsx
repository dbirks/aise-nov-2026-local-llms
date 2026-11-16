import type { Slide, SlideProps } from '../deck/types';
import { TitleLayout } from './TitleLayout';
import { SectionLayout } from './SectionLayout';
import { SceneLayout } from './SceneLayout';
import { CommandLayout } from './CommandLayout';
import { ListLayout } from './ListLayout';
import { ExampleTag } from './ExampleTag';
import './layouts.css';

/** Renders one slide at 1920×1080 by dispatching on slide.type. */
export function SlideView(props: SlideProps<Slide>) {
  const { slide } = props;
  let body;
  switch (slide.type) {
    case 'title': body = <TitleLayout {...props} slide={slide} />; break;
    case 'section': body = <SectionLayout {...props} slide={slide} />; break;
    case 'scene': body = <SceneLayout {...props} slide={slide} />; break;
    case 'command': body = <CommandLayout {...props} slide={slide} />; break;
    case 'list': body = <ListLayout {...props} slide={slide} />; break;
  }
  return <div className="slide">{body}{slide.example && <ExampleTag />}</div>;
}
