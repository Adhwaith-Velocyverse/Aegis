import { EmailSecurityCollector } from '../src/services/emailSecurityCollector';

const TENANT_CONNECTION_ID = '5971f01b-7942-4993-b6bb-58b68c0ddcf8';

(async () => {
  const collector = new EmailSecurityCollector(TENANT_CONNECTION_ID);
  const start = Date.now();
  console.log(`[${new Date().toISOString()}] Starting quick email collection...`);

  let result;
  try {
    result = await collector.collectQuick();
  } catch (err: any) {
    console.error(`Collection failed after ${Date.now() - start}ms: ${err.message}`);
    process.exit(1);
  }

  const elapsed = Date.now() - start;
  console.log(`[${new Date().toISOString()}] Collection finished in ${elapsed}ms (${(elapsed / 1000).toFixed(1)}s)`);
  console.log(`Status: ${result.status}`);
  console.log(`Endpoints: ${result.metrics.totalEndpoints} total, ${result.metrics.successfulEndpoints} success, ${result.metrics.failedEndpoints} failed`);
  console.log(`Errors: ${result.errors.length}`);
  for (const e of result.errors.slice(0, 10)) {
    console.log(`  - ${e.endpoint}: ${e.error.substring(0, 120)}`);
  }
  process.exit(0);
})();
