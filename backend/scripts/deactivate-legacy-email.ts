import mysql from 'mysql2/promise';
import { EMAIL_SECURITY_CONTROLS } from '../src/services/emailSecurityControlDefinitions';

async function main() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Adhwaith@2004',
    database: 'aegis_np'
  });

  const newIds = EMAIL_SECURITY_CONTROLS.map(c => c.id);
  const placeholders = newIds.map(() => '?').join(',');
  const [result] = await connection.execute(
    `UPDATE control_catalog SET is_active = 0 WHERE module_name = 'Email' AND id NOT IN (${placeholders})`,
    newIds
  );
  console.log(`Deactivated ${(result as any).affectedRows} legacy email controls`);

  const [rows] = await connection.execute(
    'SELECT COUNT(*) as count FROM control_catalog WHERE module_name = ? AND is_active = 1',
    ['Email']
  );
  console.log('Active Email controls in DB:', rows[0]);

  await connection.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
