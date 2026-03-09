// src/middleware/rateLimiter.js
// ─────────────────────────────────────────────────────────────
// Rate limiting via Redis — protege todas as rotas
// ─────────────────────────────────────────────────────────────
const { redisConnector } = require('../connectors');

// Limites padrão: 200 req/hora por IP
const rateLimiter = (limit = 200, windowSec = 3600) => async (req, res, next) => {
  try {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const allowed = await redisConnector.rateCheck(ip, limit, windowSec);
    if (!allowed) {
      return res.status(429).json({ error: 'Demasiadas requisições. Tente novamente mais tarde.' });
    }
    next();
  } catch {
    // Se Redis falhar, não bloquear o request
    next();
  }
};

// Limite mais apertado para rotas de auth (10 tentativas/15 min)
const authLimiter = rateLimiter(10, 900);

// Limite para ferramentas gratuitas (20/hora)
const toolLimiter = rateLimiter(20, 3600);

module.exports = { rateLimiter, authLimiter, toolLimiter };
