import mysql from 'mysql2/promise';
import { EMAIL_SECURITY_CONTROLS } from '../src/services/emailSecurityControlDefinitions';

async function main() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Adhwaith@2004',
    database: 'aegis_np'
  });

  console.log('Updating control_catalog with new email controls...');

  for (const control of EMAIL_SECURITY_CONTROLS) {
    const areaLower = control.area.toLowerCase();
    const severity = (areaLower.includes('phish') || areaLower.includes('malware') || areaLower.includes('safe') || areaLower.includes('smtp') || areaLower.includes('pop') || areaLower.includes('rbac') || areaLower.includes('rba') || areaLower.includes('connector'))
      ? 'high'
      : areaLower.includes('spam') || areaLower.includes('transport')
      ? 'medium'
      : control.controlType === 'informational' ? 'informational' : 'low';
    const weight = control.controlType === 'informational' ? 0 : (severity === 'high' ? 2 : severity === 'medium' ? 1.5 : 1);

    const commandsUsed = control.id.startsWith('email-rbac') || control.id.startsWith('email-cm-09') || control.id.startsWith('email-cm-10') || control.id.startsWith('email-cm-11') || control.id.startsWith('email-cm-12')
      ? JSON.stringify({ graph: true, exo: true })
      : control.id.startsWith('email-cm')
      ? JSON.stringify({ exo: true })
      : JSON.stringify({ exo: true });

    await connection.execute(
      `INSERT INTO control_catalog (id, control_name, module_name, area, control_type, scope, validation_rule, severity, weight, automatable, description, commands_used, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         control_name = VALUES(control_name),
         module_name = VALUES(module_name),
         area = VALUES(area),
         control_type = VALUES(control_type),
         scope = VALUES(scope),
         validation_rule = VALUES(validation_rule),
         severity = VALUES(severity),
         weight = VALUES(weight),
         automatable = VALUES(automatable),
         description = VALUES(description),
         commands_used = VALUES(commands_used),
         is_active = VALUES(is_active)`,
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
        commandsUsed,
        1,
      ]
    );
    console.log(`  ${control.id}: ${control.title}`);
  }

  const [rows] = await connection.execute('SELECT COUNT(*) as count FROM control_catalog WHERE module_name = ?', ['Email']);
  console.log('Total Email controls in DB:', rows[0]);

  await connection.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
