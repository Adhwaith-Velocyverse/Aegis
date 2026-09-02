import { query } from '../src/db/connection';
(async () => {
  const r: any = await query(
    "SELECT id, control_name, severity FROM control_catalog WHERE module_name='Email' AND id IN ('email-conn-05','email-cm-01','email-ap-01')"
  );
  console.table(r);
  process.exit(0);
})();
