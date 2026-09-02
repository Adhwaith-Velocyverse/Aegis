import mysql from 'mysql2/promise';

async function main() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Adhwaith@2004',
    database: 'aegis_np'
  });

  console.log('Detaching findings from legacy controls (set to NULL)...');
  const [legacyRows] = await connection.execute(
    "SELECT id FROM control_catalog WHERE module_name = 'Email' AND id NOT LIKE 'email-%'"
  );

  let detached = 0;
  for (const legacy of legacyRows as any[]) {
    const [r] = await connection.execute(
      'DELETE FROM findings WHERE control_catalog_id = ?',
      [legacy.id]
    );
    detached += (r as any).affectedRows;
  }
  console.log(`Findings deleted (orphaned): ${detached}`);

  console.log('Deleting legacy control_catalog rows...');
  const [del] = await connection.execute(
    "DELETE FROM control_catalog WHERE module_name = 'Email' AND id NOT LIKE 'email-%'"
  );
  console.log(`Legacy controls deleted: ${(del as any).affectedRows}`);

  const [active] = await connection.execute(
    "SELECT COUNT(*) as count FROM control_catalog WHERE module_name = 'Email' AND is_active = 1"
  );
  console.log('Active Email controls in DB:', active[0]);

  await connection.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
