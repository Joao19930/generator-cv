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
      .query('SELECT Email FROM Users WHERE Id=@id')).recordset[0];
    const session = await stripeConnector.createCheckoutSession(req.user.id, user.Email, plan);
    res.json({ url: session.url, sessionId: session.id });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── POST /api/payment/stripe/one-time ───────────────────────
router.post('/stripe/one-time', auth, async (req, res) => {
  try {
    const user    = (await req.db.request().input('id', sql.Int, req.user.id)
      .query('SELECT Email FROM Users WHERE Id=@id')).recordset[0];
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
      await req.db.request()
        .input('userId',    sql.Int,      userId)
        .input('amount',    sql.Decimal,  amount)
        .input('sessionId', sql.NVarChar, session.id)
        .query(`
          UPDATE Users SET [Plan]='premium', PlanExpiry=DATEADD(month,1,GETDATE()) WHERE Id=@userId;
          INSERT INTO Payments (UserId, Amount, Currency, Status, Method, StripeSessionId, CreatedAt)
          VALUES (@userId, @amount, 'USD', 'paid', 'stripe', @sessionId, GETDATE())
        `);

      socketConnector.toUser(userId, 'plan_upgraded', { plan: 'premium', message: '🎉 Bem-vindo ao Premium!' });

      const user = (await req.db.request().input('id', sql.Int, userId)
        .query('SELECT Name, Email FROM Users WHERE Id=@id')).recordset[0];
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
        .query(`UPDATE Users SET [Plan]='free', PlanExpiry=NULL WHERE Id=@id`).catch(() => {});
    }
  }

  res.json({ received: true });
});

module.exports = router;
