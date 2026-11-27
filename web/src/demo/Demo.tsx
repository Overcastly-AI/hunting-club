import { useState } from 'react';
import { App } from '../App';
import { demoServices, isDemoScenario } from './demoServices';

/** Dev-only: the admin over sample data (see demoServices.ts). Unknown scenarios get "trial". */
export function Demo(props: { scenario: string | null }) {
  const [services] = useState(() =>
    demoServices(isDemoScenario(props.scenario) ? props.scenario : 'trial'),
  );
  return <App {...services} />;
}
