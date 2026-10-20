require('dotenv').config();
const path = require('path'), crypto = require('crypto');
const express = require('express'), helmet = require('helmet'), rateLimit = require('express-rate-limit'), nodemailer = require('nodemailer');
const db = require('./db');
const E = process.env;
const BASE = (E.PUBLIC_URL || 'http://localhost:3000').replace(/\/$/, '');
const app = express();
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: { directives: {
  defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", 'data:', 'https:'], frameSrc: ['https://www.openstreetmap.org'],
  connectSrc: ["'self'"], objectSrc: ["'none'"], upgradeInsecureRequests: BASE.startsWith('https') ? [] : null } } }));
app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ---------- admin auth (signed httpOnly cookie, 12h) ----------
const SEC = E.SESSION_SECRET || crypto.createHash('sha256').update('s' + E.ADMIN_PASSWORD).digest('hex');
const sign = x => crypto.createHmac('sha256', SEC).update(x).digest('hex');
const eq = (a, b) => { a = Buffer.from(a); b = Buffer.from(b); return a.length === b.length && crypto.timingSafeEqual(a, b); };
const authed = q => { const m = /(?:^|; )adm=([^;]+)/.exec(q.headers.cookie || ''); if (!m) return false; const [exp, sig] = m[1].split('.'); return +exp > Date.now() && eq(sig || '', sign(exp)); };
const guard = (q, s, n) => authed(q) ? n() : s.status(401).json({ error: 'Login required' });
const loginLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 8, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts. Try again in 15 minutes.' } });
const orderLimit = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });

app.post('/api/admin/login', loginLimit, (q, s) => {
  if (!E.ADMIN_PASSWORD || E.ADMIN_PASSWORD.length < 8) return s.status(503).json({ error: 'Set ADMIN_PASSWORD (8+ characters) on the server' });
  if (!eq(String(q.body?.password || ''), E.ADMIN_PASSWORD)) return s.status(401).json({ error: 'Wrong password' });
  const exp = String(Date.now() + 12 * 36e5);
  s.cookie('adm', exp + '.' + sign(exp), { httpOnly: true, sameSite: 'strict', secure: q.secure, maxAge: 12 * 36e5 });
  s.json({ ok: true });
});
app.post('/api/admin/logout', (q, s) => { s.clearCookie('adm'); s.json({ ok: true }); });

// ---------- helpers ----------
const clean = b => {
  const n = (v, m) => String(v ?? '').trim().slice(0, m), img = n(b.image, 500);
  return { name: n(b.name, 100), cat: n(b.cat, 40) || 'General', price: Math.max(0, +b.price || 0), emoji: n(b.emoji, 4) || '🛍️',
    image: /^https:\/\//.test(img) ? img : '', description: n(b.description, 600),
    stock: b.stock === '' || b.stock == null ? null : Math.max(0, Math.floor(+b.stock) || 0), active: b.active !== false };
};
const KEYS = ['shopName', 'tagline', 'about', 'phone', 'email', 'address', 'hours', 'telegram', 'facebook', 'instagram', 'tiktok', 'whatsapp', 'telebirr', 'cbe', 'lat', 'lng'];
const URLK = ['telegram', 'facebook', 'instagram', 'tiktok'];

async function notify(text, subject, extraTo) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${E.TELEGRAM_BOT_TOKEN}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: E.TELEGRAM_CHAT_ID, text }) });
    const d = await r.json(); if (!d.ok) console.error('Telegram:', JSON.stringify(d));
  } catch (e) { console.error('Telegram ERROR:', e.message); }
  try {
    if (E.RESEND_API_KEY) {
      const r = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${E.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: E.MAIL_FROM || 'Addis Market <onboarding@resend.dev>', to: E.MAIL_FROM ? [E.GMAIL_USER, extraTo].filter(Boolean) : [E.GMAIL_USER], subject, text }) });
      if (!r.ok) console.error('Resend:', await r.text());
    } else {
      await nodemailer.createTransport({ service: 'gmail', auth: { user: E.GMAIL_USER, pass: E.GMAIL_APP_PASSWORD } })
        .sendMail({ from: E.GMAIL_USER, to: [E.GMAIL_USER, extraTo].filter(Boolean).join(','), subject, text });
    }
  } catch (e) { console.error('Email ERROR:', e.message); }
}

