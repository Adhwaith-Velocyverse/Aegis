import { query } from '../src/db/connection';
(async () => {
  const m: any = await query(
    "SELECT id, assessment_id, module_name, collection_status FROM assessment_modules WHERE assessment_id = ?",
    ['ea83e66d-d5f5-446f-b669-3c97f3a41058']
  );
  console.log('Modules for failed assessment:');
  console.table(m);
  const f: any = await query(
    "SELECT id, result, severity FROM findings WHERE assessment_module_id IN (SELECT id FROM assessment_modules WHERE assessment_id = ?) LIMIT 10",
    ['ea83e66d-d5f5-446f-b669-3c97f3a41058']
  );
  console.log('Findings (first 10):');
  console.table(f);
  process.exit(0);
})();
