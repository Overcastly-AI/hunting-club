import { LEGAL_DOCS } from '@huntclub/shared';
import type { ReactNode } from 'react';
import { Clubs } from './pages/Clubs';
import { Contact } from './pages/Contact';
import { Download } from './pages/Download';
import { Home } from './pages/Home';
import { Legal } from './pages/Legal';
import { Pricing } from './pages/Pricing';
import { PAGE_PATHS, type SitePath } from './routes';

/** The content of each registered page (the registry holds its title and description). */
export const PAGE_CONTENT: Record<SitePath, () => ReactNode> = {
  [PAGE_PATHS.home]: () => <Home />,
  [PAGE_PATHS.clubs]: () => <Clubs />,
  [PAGE_PATHS.pricing]: () => <Pricing />,
  [PAGE_PATHS.download]: () => <Download />,
  [PAGE_PATHS.contact]: () => <Contact />,
  [PAGE_PATHS.privacy]: () => <Legal doc={LEGAL_DOCS.privacy} />,
  [PAGE_PATHS.terms]: () => <Legal doc={LEGAL_DOCS.terms} />,
};
