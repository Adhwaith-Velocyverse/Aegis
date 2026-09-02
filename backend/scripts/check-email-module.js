const mysql = require('mysql2/promise');

async function main() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Adhwaith@2004',
    database: 'aegis_np'
  });

  const [rows] = await connection.execute(
    'SELECT id, raw_data_path FROM assessment_modules WHERE assessment_id = ? AND module_name = ?',
    ['3ba2bb88-6953-46ac-848a-c44e8c0118d0', 'Email']
  );
  console.log(JSON.stringify(rows[0], null, 2));

  await connection.end();
}

main().catch((err) => console.error(err));
