import mysql from 'mysql2/promise';
async function main() {
  const c = await mysql.createConnection({ host: 'localhost', user: 'root', password: 'Adhwaith@2004', database: 'aegis_np' });
  const [r] = await c.execute("SELECT COUNT(*) as c FROM control_catalog WHERE module_name = 'Email' AND id LIKE 'email-%'");
  console.log('New email-* controls in DB:', r[0]);
  const [s] = await c.execute("SELECT COUNT(*) as c FROM control_catalog WHERE module_name = 'Email' AND is_active = 1");
  console.log('Active Email controls:', s[0]);
  await c.end();
}
main();
