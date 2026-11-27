import { LEGAL_DOCS } from '@huntclub/shared';
import type { ReactNode } from 'react';
import { Clubs } from './pages/Clubs';
import { Contact } from './pages/Contact';
import { Download } from './pages/Download';
import { Faq } from './pages/Faq';
import { Features } from './pages/Features';
import { Home } from './pages/Home';
import { Legal } from './pages/Legal';
import { Pricing } from './pages/Pricing';
import { PAGE_PATHS, type SitePath } from './routes';
import type { PageAssets } from './Shell';

/** The content of each registered page (the registry holds its title and description). */
export const PAGE_CONTENT: Record<SitePath, (assets: PageAssets) => ReactNode> = {
  [PAGE_PATHS.home]: (assets) => <Home aerialUrl={assets.aerialUrl} />,
  [PAGE_PATHS.features]: () => <Features />,
  [PAGE_PATHS.faq]: () => <Faq />,
  [PAGE_PATHS.clubs]: () => <Clubs />,
  [PAGE_PATHS.pricing]: () => <Pricing />,
  [PAGE_PATHS.download]: () => <Download />,
  [PAGE_PATHS.contact]: () => <Contact />,
  [PAGE_PATHS.privacy]: () => <Legal doc={LEGAL_DOCS.privacy} />,
  [PAGE_PATHS.terms]: () => <Legal doc={LEGAL_DOCS.terms} />,
};
