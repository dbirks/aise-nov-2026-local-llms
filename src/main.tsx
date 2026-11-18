import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './tokens.css';
import { Deck } from './deck/Deck';
import { slides as v3 } from './decks/v3';
import { slides as v2 } from './decks/v2';
import { routeSlides as v1 } from './decks/route-v1';
import { setLabelScale } from './scenes/pixel-viz';

// Which deck: /1/ → v1 (archived), /2/ → v2 (archived), / or /3/ → v3 (current).
// ?deck=v1 / ?deck=v2 still work at the root.
const base = import.meta.env.BASE_URL;
const sub = location.pathname.startsWith(base) ? location.pathname.slice(base.length).split('/')[0] : '';
const pick = sub || (new URLSearchParams(location.search).get('deck') ?? '').replace(/^v/, '');
const deck = pick === '1' ? v1() : pick === '2' ? v2 : v3;
// v3: 3D annotation text at two-thirds size (speaker review 2026-11-18)
if (deck === v3) setLabelScale(2 / 3);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Deck slides={deck} />
  </StrictMode>,
);
