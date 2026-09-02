import { query } from '../src/db/connection';
(async () => {
  const rows: any = await query(
    "SELECT id, control_name, severity FROM control_catalog WHERE module_name='Email' GROUP BY severity, id, control_name ORDER BY severity, control_name"
  );
  console.log(`Email controls: ${rows.length}`);
  const bySev: Record<string, number> = {};
  for (const r of rows) bySev[r.severity] = (bySev[r.severity] || 0) + 1;
  console.log('By severity:', bySev);
  const odd = rows.filter((r: any) => !['critical', 'high', 'medium', 'low'].includes(r.severity));
  if (odd.length) {
    console.log('Controls with non-enum severity:');
    console.table(odd);
  }
  process.exit(0);
})();
