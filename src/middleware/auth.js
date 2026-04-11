// src/middleware/auth.js
// ─────────────────────────────────────────────────────────────
// JWT Auth + Role checks
// ─────────────────────────────────────────────────────────────
const jwt = require('jsonwebtoken');

const OWNER_EMAIL = 'candidofaustinojoao@gmail.com';

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

// Permite admin, analista e superadmin aceder ao painel
const adminOnly = (req, res, next) => {
  const role = req.user.role;
  if (!['admin', 'superadmin', 'analista'].includes(role))
    return res.status(403).json({ error: 'Acesso negado' });
  next();
};

// Apenas o proprietário (candidofaustinojoao@gmail.com) ou role superadmin
const superadminOnly = (req, res, next) => {
  const { role, email } = req.user;
  if (role !== 'superadmin' && email !== OWNER_EMAIL)
    return res.status(403).json({ error: 'Acesso restrito ao super administrador' });
  next();
};

const premiumOnly = async (req, res, next) => {
  const plan = (req.user.plan || '').toLowerCase();
  if (['premium', 'semanal', 'mensal', 'week', 'month', 'pro', 'enterprise'].includes(plan)) return next();
  // Verificar access_until e cover_credits na BD
  try {
    const { sql } = require('../config/database');
    const r = await req.db.request().input('id', sql.Int, req.user.id)
      .query('SELECT plan, cover_credits, access_until FROM users WHERE id=@id');
    const u = r.recordset[0];
    const dbPlan       = ((u?.Plan || u?.plan) || '').toLowerCase();
    const coverCredits = u?.CoverCredits ?? u?.cover_credits ?? 0;
    const accessUntil  = u?.AccessUntil  || u?.access_until  || null;
    if (['premium', 'semanal', 'mensal', 'week', 'month', 'pro', 'enterprise'].includes(dbPlan)) return next();
    if (coverCredits > 0) return next();
    if (accessUntil && new Date(accessUntil) > new Date()) return next();
  } catch(_) {}
  return res.status(403).json({ error: 'Pagamento necessário. Acede ao painel para activar.' });
};

module.exports = { auth, adminOnly, superadminOnly, premiumOnly };