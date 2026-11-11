// Razorpay integration: order creation, payment verification, webhook signatures.

const https = require('https');
const crypto = require('crypto');

function getCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET || process.env.RAZORPAY_SECRET;
  if (!keyId || !keySecret) {
    const err = new Error('Razorpay credentials are not configured');
    err.code = 'PAYMENT_NOT_CONFIGURED';
    throw err;
  }
  return { keyId, keySecret };
}

function razorpayRequest(method, apiPath, body) {
  const { keyId, keySecret } = getCredentials();
  const payload = body ? JSON.stringify(body) : null;

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.razorpay.com',
        path: apiPath,
        method,
        headers: {
          Authorization: 'Basic ' + Buffer.from(keyId + ':' + keySecret).toString('base64'),
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          let parsed = {};
          try { parsed = data ? JSON.parse(data) : {}; } catch (e) { parsed = { raw: data }; }
          if (res.statusCode >= 200 && res.statusCode < 300) return resolve(parsed);
          const err = new Error((parsed.error && parsed.error.description) || 'Razorpay request failed');
          err.code = 'RAZORPAY_ERROR';
          err.statusCode = res.statusCode;
          err.response = parsed;
          reject(err);
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function findPlan(db, planId) {
  return db.prepare(
    'SELECT * FROM plans WHERE (id = ? OR name = ?) AND is_active = 1'
  ).get(planId, planId);
}

async function createCheckoutSession(db, planId, orgId) {
  const plan = findPlan(db, planId);
  if (!plan) {
    const err = new Error('Plan not found');
    err.code = 'PLAN_NOT_FOUND';
    throw err;
  }

  const order = await razorpayRequest('POST', '/v1/orders', {
    amount: plan.price_paise,
    currency: 'INR',
    receipt: 'rcpt_' + Date.now(),
    notes: { plan_id: plan.id, organization_id: orgId },
  });

  const { keyId } = getCredentials();
  return {
    orderId: order.id,
    amount: order.amount,
    currency: order.currency || 'INR',
    planId: plan.id,
    planName: plan.name,
    keyId,
  };
}

function fetchOrder(orderId) {
  return razorpayRequest('GET', '/v1/orders/' + encodeURIComponent(orderId));
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function verifyPaymentSignature(orderId, paymentId, signature, secret) {
  const keySecret = secret || getCredentials().keySecret;
  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(orderId + '|' + paymentId)
    .digest('hex');
  return safeEqual(expected, signature || '');
}

function verifyWebhookSignature(rawBody, signature, secret) {
  const webhookSecret = secret || process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) return false;
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody || ''));
  const expected = crypto.createHmac('sha256', webhookSecret).update(body).digest('hex');
  return safeEqual(expected, signature || '');
}

module.exports = {
  createCheckoutSession,
  fetchOrder,
  findPlan,
  verifyPaymentSignature,
  verifyWebhookSignature,
  razorpayRequest,
};
