// src/middleware/auth.js
// ─────────────────────────────────────────────────────────────
// JWT Auth + Role checks
// ─────────────────────────────────────────────────────────────
const jwt = require('jsonwebtoken');

const auth = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Acesso negado' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token inválido' });
  }
};

const adminOnly = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Acesso negado' });
  next();
};

const premiumOnly = async (req, res, next) => {
  if (req.user.plan === 'premium') return next();
  // Verificar access_until e cover_credits na BD
  try {
    const { sql } = require('../config/database');
    const r = await req.db.request().input('id', sql.Int, req.user.id)
      .query('SELECT cover_credits, access_until FROM users WHERE id=@id');
    const u = r.recordset[0];
    const coverCredits = u?.CoverCredits ?? u?.cover_credits ?? 0;
    const accessUntil  = u?.AccessUntil  || u?.access_until  || null;
    if (coverCredits > 0) return next();
    if (accessUntil && new Date(accessUntil) > new Date()) return next();
  } catch(_) {}
  return res.status(403).json({ error: 'Pagamento necessário. Acede ao painel para activar.' });
};

module.exports = { auth, adminOnly, premiumOnly };