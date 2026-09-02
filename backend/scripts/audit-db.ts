import mysql from 'mysql2/promise';
(async () => {
  const c = await mysql.createConnection({ host: 'localhost', user: 'root', password: 'Adhwaith@2004', database: 'aegis_np' });
  const [tables]: any = await c.execute(
    "SELECT TABLE_NAME, TABLE_ROWS FROM information_schema.tables WHERE TABLE_SCHEMA='aegis_np' AND TABLE_ROWS IS NOT NULL ORDER BY TABLE_ROWS DESC"
  );
  console.log('Tables with rows:');
  console.table(tables);
  const [fks]: any = await c.execute(
    "SELECT TABLE_NAME, CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA='aegis_np' AND REFERENCED_TABLE_NAME IS NOT NULL"
  );
  console.log('Foreign keys:');
  console.table(fks);
  const [engines]: any = await c.execute(
    "SELECT TABLE_NAME, ENGINE FROM information_schema.tables WHERE TABLE_SCHEMA='aegis_np'"
  );
  const nonInnodb = engines.filter((e: any) => e.ENGINE && e.ENGINE !== 'InnoDB');
  console.log('Non-InnoDB tables (should be 0):', nonInnodb.length);
  await c.end();
})().catch((e) => { console.error(e.message); process.exit(1); });
