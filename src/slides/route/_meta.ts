// Scene metadata (handoff §2 "Every implemented scene gets metadata"), stored in the slide's `notes`
// so the presenter panel (P) shows it. Evidence labels from handoff §0 "Research ledger".
export type Evidence = 'MECHANISM' | 'MEASURED ON SPEAKER SYSTEM' | 'SPEAKER OBSERVATION' | 'MANUFACTURER SPEC'
  | 'HYPOTHESIS / OPINION' | 'SYNTHETIC DEMO' | 'OPEN / VERSION-DEPENDENT';

export interface SceneMeta {
  /** handoff scene ID, e.g. 'C03' */
  id: string;
  claim: string;
  evidence: Evidence[];
  /** primary sources first */
  sources: string[];
  /** what the visual must NOT imply */
  not: string;
  /** what is toy / simulated in the drawing */
  simulated?: string;
  /** builder this slide reuses, if it reuses an older scene */
  reuses?: string;
  /** open questions for the speaker (handoff §7) */
  open?: string;
}

export const meta = (m: SceneMeta): string => [
  `${m.id} · claim: ${m.claim}`,
  `evidence: ${m.evidence.join(', ')}`,
  m.simulated && `simulated: ${m.simulated}`,
  `must not imply: ${m.not}`,
  m.open && `open: ${m.open}`,
  m.reuses && `reuses: ${m.reuses}`,
  `sources: ${m.sources.join(' · ')}`,
].filter(Boolean).join('\n');
