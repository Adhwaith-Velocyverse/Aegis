import mysql from 'mysql2/promise';
(async () => {
  const c = await mysql.createConnection({ host:'localhost', user:'root', password:'Adhwaith@2004', database:'aegis_np' });
  const [perMod]: any = await c.execute("SELECT module_name, COUNT(*) AS cnt, SUM(is_active=1) AS active FROM control_catalog GROUP BY module_name ORDER BY module_name");
  console.log('Per module totals:'); console.table(perMod);
  const [emailLegacy]: any = await c.execute("SELECT id, control_name, is_active FROM control_catalog WHERE module_name='Email' AND id NOT LIKE 'email-%' ORDER BY id LIMIT 30");
  console.log('Legacy Email controls (id NOT LIKE email-%) - sample up to 30:');
  console.table(emailLegacy);
  const [emailLegacyCount]: any = await c.execute("SELECT COUNT(*) AS cnt FROM control_catalog WHERE module_name='Email' AND id NOT LIKE 'email-%'");
  console.log('Legacy Email count:', emailLegacyCount[0]);
  const [inactiveEmail]: any = await c.execute("SELECT COUNT(*) AS cnt FROM control_catalog WHERE module_name='Email' AND is_active=0");
  console.log('Inactive Email count:', inactiveEmail[0]);
  const [fkFindings]: any = await c.execute("SELECT COUNT(*) AS cnt FROM findings f LEFT JOIN control_catalog cc ON cc.id=f.control_catalog_id WHERE cc.id IS NULL");
  console.log('Orphan findings (no matching control_catalog row):', fkFindings[0]);
  await c.end();
})().catch(e => { console.error(e); process.exit(1); });
