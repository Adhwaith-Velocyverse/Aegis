import { ExchangeOnlineService, getExchangeOnlineService } from '../src/services/exchangeOnlineService';

const TENANT_CONNECTION_ID = '5971f01b-7942-4993-b6bb-58b68c0ddcf8';

(async () => {
  const svc = await getExchangeOnlineService(TENANT_CONNECTION_ID);
  if (!svc) { console.error('No service'); process.exit(1); }

  console.log('Connecting...');
  const t0 = Date.now();
  await svc.connect();
  console.log(`Connected in ${Date.now() - t0}ms`);

  console.log('Running test cmdlet 1: Get-AcceptedDomain');
  const t1 = Date.now();
  try {
    const r1 = await (svc as any).executeCommand('Get-AcceptedDomain', {});
    console.log(`  success in ${Date.now() - t1}ms, items: ${r1.length}`);
  } catch (e: any) {
    console.log(`  FAILED in ${Date.now() - t1}ms: ${e.message.substring(0, 200)}`);
  }

  console.log('Running test cmdlet 2: Get-AntiPhishPolicy');
  const t2 = Date.now();
  try {
    const r2 = await (svc as any).executeCommand('Get-AntiPhishPolicy', {});
    console.log(`  success in ${Date.now() - t2}ms, items: ${r2.length}`);
  } catch (e: any) {
    console.log(`  FAILED in ${Date.now() - t2}ms: ${e.message.substring(0, 200)}`);
  }

  console.log('Running test cmdlet 3: Get-TransportConfig');
  const t3 = Date.now();
  try {
    const r3 = await (svc as any).executeCommand('Get-TransportConfig', {});
    console.log(`  success in ${Date.now() - t3}ms, items: ${r3.length}`);
  } catch (e: any) {
    console.log(`  FAILED in ${Date.now() - t3}ms: ${e.message.substring(0, 200)}`);
  }

  await svc.disconnect();
  process.exit(0);
})();
