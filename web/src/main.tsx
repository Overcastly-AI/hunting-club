import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Root } from './Root';
import { createWebClubServices } from './cloud';
import { globalCss } from './theme/css';

const style = document.createElement('style');
style.textContent = globalCss();
document.head.append(style);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root {...createWebClubServices()} location={window.location} />
  </StrictMode>,
);
