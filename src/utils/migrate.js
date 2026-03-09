// src/utils/migrate.js
// Executar: npm run migrate
require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const sql  = require('mssql');

const config = {
  server:   process.env.DB_SERVER,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options:  { encrypt: false, trustServerCertificate: true },
  connectionTimeout: 15000
};

(async () => {
  console.log('🔄 Migrações a iniciar…');
  let pool;
  try {
    pool = await sql.connect(config);
    const sqlFile = path.join(__dirname, '..', '..', 'migrations.sql');
    const script  = fs.readFileSync(sqlFile, 'utf8');

    // Dividir por GO e executar cada bloco
    const blocks = script.split(/^\s*GO\s*$/im).map(b => b.trim()).filter(Boolean);
    for (const block of blocks) {
      await pool.request().query(block).catch(err => {
        if (!err.message.includes('already exists') && !err.message.includes('já existe')) {
          console.warn('  ⚠️ ', err.message.split('\n')[0]);
        }
      });
    }
    console.log('✅ Migrações concluídas com sucesso!');
  } catch (err) {
    console.error('❌ Erro nas migrações:', err.message);
    process.exit(1);
  } finally {
    if (pool) await pool.close();
    process.exit(0);
  }
})();
