// src/utils/migrate.js
// Executar: npm run migrate
// Cria todas as tabelas no PostgreSQL (Neon, Railway, Supabase, etc.)
require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL não está definida. Verifica o ficheiro .env ou as variáveis de ambiente.');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 15000,
});

(async () => {
  console.log('🔄 Migrações a iniciar…');
  let client;
  try {
    client = await pool.connect();

    // Correr todos os ficheiros migrations*.sql em ordem alfabética
    const rootDir  = path.join(__dirname, '..', '..');
    const sqlFiles = fs.readdirSync(rootDir)
      .filter(f => f.match(/^migrations.*\.sql$/i))
      .sort();

    const script = sqlFiles
      .map(f => fs.readFileSync(path.join(rootDir, f), 'utf8'))
      .join('\n');

    // Remover comentários de linha e dividir por ; (PostgreSQL não usa GO)
    const statements = script
      .replace(/--[^\n]*/g, '')          // remover comentários --
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    let ok = 0, warn = 0;
    for (const stmt of statements) {
      try {
        await client.query(stmt);
        ok++;
      } catch (err) {
        // Ignorar erros de "já existe" — são normais em re-execuções
        if (
          err.message.includes('already exists') ||
          err.message.includes('duplicate') ||
          err.code === '42701' || // column already exists
          err.code === '42P07'    // table already exists
        ) {
          warn++;
        } else {
          console.warn(`  ⚠️  ${err.message.split('\n')[0]}`);
          warn++;
        }
      }
    }

    console.log(`✅ Migrações concluídas! ${ok} statements executados, ${warn} avisos ignorados.`);
  } catch (err) {
    console.error('❌ Erro nas migrações:', err.message);
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end();
    process.exit(0);
  }
})();
