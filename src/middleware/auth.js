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

const premiumOnly = (req, res, next) => {
  if (req.user.plan !== 'premium') return res.status(403).json({ error: 'Funcionalidade premium' });
  next();
};

module.exports = { auth, adminOnly, premiumOnly };