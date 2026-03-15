// src/routes/payment.js
// ─────────────────────────────────────────────────────────────
// Pagamentos: Stripe checkout + PayPal + Webhook Stripe
// ─────────────────────────────────────────────────────────────
const express = require('express');
const router  = express.Router();
const { sql } = require('../config/database');
const { stripeConnector, paypalConnector, socketConnector,
        zapierConnector, emailConnector, smtpConnector, redisConnector } = require('../connectors');
const { auth } = require('../middleware/auth');

// ── POST /api/payment/stripe/checkout ───────────────────────
router.post('/stripe/checkout', auth, async (req, res) => {
  const { plan = 'monthly' } = req.body;
  try {
    const user    = (await req.db.request().input('id', sql.Int, req.user.id)
      .query('SELECT email FROM users WHERE id=@id')).recordset[0];
    const session = await stripeConnector.createCheckoutSession(req.user.id, user.Email, plan);
    res.json({ url: session.url, sessionId: session.id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/payment/stripe/one-time ───────────────────────
router.post('/stripe/one-time', auth, async (req, res) => {
  try {
    const user    = (await req.db.request().input('id', sql.Int, req.user.id)
      .query('SELECT email FROM users WHERE id=@id')).recordset[0];
    const session = await stripeConnector.createOneTime(user.Email, Number(process.env.CV_PRICE));
    res.json({ url: session.url });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/payment/paypal/order ──────────────────────────
router.post('/paypal/order', auth, async (req, res) => {
  try {
    const order = await paypalConnector.createOrder(process.env.CV_PRICE);
    res.json({ orderId: order.id, approveUrl: order.links.find(l => l.rel === 'approve')?.href });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/payment/stripe/webhook ────────────────────────
// ATENÇÃO: usar express.raw() — registar ANTES do express.json() no server.js
router.post('/stripe/webhook', async (req, res) => {
  let event;
  try {
    event = stripeConnector.constructEvent(req.body, req.headers['stripe-signature']);
  } catch (err) {
    return res.status(400).send(`Webhook error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId  = Number(session.metadata.userId);
    const amount  = (session.amount_total || 0) / 100;

    try {
      // Split into two separate queries (PostgreSQL doesn't support multi-statement in one query)
      await req.db.request()
        .input('userId', sql.Int, userId)
        .query(`UPDATE users SET plan='premium', plan_expiry=NOW() + INTERVAL '1 month' WHERE id=@userId`);

      await req.db.request()
        .input('userId',    sql.Int,     userId)
        .input('amount',    sql.Decimal, amount)
        .input('sessionId', sql.NVarChar, session.id)
        .query(`INSERT INTO payments (user_id, amount, currency, status, method, stripe_session_id, created_at)
                VALUES (@userId, @amount, 'USD', 'paid', 'stripe', @sessionId, NOW())`);

      socketConnector.toUser(userId, 'plan_upgraded', { plan: 'premium', message: 'Bem-vindo ao Premium!' });

      const user = (await req.db.request().input('id', sql.Int, userId)
        .query('SELECT name, email FROM users WHERE id=@id')).recordset[0];
      if (user) {
        emailConnector.sendWelcome(user.Email, user.Name).catch(() =>
          smtpConnector.send(user.Email, 'Plano Premium activado!', `<p>Olá ${user.Name}, o seu plano Premium foi activado!</p>`));
        zapierConnector.onPurchase(user, amount, 'premium');
      }
      await redisConnector.del('admin:overview');
    } catch (err) {
      console.error('webhook-process:', err.message);
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const sub    = event.data.object;
    const userId = Number(sub.metadata?.userId);
    if (userId) {
      await req.db.request().input('id', sql.Int, userId)
        .query(`UPDATE users SET plan='free', plan_expiry=NULL WHERE id=@id`).catch(() => {});
    }
  }

  res.json({ received: true });
});

// ── POST /api/payment/request — Pedido de pagamento Akz ──────
const PRICES = { cv_single: 1500, week: 3000, biweek: 5000, cover_letter: 1000 };
router.post('/request', auth, async (req, res) => {
  const { type, cvId } = req.body;
  if (!PRICES[type]) return res.status(400).json({ error: 'Tipo inválido' });
  try {
    const result = await req.db.request()
      .input('userId', sql.Int,     req.user.id)
      .input('type',   sql.NVarChar, type)
      .input('amount', sql.Int,     PRICES[type])
      .input('cvId',   sql.Int,     cvId || null)
      .query(`INSERT INTO payment_requests (user_id, type, amount, cv_id, status, created_at)
              VALUES (@userId, @type, @amount, @cvId, 'pending', NOW())
              RETURNING id`);
    const reqId = result.recordset[0]?.id;
    // Notificar admin via Socket.IO
    try { socketConnector.emit('admin:payment_request', { id: reqId, type, amount: PRICES[type], userId: req.user.id }); } catch {}
    res.json({ success: true, requestId: reqId, amount: PRICES[type] });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/payment/my-access — Verificar acesso do utilizador
router.get('/my-access', auth, async (req, res) => {
  try {
    const r = await req.db.request().input('id', sql.Int, req.user.id)
      .query('SELECT cv_credits, cover_credits, access_until, plan FROM users WHERE id=@id');
    const u = r.recordset[0];
    const now = new Date();
    const hasFullAccess = u?.Plan === 'premium' ||
      (u?.AccessUntil && new Date(u.AccessUntil) > now);
    res.json({
      hasFullAccess,
      cvCredits:    u?.CvCredits    || 0,
      coverCredits: u?.CoverCredits || 0,
      accessUntil:  u?.AccessUntil  || null,
      plan:         u?.Plan         || 'free'
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
