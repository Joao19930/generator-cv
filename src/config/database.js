// src/config/database.js — PostgreSQL via pg
const { Pool } = require('pg');

// Retirar ?sslmode=... da URL para evitar conflito com a opção ssl do Pool.
// O pg v8.x emite um aviso de segurança quando a URL tem sslmode e o Pool
// também tem ssl configurado — deixamos apenas a opção ssl ser a fonte de verdade.
const rawUrl = process.env.DATABASE_URL || '';
const connectionString = rawUrl
  .replace(/([?&])sslmode=[^&]*/g, '$1')  // remover sslmode=...
  .replace(/[?&]$/, '');                   // limpar ? ou & no fim

const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => console.error('❌ PostgreSQL pool error:', err.message));

// Normalizes pg result rows: adds PascalCase aliases for snake_case columns
// So result.rows[0].id also gives result.rows[0].Id (for MSSQL compatibility)
function normalize(rows) {
  return rows.map(row => {
    const out = {};
    for (const [k, v] of Object.entries(row)) {
      out[k] = v;
      // snake_case → PascalCase: user_id → UserId, created_at → CreatedAt
      const pascal = k
        .replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())
        .replace(/^[a-z]/, c => c.toUpperCase());
      if (pascal !== k) out[pascal] = v;
    }
    return out;
  });
}

// Mimics mssql's request API so existing route code works unchanged
class Request {
  constructor() {
    this._inputs = {};
    this._order  = [];
  }

  input(name, typeOrValue, value) {
    const val = value !== undefined ? value : typeOrValue;
    if (!this._order.includes(name)) this._order.push(name);
    this._inputs[name] = val;
    return this;
  }

  async query(sqlStr) {
    // Convert MSSQL syntax → PostgreSQL
    let pgSql = sqlStr
      .replace(/\bGETDATE\s*\(\s*\)/gi, 'NOW()')
      .replace(/\bISNULL\s*\(/gi, 'COALESCE(')
      .replace(/\[(\w+)\]/g, '$1')
      .replace(/\bOUTPUT\s+/gi, 'RETURNING ')
      .replace(/\bINSERTED\./gi, '');

    // Replace @param → $N (same param reuses same $N)
    const params = [];
    const seen = {};
    let i = 1;
    pgSql = pgSql.replace(/@(\w+)/g, (_, name) => {
      if (!(name in seen)) {
        seen[name] = i++;
        params.push(Object.prototype.hasOwnProperty.call(this._inputs, name)
          ? this._inputs[name] : null);
      }
      return `$${seen[name]}`;
    });

    const result = await pool.query(pgSql, params);
    return { recordset: normalize(result.rows), rowsAffected: [result.rowCount] };
  }
}

const dbWrapper = { request: () => new Request() };

const getPool = async () => {
  await pool.query('SELECT 1');
  return dbWrapper;
};

module.exports = {
  getPool,
  sql: { Int: 'Int', NVarChar: 'NVarChar', VarChar: 'VarChar',
         Decimal: 'Decimal', DateTime: 'DateTime', Date: 'Date', Bit: 'Bit' },
  pool,
};
