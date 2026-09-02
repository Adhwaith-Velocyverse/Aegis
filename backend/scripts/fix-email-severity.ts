import mysql from 'mysql2/promise';

(async () => {
  const c = await mysql.createConnection({ host: 'localhost', user: 'root', password: 'Adhwaith@2004', database: 'aegis_np' });

  const [r1]: any = await c.execute(
    "UPDATE control_catalog SET severity = 'low' WHERE module_name = 'Email' AND severity = 'informational'"
  );
  console.log(`Updated ${r1.affectedRows} email controls from 'informational' to 'low'`);

  const [r2]: any = await c.execute(
    "UPDATE control_catalog SET is_active = 0 WHERE id = 'email-cm-16'"
  );
  console.log(`Deactivated email-cm-16 (removed control def): ${r2.affectedRows}`);

  const [r3]: any = await c.execute(
    "SELECT severity, COUNT(*) c FROM control_catalog WHERE module_name='Email' GROUP BY severity"
  );
  console.log('Email severity distribution after fix:');
  console.table(r3);

  const [r4]: any = await c.execute(
    "SELECT id, is_active FROM control_catalog WHERE id = 'email-cm-16'"
  );
  console.log('email-cm-16 status:', r4[0]);

  await c.end();
})();
