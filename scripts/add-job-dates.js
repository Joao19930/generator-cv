const { Pool } = require('pg');

const pool = new Pool({
  connectionString: 'postgresql://cv_generator_db_ewox_user:htNyxZjlpLWv1XGIfjVUPMP89uXxvuvS@dpg-d6nlil9aae7s738g4g40-a.frankfurt-postgres.render.com/cv_generator_db_ewox',
  ssl: { rejectUnauthorized: false }
});

async function migrate() {
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS start_date DATE`);
  await pool.query(`ALTER TABLE jobs ADD COLUMN IF NOT EXISTS end_date DATE`);
  console.log('✅ Colunas start_date e end_date adicionadas à tabela jobs.');
  pool.end();
}

migrate().catch(e => { console.error(e.message); pool.end(); });
