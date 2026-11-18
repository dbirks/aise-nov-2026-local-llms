// Shared contract for the deck. See docs/ARCHITECTURE.md.
// Every slide is plain data; layouts in src/layouts render it at 1920×1080.

export type SceneKind = 'moe' | 'spec' | 'offload' | 'sample' | 'attn' | 'flow'
  // builders in src/scenes/builders/<kind>.js
  | 'kvcache' | 'scheduler' | 'kvledger' | 'prefill'
  // scene lab (brainstorm scenes, src/scenes/builders/<kind>.js)
  | 'roofline' | 'drafter-vram' | 'engram' | 'memtiers' | 'ssd-access' | 'prefix-share' | 'nokv'
  | 'exposure' | 'drafters' | 'quant' | 'dense-moe-ngram' | 'wsl-memory' | 'release-bundle'
  | 'agent-eviction' | 'decode-pass'
  // handoff route scenes (docs/presentation-production-handoff.md), src/scenes/builders/<kind>.js
  | 'agent-loop' | 'weights-fixed' | 'profiles' | 'gpu-choice' | 'moe-store' | 'moe-offload' | 'formats'
  | 'quant-matrix' | 'autoround' | 'prefix-match' | 'drafter-train' | 'engine-map' | 'ngram-timeline' | 'collective'
  // deck v2 builders: any src/scenes/builders/<kind>.js file name
  | (string & {});

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
  /** one of several candidate builds of the same slide; renders a big A/B/C badge top-left */
  variant?: 'A' | 'B' | 'C';
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

/** How a splat asset was made. Rendered as a "SPLAT LAB" tag on the slide so every experiment is labelled. */
export interface SplatMethod {
  /** short id + name, e.g. "A2 · LLM-written Python bake" */
  label: string;
  /** one sentence: how these splats were produced */
  how: string;
  /** compute it needed, e.g. "CPU · 4 s · once" or "browser · every page load" */
  compute: string;
  /** repo path of the generator script, or the external page used */
  source?: string;
}

export interface SplatView {
  target: [number, number, number];
  radius: number;
  theta: number;
  phi: number;
  /** ortho half-height in world units */
  size: number;
}

/** Splat experiment: a Gaussian-splat asset rendered through the same pixel/dither pipeline as the scenes. */
export interface SplatSlide extends SlideBase {
  type: 'splat';
  chip: string;
  caption: { title: string; body: string };
  method: SplatMethod;
  /** a file in public/, path without leading slash, e.g. 'splats/a2/gpu.spz' (.ply .spz .splat .ksplat .sog) */
  src?: string;
  /** or the name of a procedural generator in src/scenes/splat-procs/<name>.ts */
  proc?: string;
  /** camera; default { target:[0,0,0], radius:40, theta:0.6, phi:1.1, size:2.2 } */
  view?: SplatView;
  /** applied to the SplatMesh */
  transform?: { position?: [number, number, number]; quaternion?: [number, number, number, number]; scale?: number };
  /** slow idle turntable, radians per second (default 0 = none) */
  spin?: number;
}

export type Slide = TitleSlide | SectionSlide | SceneSlide | CommandSlide | ListSlide | SplatSlide;

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
