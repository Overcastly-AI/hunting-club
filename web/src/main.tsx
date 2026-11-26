import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Root } from './Root';
import { createWebClubServices } from './cloud';

// A build links the stylesheet from index.html (global-stylesheet.ts); `vite dev` has no
// built file, so it injects the same stylesheet here.
if (import.meta.env.DEV) {
  void import('./theme/css').then(({ globalCss }) => {
    const style = document.createElement('style');
    style.textContent = globalCss();
    document.head.append(style);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root {...createWebClubServices()} location={window.location} />
  </StrictMode>,
);
