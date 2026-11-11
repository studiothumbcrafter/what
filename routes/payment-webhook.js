// Razorpay payment webhook. Idempotent by event id and authenticated by HMAC.

const express = require('express');
const { verifyWebhookSignature, fetchOrder, findPlan } = require('../services/payment');
const { activateSubscription } = require('../services/subscription');

const router = express.Router();

router.post('/', (req, res) => {
  const d = req.app.locals.db;
  const signature = req.headers['x-razorpay-signature'];
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!secret) {
    return res.status(503).json({ error: 'Payment webhook is not configured' });
  }
  if (!verifyWebhookSignature(req.rawBody, signature, secret)) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  const event = req.body || {};
  const eventId = req.headers['x-razorpay-event-id'] || event.id || null;
  if (!eventId) {
    return res.status(400).json({ error: 'Missing webhook event id' });
  }

  const payment = (event.payload && event.payload.payment && event.payload.payment.entity) || {};
  const orderEntity = (event.payload && event.payload.order && event.payload.order.entity) || {};
  const notes = orderEntity.notes || payment.notes || {};
  const orgId = notes.organization_id;

  if (!orgId) {
    return res.status(400).json({ error: 'Webhook does not reference an organization' });
  }

  // Idempotency: the unique event_id constraint makes replays a no-op.
  try {
    d.prepare(
      'INSERT INTO webhook_events (organization_id, event_id) VALUES (?, ?)'
    ).run(orgId, eventId);
  } catch (err) {
    if (String(err.message).includes('UNIQUE')) {
      return res.status(200).json({ status: 'duplicate', event_id: eventId });
    }
    return res.status(500).json({ error: err.message });
  }

  if (event.event !== 'payment.captured') {
    return res.status(200).json({ status: 'ignored', event: event.event });
  }

  const finish = (order) => {
    const orderNotes = (order && order.notes) || notes;
    const plan = findPlan(d, orderNotes.plan_id);
    if (!plan) return res.status(400).json({ error: 'Webhook does not reference a valid plan' });

    const paidAmount = Number((order && order.amount) || payment.amount);
    if (paidAmount !== plan.price_paise) {
      return res.status(400).json({ error: 'Paid amount does not match the plan price' });
    }

    const subscription = activateSubscription(d, orgId, plan, {
      paymentId: payment.id,
      orderId: payment.order_id || orderEntity.id,
    });
    res.status(200).json({ status: 'ok', subscription });
  };

  if (orderEntity && orderEntity.id) {
    return finish(orderEntity);
  }
  if (!payment.order_id) {
    return res.status(400).json({ error: 'Webhook is missing the order id' });
  }

  fetchOrder(payment.order_id).then(finish).catch((err) => {
    res.status(502).json({ error: err.message });
  });
});

module.exports = router;
