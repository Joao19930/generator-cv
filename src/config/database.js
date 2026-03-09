const sql = require('mssql');
const config = {
  server:   process.env.DB_SERVER,
  database: process.env.DB_NAME,
  user:     process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt:                false,
    trustServerCertificate: true,
    enableArithAbort:       true,
    trustedConnection:      false
  },
  pool: {
    max:             20,
    min:             2,
    idleTimeoutMillis: 30000
  },
  requestTimeout:    30000,
  connectionTimeout: 15000
};
let pool = null;
const getPool = async () => {
  if (pool) return pool;
  pool = await sql.connect(config);
  console.log('✅  MSSQL ligado -', process.env.DB_NAME);
  return pool;
};
const query = async (queryStr, inputs = {}) => {
  const p = await getPool();
  const req = p.request();
  for (const [key, { type, value }] of Object.entries(inputs)) {
    req.input(key, type, value);
  }
  return req.query(queryStr);
};
module.exports = { getPool, query, sql };
