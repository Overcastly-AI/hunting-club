// `npm run smoke -- <env>` (default dev): read-only checks of a deployed environment.
import { getEnvConfig } from '../config';
import { formatSmoke, runSmoke } from '../src/smoke';

async function main() {
  const config = getEnvConfig(process.argv[2]);
  const results = await runSmoke(config, (url, init) =>
    fetch(url, { redirect: 'manual', ...init }),
  );
  console.log(formatSmoke(config.name, results));
  process.exit(results.every((r) => r.ok) ? 0 : 1);
}

void main();
