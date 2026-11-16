// Shared contract for the deck. See docs/ARCHITECTURE.md.
// Every slide is plain data; layouts in src/layouts render it at 1920×1080.

export type SceneKind = 'moe' | 'spec' | 'offload' | 'sample' | 'attn' | 'flow';

export type Tones = '4' | '6' | '8' | '16' | '32' | 'smooth';

export interface PixelOpts {
  /** size of one render pixel in slide pixels, 1–8 */
  pixel: number;
  tones: Tones;
  dither: boolean;
}

interface SlideBase {
  /** stable id, used in the URL hash: #/<id> */
  id: string;
  /** true while the slide content is a placeholder. Renders an "EXAMPLE" tag. */
  example?: boolean;
  /** speaker notes (shown in the presenter overlay, never on the slide) */
  notes?: string;
}

/** A · Title */
export interface TitleSlide extends SlideBase {
  type: 'title';
  /** running header, left / right */
  header: [string, string];
  /** headline; '\n' becomes a line break */
  headline: string;
  /** numbered chapter list on the right, e.g. [['01','Choose a model'], ...] */
  chapters: [string, string][];
}

/** B · Section divider */
export interface SectionSlide extends SlideBase {
  type: 'section';
  header: [string, string];
  number: string;
  title: string;
  framing: string;
}

/** C · Scene: full-bleed live 3D with floating chip, caption card and hint */
export interface SceneSlide extends SlideBase {
  type: 'scene';
  scene: SceneKind;
  /** top-left chip, e.g. "01 — Choose a model" */
  chip: string;
  caption: { title: string; body: string };
  /** bottom-right hint, default "← → step · drag to orbit" */
  hint?: string;
  /** concept controls shown in the caption card; each maps to mount().action(name, value) */
  controls?: SceneControl[];
}

export type SceneControl =
  | { kind: 'choice'; action: string; label: string; options: { label: string; value: string | number }[]; initial: string | number }
  | { kind: 'toggle'; action: string; label: string; initial: boolean };

/** D · Command: config as map, one line inverted */
export interface CommandSlide extends SlideBase {
  type: 'command';
  header: [string, string];
  /** command lines. Leading spaces are preserved (rendered as &nbsp;). */
  lines: string[];
  /** index into `lines` of the inverted (active) line */
  active: number;
  title: string;
  body: string;
}

/** Plain text slide for quick drafting: header, title, bullet list. */
export interface ListSlide extends SlideBase {
  type: 'list';
  header: [string, string];
  title: string;
  items: string[];
}

export type Slide = TitleSlide | SectionSlide | SceneSlide | CommandSlide | ListSlide;

/** Props every layout receives. `active` is true when the slide is on screen. */
export interface SlideProps<S extends Slide> {
  slide: S;
  active: boolean;
  /** global pixel-render options from the presenter panel */
  pixelOpts: PixelOpts;
  /** register a handler for ← / → while this slide is active. Return true if consumed. */
  onStepKey?: (register: ((dir: 1 | -1) => boolean) | null) => void;
  /** rendering as a small overview thumbnail: no WebGL, no interaction (scenes show the hatch placeholder) */
  thumb?: boolean;
}
