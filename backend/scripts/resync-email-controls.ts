import mysql from 'mysql2/promise';
import { EMAIL_SECURITY_CONTROLS } from '../src/services/emailSecurityControlDefinitions';

async function main() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Adhwaith@2004',
    database: 'aegis_np'
  });

  console.log('Step 1: Renaming legacy control_name to free unique key...');
  await connection.execute(
    "UPDATE control_catalog SET control_name = CONCAT('LEGACY_', control_name) WHERE module_name = 'Email' AND id NOT LIKE 'email-%'"
  );

  console.log('Step 2: Inserting all 77 new email controls...');
  let success = 0;
  for (const control of EMAIL_SECURITY_CONTROLS) {
    const areaLower = control.area.toLowerCase();
    const severity = (areaLower.includes('phish') || areaLower.includes('malware') || areaLower.includes('safe') || areaLower.includes('smtp') || areaLower.includes('pop') || areaLower.includes('rbac') || areaLower.includes('connector'))
      ? 'high'
      : areaLower.includes('spam') || areaLower.includes('transport')
      ? 'medium'
      : control.controlType === 'informational' ? 'informational' : 'low';
    const weight = control.controlType === 'informational' ? 0 : (severity === 'high' ? 2 : severity === 'medium' ? 1.5 : 1);

    try {
      await connection.execute(
        `INSERT INTO control_catalog (id, control_name, module_name, area, control_type, scope, validation_rule, severity, weight, automatable, description, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE
           area = VALUES(area),
           control_type = VALUES(control_type),
           scope = VALUES(scope),
           validation_rule = VALUES(validation_rule),
           severity = VALUES(severity),
           weight = VALUES(weight),
           automatable = VALUES(automatable),
           description = VALUES(description),
           is_active = 1`,
        [
          control.id,
          control.title,
          'Email',
          control.area,
          control.controlType,
          control.scope,
          control.validationRule,
          severity,
          weight,
          1,
          control.validationRule,
        ]
      );
      success++;
    } catch (err: any) {
      console.log(`  Failed: ${control.id}: ${err.message.substring(0, 100)}`);
    }
  }
  console.log(`Inserted: ${success}/${EMAIL_SECURITY_CONTROLS.length}`);

  console.log('Step 3: Remapping findings from legacy controls to new IDs (fuzzy match)...');
  const [legacyRows] = await connection.execute(
    "SELECT id, control_name FROM control_catalog WHERE module_name = 'Email' AND control_name LIKE 'LEGACY_%'"
  );
  let updatedFindings = 0;
  let orphans = 0;
  for (const legacy of legacyRows as any[]) {
    const cleanName = legacy.control_name.replace(/^LEGACY_/, '').toLowerCase().replace(/[^a-z0-9]/g, '');
    let match = EMAIL_SECURITY_CONTROLS.find(c => c.title === legacy.control_name.replace(/^LEGACY_/, ''));
    if (!match) {
      match = EMAIL_SECURITY_CONTROLS.find(c => c.title.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanName);
    }
    if (match) {
      const [r] = await connection.execute(
        'UPDATE findings SET control_catalog_id = ? WHERE control_catalog_id = ?',
        [match.id, legacy.id]
      );
      const affected = (r as any).affectedRows;
      if (affected > 0) {
        updatedFindings += affected;
      }
      await connection.execute('DELETE FROM control_catalog WHERE id = ?', [legacy.id]);
    } else {
      orphans++;
    }
  }
  console.log(`Total findings remapped: ${updatedFindings}`);
  console.log(`Orphan legacy controls (no exact match): ${orphans}`);

  const [active] = await connection.execute(
    "SELECT COUNT(*) as count FROM control_catalog WHERE module_name = 'Email' AND is_active = 1"
  );
  console.log('Active Email controls in DB:', active[0]);

  const [byType] = await connection.execute(
    "SELECT control_type, COUNT(*) as count FROM control_catalog WHERE module_name = 'Email' AND is_active = 1 GROUP BY control_type"
  );
  console.log('By type:', byType);

  await connection.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