// ---------- first-run sample data ----------
const SAMPLE = [['Yirgacheffe Coffee 1kg', 'Food', 1200, '☕'], ['Handwoven Gabi Blanket', 'Home', 3500, '🧣'], ['Wireless Earbuds', 'Tech', 2800, '🎧'], ['Power Bank 20,000mAh', 'Tech', 2200, '🔋'], ['Pure Honey 500g', 'Food', 650, '🍯'], ['Leather Backpack', 'Fashion', 4800, '🎒']];
(async () => { try {
  const s = await db.getSettings();
  if (!s._seeded) {
    if (!(await db.products()).length) for (const [n, c, p, e] of SAMPLE) await db.addProduct({ name: n, cat: c, price: p, emoji: e, image: '', description: '', stock: null, active: true });
    await db.setSettings({ shopName: 'Addis Market', tagline: 'Quality goods, delivered across Addis Ababa', ...s, _seeded: true });
  }
} catch (e) { console.error('Seed:', e.message); } })();

// ---------- public API ----------
app.get('/health', (_, s) => s.send('ok'));
app.get('/api/products', async (_, s) => { try { s.json((await db.products()).filter(p => p.active !== false)); } catch (e) { console.error(e.message); s.status(500).json([]); } });
app.get('/api/settings', async (_, s) => { try { const { _seeded, ...pub } = await db.getSettings(); s.json(pub); } catch { s.json({}); } });

