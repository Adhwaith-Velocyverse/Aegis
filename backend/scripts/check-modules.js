const mysql = require('mysql2/promise');

async function main() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Adhwaith@2004',
    database: 'aegis_np'
  });

  const [columns] = await connection.execute(
    "SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'aegis_np' AND TABLE_NAME = 'assessment_modules'"
  );
  console.log('assessment_modules columns:', JSON.stringify(columns, null, 2));

  const [modules] = await connection.execute(
    'SELECT id, module_name, collection_status, CHAR_LENGTH(raw_data_path) as data_length FROM assessment_modules WHERE assessment_id = ?',
    ['21caeb05-463f-43fb-867c-49d80c580a4e']
  );
  console.log('modules:', JSON.stringify(modules, null, 2));

  await connection.end();
}

main().catch((err) => console.error(err));
