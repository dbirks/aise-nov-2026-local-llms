import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './tokens.css';
import { Deck } from './deck/Deck';
import { routeSlides } from './slides';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Deck slides={routeSlides()} />
  </StrictMode>,
);