app.post('/api/order', orderLimit, async (q, s) => {
  try {
    const { name, phone, email, address, payment, ref, items, gps } = q.body || {};
    const t = (v, n) => String(v || '').trim().slice(0, n);
    if (!t(name, 80) || !t(phone, 30) || !t(address, 300) || !Array.isArray(items) || !items.length || items.length > 50) return s.status(400).json({ error: 'Please fill in name, phone and address.' });
    if (!['cod', 'telebirr', 'cbe', 'chapa'].includes(payment)) return s.status(400).json({ error: 'Invalid payment method' });
    const prods = (await db.products()).filter(p => p.active !== false), lines = [];
    for (const i of items) {
      const p = prods.find(x => x.id == i.id); if (!p) continue;
      const n = Math.max(1, Math.min(99, +i.qty || 1));
      if (p.stock != null && n > p.stock) return s.status(400).json({ error: `${p.name}: only ${p.stock} left` });
      lines.push({ p, n });
    }
    if (!lines.length) return s.status(400).json({ error: 'Cart is empty' });
    const total = lines.reduce((a, l) => a + l.p.price * l.n, 0);
    const id = 'ORD-' + Date.now().toString(36).toUpperCase();
    const list = lines.map(l => `• ${l.p.name} x${l.n} = ${l.p.price * l.n} ETB`).join('\n');
    const mail = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email || '') ? email : '';
    const loc = gps && isFinite(gps.lat) && isFinite(gps.lng) ? `https://maps.google.com/?q=${+gps.lat},${+gps.lng}` : '';
    const body = `${list}\n\nTotal: ${total} ETB\nPayment: ${payment}${ref ? ` (ref: ${t(ref, 60)})` : ''}\n\nCustomer: ${t(name, 80)}\nPhone: ${t(phone, 30)}\nEmail: ${mail || '-'}\nAddress: ${t(address, 300)}${loc ? `\nGPS: ${loc}` : ''}`;
    let checkout_url = null;
    if (payment === 'chapa') {
      const r = await fetch('https://api.chapa.co/v1/transaction/initialize', { method: 'POST', headers: { Authorization: `Bearer ${E.CHAPA_SECRET_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: String(total), currency: 'ETB', tx_ref: id, email: mail || E.GMAIL_USER, first_name: t(name, 40), phone_number: t(phone, 20), callback_url: `${BASE}/api/chapa-callback`, return_url: BASE }) });
      checkout_url = (await r.json())?.data?.checkout_url || null;
      if (!checkout_url) return s.status(502).json({ error: 'Online payment unavailable. Choose another method.' });
    }
    await db.addOrder({ id, name: t(name, 80), phone: t(phone, 30), address: t(address, 300), payment, ref: t(ref, 60), total, list, gps: loc });
    for (const l of lines) if (l.p.stock != null) await db.updProduct(l.p.id, { stock: Math.max(0, l.p.stock - l.n) });
    await notify(`${payment === 'chapa' ? '⏳ AWAITING PAYMENT' : '🛒 New order'} ${id}\n\n${body}`, `Order ${id} - ${total} ETB`, mail);
    s.json({ ok: true, id, total, checkout_url });
  } catch (e) { console.error(e); s.status(500).json({ error: 'Server error' }); }
});

const paid = new Set();
app.all('/api/chapa-callback', async (q, s) => {
  s.sendStatus(200);
  try {
    const tx = String(q.query.trx_ref || q.query.tx_ref || q.body?.tx_ref || q.body?.trx_ref || '');
    if (!/^ORD-[A-Z0-9]+$/.test(tx) || paid.has(tx)) return;
    const d = await (await fetch(`https://api.chapa.co/v1/transaction/verify/${tx}`, { headers: { Authorization: `Bearer ${E.CHAPA_SECRET_KEY}` } })).json();
    if (d?.data?.status === 'success') { paid.add(tx); await db.updOrder(tx, 'paid'); await notify(`✅ PAID ${tx}\nAmount: ${d.data.amount} ETB\nCustomer: ${d.data.first_name || '-'}`, `Paid ${tx}`); }
  } catch (e) { console.error('Chapa verify:', e.message); }
});

// ---------- admin API ----------
app.get('/api/admin/products', guard, async (_, s) => s.json(await db.products()));
app.post('/api/admin/products', guard, async (q, s) => { const p = clean(q.body || {}); if (!p.name || !p.price) return s.status(400).json({ error: 'Name and price are required' }); s.json(await db.addProduct(p)); });
app.put('/api/admin/products/:id', guard, async (q, s) => { const p = clean(q.body || {}); if (!p.name || !p.price) return s.status(400).json({ error: 'Name and price are required' }); s.json(await db.updProduct(q.params.id, p)); });
app.delete('/api/admin/products/:id', guard, async (q, s) => { await db.delProduct(q.params.id); s.json({ ok: true }); });
app.get('/api/admin/orders', guard, async (_, s) => s.json(await db.orders()));
app.post('/api/admin/orders/:id/status', guard, async (q, s) => { if (!['new', 'paid', 'done', 'cancelled'].includes(q.body?.status)) return s.status(400).json({ error: 'Bad status' }); await db.updOrder(q.params.id, q.body.status); s.json({ ok: true }); });
app.get('/api/admin/settings', guard, async (_, s) => s.json(await db.getSettings()));
app.put('/api/admin/settings', guard, async (q, s) => {
  const old = await db.getSettings(), n = { _seeded: true };
  for (const k of KEYS) {
    let v = String(q.body?.[k] ?? '').trim().slice(0, k === 'about' ? 800 : 200);
    if (URLK.includes(k) && v && !/^https:\/\//.test(v)) v = '';
    if ((k === 'lat' || k === 'lng') && v && isNaN(+v)) v = '';
    n[k] = v;
  }
  await db.setSettings({ ...old, ...n }); s.json({ ok: true });
});

app.listen(E.PORT || 3000, () => console.log('Shop running on ' + BASE));
