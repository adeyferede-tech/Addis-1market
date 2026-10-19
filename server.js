require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');

const E = process.env;
const BASE = (E.PUBLIC_URL || 'http://localhost:3000').replace(/\/$/, '');
const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public'))); // only /public is exposed

const PRODUCTS = [
  { id: 1, name: 'Yirgacheffe Coffee 1kg', cat: 'Food', price: 1200, emoji: '☕' },
  { id: 2, name: 'Handwoven Gabi Blanket', cat: 'Home', price: 3500, emoji: '🧣' },
  { id: 3, name: 'Wireless Earbuds', cat: 'Tech', price: 2800, emoji: '🎧' },
  { id: 4, name: 'Power Bank 20,000mAh', cat: 'Tech', price: 2200, emoji: '🔋' },
  { id: 5, name: 'Pure Honey 500g', cat: 'Food', price: 650, emoji: '🍯' },
  { id: 6, name: 'Leather Backpack', cat: 'Fashion', price: 4800, emoji: '🎒' },
  { id: 7, name: 'Jebena Coffee Set', cat: 'Home', price: 1900, emoji: '🫖' },
  { id: 8, name: 'Running Shoes', cat: 'Fashion', price: 3900, emoji: '👟' },
];

const mailer = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: E.GMAIL_USER, pass: E.GMAIL_APP_PASSWORD },
});

async function notify(text, subject, extraTo) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${E.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: E.TELEGRAM_CHAT_ID, text }),
    });
    const d = await r.json();
    if (!d.ok) console.error('Telegram:', JSON.stringify(d));
  } catch (e) { console.error('Telegram ERROR:', e.message); }
  try {
    await mailer.sendMail({ from: E.GMAIL_USER, to: [E.GMAIL_USER, extraTo].filter(Boolean).join(','), subject, text });
  } catch (e) { console.error('Gmail ERROR:', e.message); }
}

app.get('/health', (_, res) => res.send('ok'));
app.get('/api/products', (_, res) => res.json(PRODUCTS));

const orderLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

app.post('/api/order', orderLimit, async (req, res) => {
  try {
    const { name, phone, email, address, payment, ref, items } = req.body || {};
    const s = (v, n) => String(v || '').slice(0, n);
    if (!name || !phone || !address || !Array.isArray(items) || !items.length || items.length > 50)
      return res.status(400).json({ error: 'Missing required fields' });
    if (!['cod', 'telebirr', 'cbe', 'chapa'].includes(payment))
      return res.status(400).json({ error: 'Invalid payment method' });

    const lines = items
      .map(i => {
        const p = PRODUCTS.find(x => x.id === i.id);
        return p && { p, q: Math.max(1, Math.min(99, +i.qty || 1)) };
      })
      .filter(Boolean);
    if (!lines.length) return res.status(400).json({ error: 'Cart is empty' });

    const total = lines.reduce((t, l) => t + l.p.price * l.q, 0);
    const id = 'ORD-' + Date.now().toString(36).toUpperCase();
    const list = lines.map(l => `• ${l.p.name} x${l.q} = ${l.p.price * l.q} ETB`).join('\n');
    const mail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email || '') ? email : '';
    const body = `${list}\n\nTotal: ${total} ETB\nPayment: ${payment}${ref ? ` (ref: ${s(ref, 60)})` : ''}\n\nCustomer: ${s(name, 80)}\nPhone: ${s(phone, 30)}\nEmail: ${mail || '-'}\nAddress: ${s(address, 300)}`;

    let checkout_url = null;
    if (payment === 'chapa') {
      const r = await fetch('https://api.chapa.co/v1/transaction/initialize', {
        method: 'POST',
        headers: { Authorization: `Bearer ${E.CHAPA_SECRET_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: String(total), currency: 'ETB', tx_ref: id,
          email: mail || E.GMAIL_USER, first_name: s(name, 40), phone_number: s(phone, 20),
          callback_url: `${BASE}/api/chapa-callback`, return_url: BASE,
        }),
      });
      const d = await r.json();
      checkout_url = d?.data?.checkout_url || null;
      if (!checkout_url) return res.status(502).json({ error: 'Online payment unavailable. Choose another method.' });
    }

    const tag = payment === 'chapa' ? '⏳ AWAITING PAYMENT' : '🛒 New order';
    await notify(`${tag} ${id}\n\n${body}`, `Order ${id} - ${total} ETB`, mail);
    res.json({ ok: true, id, total, checkout_url });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Server error' });
  }
});

// Chapa calls this after payment. We re-verify with Chapa, never trust the request.
const paid = new Set();
app.all('/api/chapa-callback', async (req, res) => {
  res.sendStatus(200);
  try {
    const tx = String(req.query.trx_ref || req.query.tx_ref || req.body?.tx_ref || req.body?.trx_ref || '');
    if (!/^ORD-[A-Z0-9]+$/.test(tx) || paid.has(tx)) return;
    const r = await fetch(`https://api.chapa.co/v1/transaction/verify/${tx}`, {
      headers: { Authorization: `Bearer ${E.CHAPA_SECRET_KEY}` },
    });
    const d = await r.json();
    if (d?.data?.status === 'success') {
      paid.add(tx);
      await notify(`✅ PAID ${tx}\nAmount: ${d.data.amount} ETB\nCustomer: ${d.data.first_name || '-'}`, `Paid ${tx}`);
    }
  } catch (e) { console.error('Chapa verify:', e.message); }
});

app.listen(E.PORT || 3000, () => console.log('Shop running on ' + BASE));
