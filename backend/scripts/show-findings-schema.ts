import { query } from '../src/db/connection';
(async () => {
  const c: any = await query('SHOW CREATE TABLE findings');
  console.log(c[0]['Create Table']);
  process.exit(0);
})();
