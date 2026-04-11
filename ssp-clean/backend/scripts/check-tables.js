const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'smartsignage'
});

pool.query(`
  SELECT table_name 
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE' 
  ORDER BY table_name
`).then(result => {
  console.log('Tabelas criadas:');
  result.rows.forEach(row => console.log(' - ' + row.table_name));
  pool.end();
}).catch(err => {
  console.error('Erro:', err.message);
  pool.end();
});

