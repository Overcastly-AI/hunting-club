import type { ReactNode } from 'react';
import { Home } from './pages/Home';
import type { SitePath } from './routes';

/** The content of each registered page (the registry holds its title and description). */
export const PAGE_CONTENT: Record<SitePath, () => ReactNode> = {
  '/': () => <Home />,
};
