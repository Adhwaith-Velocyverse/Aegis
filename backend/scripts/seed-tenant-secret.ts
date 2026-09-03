import 'dotenv/config';
import { query } from '../src/db/connection';
import { encryptTokenForStorage as encryptToken } from '../src/services/msalAuth';

async function main() {
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  const azureTenantId = process.env.AZURE_TENANT_ID;
  if (!clientId || !clientSecret || !azureTenantId) {
    console.error('Missing AZURE_CLIENT_ID / AZURE_CLIENT_SECRET / AZURE_TENANT_ID in backend/.env');
    process.exit(1);
  }

  const encrypted = encryptToken(clientSecret);
  const rows: any = await query('SELECT id FROM tenant_connections LIMIT 1');
  if (rows.length === 0) {
    console.error('No tenant_connections row found.');
    process.exit(1);
  }
  const conn = rows[0];
  await query(
    `UPDATE tenant_connections
       SET azure_tenant_id = ?, azure_client_id = ?, azure_client_secret_encrypted = ?, connection_status = 'pending'
       WHERE id = ?`,
    [azureTenantId, clientId, encrypted, conn.id]
  );
  console.log('Updated tenant connection', conn.id, 'with client_id and encrypted secret.');
  const after: any = await query(
    'SELECT id, tenant_id, azure_client_id, azure_client_secret_encrypted IS NOT NULL as has_secret, connection_status FROM tenant_connections WHERE id = ?',
    [conn.id]
  );
  console.log(JSON.stringify(after[0], null, 2));
  process.exit(0);
}

main().catch((e) => {
  console.error('ERR:', e);
  process.exit(1);
});
