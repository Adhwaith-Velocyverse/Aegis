import { query } from '../src/db/connection';
(async () => {
  const t: any = await query(
    "SELECT id, tenant_id, azure_client_id, certificate_thumbprint, refresh_token_encrypted IS NOT NULL AS has_refresh FROM tenant_connections LIMIT 5"
  );
  console.log('tenants:');
  console.table(t);
  const u: any = await query("SELECT id, email, organization_id, password_hash IS NOT NULL AS has_hash FROM users LIMIT 5");
  console.log('users:');
  console.table(u);
  process.exit(0);
})();
