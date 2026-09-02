import { getExchangeOnlineService } from '../src/services/exchangeOnlineService';

const TENANT_CONNECTION_ID = '5971f01b-7942-4993-b6bb-58b68c0ddcf8';

(async () => {
  const svc = await getExchangeOnlineService(TENANT_CONNECTION_ID);
  if (!svc) { console.error('No service'); process.exit(1); }
  await svc.connect();

  const valid: string[] = ['Fqdn', 'Hostname', 'GeoLocation', 'UrlPair', 'SenderPair', 'FileHashPair'];
  for (const v of valid) {
    const t0 = Date.now();
    try {
      const r = await (svc as any).executeCommand('Get-TenantAllowBlockListItems', { ListType: v });
      console.log(`ListType=${v}: ${r.length} items in ${Date.now() - t0}ms (OK)`);
    } catch (e: any) {
      console.log(`ListType=${v}: FAILED ${e.message.substring(0, 100)}`);
    }
  }

  await svc.disconnect();
  process.exit(0);
})();
