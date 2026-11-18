// After `vite build`: serve the same app at /1/, /2/ and /3/ (main.tsx picks the deck from the path).
import { copyFileSync, mkdirSync } from 'node:fs';
for (const d of ['1', '2', '3']) {
  mkdirSync(`dist/${d}`, { recursive: true });
  copyFileSync('dist/index.html', `dist/${d}/index.html`);
}
console.log('deck subpaths: /1/ /2/ /3/');
