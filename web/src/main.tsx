import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { mockClubApi } from './api/mock';
import { App } from './App';
import { cognitoAuthClient } from './auth/cognito';
import { demoAuthClient } from './auth/demo';
import { webConfig } from './config';
import { globalCss } from './theme/css';

const style = document.createElement('style');
style.textContent = globalCss();
document.head.append(style);

const auth = webConfig.webClientId
  ? cognitoAuthClient({ region: webConfig.region, clientId: webConfig.webClientId })
  : demoAuthClient();

// The club API arrives after #17; until then every page reads sample data.
const api = mockClubApi();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App auth={auth} api={api} />
  </StrictMode>,
);
