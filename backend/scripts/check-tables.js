const mysql = require('mysql2/promise');

async function main() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Adhwaith@2004',
    database: 'aegis_np'
  });

  const [tables] = await connection.execute("SHOW TABLES LIKE '%informational%'");
  console.log('Tables matching informational:', JSON.stringify(tables, null, 2));

  const [columns] = await connection.execute('SHOW COLUMNS FROM findings');
  console.log('Findings columns:', JSON.stringify(columns.map(c => c.Field), null, 2));

  await connection.end();
}

main().catch((err) => console.error(err));
