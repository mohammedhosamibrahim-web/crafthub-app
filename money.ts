import { Hono } from 'hono';
import type { Env, User } from '../lib/core';
import { all, one, run, monetizationEligible } from '../lib/core';

const money = new Hono<{ Bindings: Env }>();

const MIN_WITHDRAWAL = 100;

async function channelStats(db: D1Database, userId: number) {
  const watch = (await one<{ s: number }>(db,
    'SELECT COALESCE(SUM(watch_seconds),0) AS s FROM videos WHERE user_id = ?', userId))?.s || 0;
  const shortViews = (await one<{ n: number }>(db,
    "SELECT COALESCE(SUM(views),0) AS n FROM videos WHERE user_id = ? AND kind='short'", userId))?.n || 0;
  const longViews = (await one<{ n: number }>(db,
    "SELECT COALESCE(SUM(views),0) AS n FROM videos WHERE user_id = ? AND kind='long'", userId))?.n || 0;
  return { watchHours: Math.round(watch / 3600), shortViews, longViews, watchSeconds: watch };
}

money.get('/wallet', async (c) => {
  const u = c.get('user') as User | undefined;
  if (!u) return c.json({ ok: false, error: 'unauthorized' }, 401);

  let wallet = await one<any>(c.env.DB, 'SELECT * FROM wallets WHERE user_id = ?', u.id);
  if (!wallet) {
    await run(c.env.DB, 'INSERT INTO wallets (user_id) VALUES (?)', u.id);
    wallet = await one<any>(c.env.DB, 'SELECT * FROM wallets WHERE user_id = ?', u.id);
  }

  const stats = await channelStats(c.env.DB, u.id);
  const elig = monetizationEligible(u, stats.watchHours, stats.shortViews);
  const breakdown = await all<{ source: string; total: number; n: number }>(
    c.env.DB,
    'SELECT source, COALESCE(SUM(creator_share),0) AS total, COUNT(*) AS n FROM earnings WHERE user_id = ? GROUP BY source',
    u.id,
  );
  const withdrawals = await all(c.env.DB,
    'SELECT id, amount, method, destination, status, note, created_at FROM withdrawals WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
    u.id,
  );
  const recent = await all(c.env.DB,
    'SELECT id, source, gross, creator_share, platform_share, created_at FROM earnings WHERE user_id = ? ORDER BY created_at DESC LIMIT 30',
    u.id,
  );

  return c.json({
    ok: true,
    wallet: {
      balance: wallet.balance,
      lifetime: wallet.lifetime,
      cpm: wallet.cpm,
      rpm: wallet.rpm,
      currency: wallet.currency || 'USD',
    },
    eligibility: { ...elig, progress: {
      subscribers: { current: u.subscribers, target: 1000 },
      watch_hours: { current: stats.watchHours, target: 4000 },
      short_views: { current: stats.shortViews, target: 10_000_000 },
    } },
    rules: {
      long_split: '55% creator / 45% platform',
      short_split: '45% creator / 55% platform',
      min_withdrawal: MIN_WITHDRAWAL,
    },
    breakdown,
    recent,
    withdrawals,
  });
});

// Simulate / record other revenue sources (Super Chat, memberships, premium)
money.post('/earnings/simulate', async (c) => {
  const u = c.get('user') as User | undefined;
  if (!u) return c.json({ ok: false, error: 'unauthorized' }, 401);
  const b = await c.req.json().catch(() => ({} as any));
  const source = ['ads_long', 'ads_short', 'premium', 'superchat', 'membership'].includes(b.source) ? b.source : 'superchat';
  const gross = Math.max(0, Math.min(Number(b.gross || 0), 10000));
  const rate = source === 'ads_short' ? 0.45 : source === 'ads_long' ? 0.55 : 0.7;
  const creator = Math.round(gross * rate * 100) / 100;
  const platform = Math.round((gross - creator) * 100) / 100;
  await run(c.env.DB,
    'INSERT INTO earnings (user_id, source, gross, creator_share, platform_share) VALUES (?,?,?,?,?)',
    u.id, source, gross, creator, platform);
  await run(c.env.DB,
    'UPDATE wallets SET balance = balance + ?, lifetime = lifetime + ? WHERE user_id = ?',
    creator, creator, u.id);
  return c.json({ ok: true, creator_share: creator, platform_share: platform, rate });
});

money.post('/withdrawals', async (c) => {
  const u = c.get('user') as User | undefined;
  if (!u) return c.json({ ok: false, error: 'unauthorized' }, 401);
  const b = await c.req.json().catch(() => ({} as any));
  const amount = Number(b.amount || 0);
  const method = String(b.method || '');
  const destination = String(b.destination || '').trim();

  if (!['IBAN', 'PayPal', 'InstaPay'].includes(method)) {
    return c.json({ ok: false, error: 'invalid_method' }, 400);
  }
  if (!destination) return c.json({ ok: false, error: 'missing_destination' }, 400);
  if (amount < MIN_WITHDRAWAL) {
    return c.json({ ok: false, error: 'min_withdrawal', message: 'الحد الأدنى للسحب 100 دولار' }, 400);
  }
  const w = await one<{ balance: number }>(c.env.DB, 'SELECT balance FROM wallets WHERE user_id = ?', u.id);
  if (!w || w.balance < amount) {
    return c.json({ ok: false, error: 'insufficient', message: 'الرصيد غير كافٍ' }, 400);
  }
  await run(c.env.DB, 'UPDATE wallets SET balance = balance - ? WHERE user_id = ?', amount, u.id);
  const res = await run(c.env.DB,
    'INSERT INTO withdrawals (user_id, amount, method, destination) VALUES (?,?,?,?)',
    u.id, amount, method, destination);
  return c.json({ ok: true, id: res.meta?.last_row_id, status: 'pending' });
});

// Premium subscription toggle (demo)
money.post('/premium', async (c) => {
  const u = c.get('user') as User | undefined;
  if (!u) return c.json({ ok: false, error: 'unauthorized' }, 401);
  const b = await c.req.json().catch(() => ({ active: true }));
  await run(c.env.DB, 'UPDATE users SET premium = ? WHERE id = ?', b.active ? 1 : 0, u.id);
  return c.json({ ok: true, premium: !!b.active });
});

export { MIN_WITHDRAWAL };
export default money;
