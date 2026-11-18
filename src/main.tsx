import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './tokens.css';
import { Deck } from './deck/Deck';
import { slides } from './slides';
import { routeSlides as v1 } from './decks/route-v1';

// ?deck=v1 opens the archived first build (and its ?route=20); otherwise the new deck.
const deck = new URLSearchParams(location.search).get('deck');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Deck slides={deck === 'v1' ? v1() : slides} />
  </StrictMode>,
);
