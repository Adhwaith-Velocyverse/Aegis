const mysql = require('mysql2/promise');

async function main() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Adhwaith@2004',
    database: 'aegis_np'
  });

  await connection.execute('ALTER TABLE assessment_modules MODIFY COLUMN raw_data_path MEDIUMTEXT');
  console.log('Altered raw_data_path to MEDIUMTEXT');

  const [columns] = await connection.execute(
    "SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'aegis_np' AND TABLE_NAME = 'assessment_modules' AND COLUMN_NAME = 'raw_data_path'"
  );
  console.log('Updated column:', JSON.stringify(columns, null, 2));

  await connection.end();
}

main().catch((err) => console.error(err));
