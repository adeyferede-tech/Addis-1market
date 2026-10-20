// Storage: Supabase (permanent, free) when SUPABASE_* vars are set, else a local data.json file.
const fs = require('fs'), path = require('path');
const U = process.env.SUPABASE_URL, K = process.env.SUPABASE_SERVICE_KEY;
const H = { apikey: K, Authorization: 'Bearer ' + K, 'Content-Type': 'application/json', Prefer: 'return=representation,resolution=merge-duplicates' };
async function rest(m, t, q = '', b) {
  const r = await fetch(`${U}/rest/v1/${t}${q}`, { method: m, headers: H, body: b ? JSON.stringify(b) : undefined });
  if (!r.ok) throw new Error('DB ' + r.status + ' ' + (await r.text()));
  return r.status === 204 ? null : r.json();
}
const supa = {
  products: () => rest('GET', 'products', '?order=id'),
  addProduct: async p => (await rest('POST', 'products', '', p))[0],
  updProduct: async (id, p) => (await rest('PATCH', 'products', `?id=eq.${+id}`, p))[0],
  delProduct: id => rest('DELETE', 'products', `?id=eq.${+id}`),
  orders: async () => (await rest('GET', 'orders', '?order=created_at.desc&limit=100')).map(o => ({ ...o.data, id: o.id, status: o.status, at: o.created_at })),
  addOrder: o => rest('POST', 'orders', '', { id: o.id, data: o }),
  updOrder: (id, s) => rest('PATCH', 'orders', `?id=eq.${encodeURIComponent(id)}`, { status: s }),
  getSettings: async () => ((await rest('GET', 'settings', '?id=eq.1'))[0] || {}).data || {},
  setSettings: s => rest('POST', 'settings', '?on_conflict=id', { id: 1, data: s }),
};
const F = path.join(__dirname, 'data.json');
const load = () => { try { return JSON.parse(fs.readFileSync(F)); } catch { return { products: [], orders: [], settings: {}, n: 0 }; } };
const save = d => fs.writeFileSync(F, JSON.stringify(d, null, 1));
const file = {
  products: async () => load().products,
  addProduct: async p => { const d = load(); p.id = ++d.n; d.products.push(p); save(d); return p; },
  updProduct: async (id, p) => { const d = load(), i = d.products.findIndex(x => x.id == id); if (i < 0) return null; d.products[i] = { ...d.products[i], ...p, id: +id }; save(d); return d.products[i]; },
  delProduct: async id => { const d = load(); d.products = d.products.filter(x => x.id != id); save(d); },
  orders: async () => load().orders,
  addOrder: async o => { const d = load(); d.orders.unshift({ ...o, status: 'new', at: new Date().toISOString() }); save(d); },
  updOrder: async (id, s) => { const d = load(), o = d.orders.find(x => x.id === id); if (o) o.status = s; save(d); },
  getSettings: async () => load().settings || {},
  setSettings: async s => { const d = load(); d.settings = s; save(d); },
};
module.exports = U && K ? supa : file;
