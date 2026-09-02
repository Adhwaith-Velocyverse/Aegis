import mysql from 'mysql2/promise';

async function main() {
  const c = await mysql.createConnection({ host: 'localhost', user: 'root', password: 'Adhwaith@2004', database: 'aegis_np' });
  const [r] = await c.execute('SHOW COLUMNS FROM control_catalog');
  console.log(JSON.stringify(r, null, 2));
  await c.end();
}
main().catch((e) => console.error(e));
