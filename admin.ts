import { Hono } from 'hono';
import type { Env, User } from '../lib/core';
import { all, one, run, publicUser, getAdSettings } from '../lib/core';
import {
  getModerationSettings, getBlacklist, DEFAULT_MODERATION, BUILTIN_BLOCKLIST,
} from '../lib/moderation';

const admin = new Hono<{ Bindings: Env }>();

function isAdmin(u?: User) { return u?.role === 'admin'; }
function isStaff(u?: User) { return u?.role === 'admin' || u?.role === 'moderator'; }

admin.get('/overview', async (c) => {
  const u = c.get('user') as User | undefined;
  if (!isStaff(u)) return c.json({ ok: false, error: 'forbidden' }, 403);
  const counts = {
    users: (await one<{ n: number }>(c.env.DB, 'SELECT COUNT(*) AS n FROM users'))?.n || 0,
    rooms: (await one<{ n: number }>(c.env.DB, 'SELECT COUNT(*) AS n FROM rooms'))?.n || 0,
    messages: (await one<{ n: number }>(c.env.DB, 'SELECT COUNT(*) AS n FROM messages'))?.n || 0,
    videos: (await one<{ n: number }>(c.env.DB, 'SELECT COUNT(*) AS n FROM videos'))?.n || 0,
    verified_companies: (await one<{ n: number }>(c.env.DB, 'SELECT COUNT(*) AS n FROM users WHERE is_verified = 1'))?.n || 0,
    pending_withdrawals: (await one<{ n: number }>(c.env.DB, "SELECT COUNT(*) AS n FROM withdrawals WHERE status='pending'"))?.n || 0,
    platform_revenue: (await one<{ s: number }>(c.env.DB, 'SELECT COALESCE(SUM(platform_share),0) AS s FROM earnings'))?.s || 0,
    creator_payouts: (await one<{ s: number }>(c.env.DB, 'SELECT COALESCE(SUM(creator_share),0) AS s FROM earnings'))?.s || 0,
  };
  const users = await all<User>(
    c.env.DB,
    `SELECT id, full_name, handle, phone, email, profession_name, sector_name, role,
            is_verified, is_company, subscribers, created_at FROM users ORDER BY id DESC LIMIT 100`,
  );
  const rooms = await all(c.env.DB, 'SELECT * FROM rooms ORDER BY id DESC LIMIT 100');
  const withdrawals = await all(
    c.env.DB,
    `SELECT w.*, u.full_name, u.handle FROM withdrawals w JOIN users u ON u.id = w.user_id
     ORDER BY w.created_at DESC LIMIT 100`,
  );
  const reports = await all(
    c.env.DB,
    `SELECT r.*, u.full_name AS reporter_name FROM reports r JOIN users u ON u.id = r.reporter_id
     WHERE r.handled = 0 ORDER BY r.created_at DESC LIMIT 100`,
  );
  const bans = await all(
    c.env.DB,
    `SELECT b.id, b.user_id, b.reason, b.hours, b.expires_at, b.active, b.created_at,
            u.full_name, u.handle
     FROM bans b JOIN users u ON u.id = b.user_id ORDER BY b.created_at DESC LIMIT 100`,
  );
  return c.json({ ok: true, counts, users, rooms, withdrawals, reports, bans });
});

// Broadcast notification to all users
admin.post('/broadcast', async (c) => {
  const u = c.get('user') as User | undefined;
  if (!isAdmin(u)) return c.json({ ok: false, error: 'forbidden' }, 403);
  const { title, body } = await c.req.json().catch(() => ({} as any));
  if (!title) return c.json({ ok: false, error: 'missing_title' }, 400);
  const res = await run(c.env.DB,
    'INSERT INTO notifications (user_id, title, body, is_broadcast) VALUES (NULL, ?, ?, 1)',
    String(title).slice(0, 200), String(body || '').slice(0, 1000));
  return c.json({ ok: true, id: res.meta?.last_row_id });
});

admin.get('/notifications', async (c) => {
  const u = c.get('user') as User | undefined;
  const rows = await all(
    c.env.DB,
    `SELECT * FROM notifications WHERE is_broadcast = 1 OR user_id = ? ORDER BY created_at DESC LIMIT 50`,
    u?.id ?? -1,
  );
  return c.json({ ok: true, notifications: rows });
});

// Verify a company account
admin.post('/users/:id/verify', async (c) => {
  const u = c.get('user') as User | undefined;
  if (!isAdmin(u)) return c.json({ ok: false, error: 'forbidden' }, 403);
  const id = Number(c.req.param('id'));
  const { verified, tax_id } = await c.req.json().catch(() => ({ verified: true, tax_id: '' }));
  await run(c.env.DB, 'UPDATE users SET is_verified = ?, is_company = 1, tax_id = COALESCE(?, tax_id) WHERE id = ?',
    verified ? 1 : 0, tax_id || null, id);
  const updated = await one<User>(c.env.DB, 'SELECT * FROM users WHERE id = ?', id);
  return c.json({ ok: true, user: publicUser(updated), verified: !!verified });
});

// Role management
admin.post('/users/:id/role', async (c) => {
  const u = c.get('user') as User | undefined;
  if (!isAdmin(u)) return c.json({ ok: false, error: 'forbidden' }, 403);
  const id = Number(c.req.param('id'));
  const { role } = await c.req.json().catch(() => ({ role: 'user' }));
  if (!['user', 'moderator', 'admin'].includes(role)) return c.json({ ok: false, error: 'bad_role' }, 400);
  await run(c.env.DB, 'UPDATE users SET role = ? WHERE id = ?', role, id);
  return c.json({ ok: true, role });
});

// Temporary ban with duration in hours + reason
admin.post('/users/:id/ban', async (c) => {
  const u = c.get('user') as User | undefined;
  if (!isStaff(u)) return c.json({ ok: false, error: 'forbidden' }, 403);
  const id = Number(c.req.param('id'));
  const { reason, hours } = await c.req.json().catch(() => ({} as any));
  if (!reason) return c.json({ ok: false, error: 'missing_reason' }, 400);
  const h = Math.max(1, Math.min(Number(hours || 24), 24 * 365));
  const expires = new Date(Date.now() + h * 3600 * 1000).toISOString();
  const res = await run(c.env.DB,
    'INSERT INTO bans (user_id, issued_by, reason, hours, expires_at, active) VALUES (?,?,?,?,?,1)',
    id, u!.id, String(reason).slice(0, 500), h, expires);
  return c.json({ ok: true, id: res.meta?.last_row_id, expires_at: expires, hours: h });
});

admin.post('/bans/:id/lift', async (c) => {
  const u = c.get('user') as User | undefined;
  if (!isStaff(u)) return c.json({ ok: false, error: 'forbidden' }, 403);
  await run(c.env.DB, 'UPDATE bans SET active = 0 WHERE id = ?', Number(c.req.param('id')));
  return c.json({ ok: true });
});

// Withdrawal review
admin.post('/withdrawals/:id/:decision', async (c) => {
  const u = c.get('user') as User | undefined;
  if (!isAdmin(u)) return c.json({ ok: false, error: 'forbidden' }, 403);
  const id = Number(c.req.param('id'));
  const decision = c.req.param('decision');
  if (!['approve', 'reject', 'pay'].includes(decision)) return c.json({ ok: false, error: 'bad_decision' }, 400);
  const w = await one<any>(c.env.DB, 'SELECT * FROM withdrawals WHERE id = ?', id);
  if (!w) return c.json({ ok: false, error: 'not_found' }, 404);
  const status = decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'paid';
  if (decision === 'reject' && w.status !== 'rejected') {
    // refund to wallet
    await run(c.env.DB, 'UPDATE wallets SET balance = balance + ? WHERE user_id = ?', w.amount, w.user_id);
  }
  await run(c.env.DB, 'UPDATE withdrawals SET status = ? WHERE id = ?', status, id);
  return c.json({ ok: true, status });
});

// Report content
admin.post('/reports', async (c) => {
  const u = c.get('user') as User | undefined;
  if (!u) return c.json({ ok: false, error: 'unauthorized' }, 401);
  const { target_type, target_id, reason } = await c.req.json().catch(() => ({} as any));
  if (!['message', 'comment', 'user'].includes(target_type) || !target_id) {
    return c.json({ ok: false, error: 'bad_request' }, 400);
  }
  const res = await run(c.env.DB,
    'INSERT INTO reports (reporter_id, target_type, target_id, reason) VALUES (?,?,?,?)',
    u.id, target_type, Number(target_id), String(reason || '').slice(0, 500));
  return c.json({ ok: true, id: res.meta?.last_row_id });
});

// Moderators remove abusive messages / comments directly
admin.post('/moderate/comment/:id/remove', async (c) => {
  const u = c.get('user') as User | undefined;
  if (!isStaff(u)) return c.json({ ok: false, error: 'forbidden' }, 403);
  await run(c.env.DB, 'UPDATE comments SET is_removed = 1 WHERE id = ?', Number(c.req.param('id')));
  await run(c.env.DB, 'UPDATE reports SET handled = 1 WHERE target_type = ? AND target_id = ?', 'comment', Number(c.req.param('id')));
  return c.json({ ok: true });
});

admin.post('/moderate/message/:id/remove', async (c) => {
  const u = c.get('user') as User | undefined;
  if (!isStaff(u)) return c.json({ ok: false, error: 'forbidden' }, 403);
  await run(c.env.DB, "UPDATE messages SET deleted_for_all = 1, body = '', media_url = '' WHERE id = ?", Number(c.req.param('id')));
  await run(c.env.DB, 'UPDATE reports SET handled = 1 WHERE target_type = ? AND target_id = ?', 'message', Number(c.req.param('id')));
  return c.json({ ok: true });
});

admin.post('/reports/:id/handle', async (c) => {
  const u = c.get('user') as User | undefined;
  if (!isStaff(u)) return c.json({ ok: false, error: 'forbidden' }, 403);
  await run(c.env.DB, 'UPDATE reports SET handled = 1 WHERE id = ?', Number(c.req.param('id')));
  return c.json({ ok: true });
});

/* ------------------------------------------------------------------ *
 * Custom Ads Management (admin only)
 *
 * AdMob keys are OPTIONAL. The default network is 'custom', meaning the
 * admin's own ad links + banner images are served. Nothing here requires
 * an AdMob App ID or Banner Ad Unit to run the app.
 * ------------------------------------------------------------------ */
const AD_FIELDS = [
  'enabled', 'android_link', 'android_banner', 'ios_link', 'ios_banner',
  'desktop_link', 'desktop_banner', 'admob_app_id', 'admob_banner_unit',
  'admob_android_banner_unit', 'admob_ios_banner_unit', 'network',
] as const;

admin.get('/ads', async (c) => {
  const u = c.get('user') as User | undefined;
  if (!isStaff(u)) return c.json({ ok: false, error: 'forbidden' }, 403);
  const settings = await getAdSettings(c.env.DB);
  return c.json({
    ok: true,
    settings,
    // Reporting helpers so the UI can show "AdMob configured?" without
    // ever treating it as a blocker.
    admob_configured: !!settings.admob_app_id,
    custom_configured: !!(settings.android_link || settings.ios_link || settings.desktop_link),
  });
});

admin.put('/ads', async (c) => {
  const u = c.get('user') as User | undefined;
  if (!isAdmin(u)) return c.json({ ok: false, error: 'forbidden' }, 403);

  let body: any = {};
  try { body = await c.req.json(); } catch { body = {}; }

  const str = (v: any) => (v === undefined || v === null ? '' : String(v).slice(0, 2000));
  const enabled = body.enabled ? 1 : 0;

  const link = (v: any) => {
    const s = str(v).trim();
    if (!s) return '';
    // Keep only http(s) URLs — anything else is stored as empty rather
    // than raising an error, so a bad paste never blocks saving.
    return /^https?:\/\//i.test(s) ? s : '';
  };

  await run(
    c.env.DB,
    `INSERT INTO ad_settings
       (id, enabled, android_link, android_banner, ios_link, ios_banner,
        desktop_link, desktop_banner, admob_app_id, admob_banner_unit,
        admob_android_banner_unit, admob_ios_banner_unit, network, updated_by, updated_at)
     VALUES (1,?,?,?,?,?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
     ON CONFLICT(id) DO UPDATE SET
       enabled = excluded.enabled,
       android_link = excluded.android_link,
       android_banner = excluded.android_banner,
       ios_link = excluded.ios_link,
       ios_banner = excluded.ios_banner,
       desktop_link = excluded.desktop_link,
       desktop_banner = excluded.desktop_banner,
       admob_app_id = excluded.admob_app_id,
       admob_banner_unit = excluded.admob_banner_unit,
       admob_android_banner_unit = excluded.admob_android_banner_unit,
       admob_ios_banner_unit = excluded.admob_ios_banner_unit,
       network = excluded.network,
       updated_by = excluded.updated_by,
       updated_at = CURRENT_TIMESTAMP`,
    enabled,
    link(body.android_link),
    link(body.android_banner),
    link(body.ios_link),
    link(body.ios_banner),
    link(body.desktop_link),
    link(body.desktop_banner),
    str(body.admob_app_id).trim(),
    str(body.admob_banner_unit).trim(),
    str(body.admob_android_banner_unit).trim(),
    str(body.admob_ios_banner_unit).trim(),
    // Force 'custom' unless AdMob keys are actually supplied — this is what
    // makes AdMob non-mandatory.
    str(body.admob_app_id).trim() && str(body.network) === 'admob' ? 'admob' : 'custom',
    u?.id ?? null,
  );

  const settings = await getAdSettings(c.env.DB);
  return c.json({ ok: true, settings });
});

admin.post('/ads', async (c) => {
  // Convenience alias so clients that can only POST still work.
  const u = c.get('user') as User | undefined;
  if (!isAdmin(u)) return c.json({ ok: false, error: 'forbidden' }, 403);
  const body: any = await c.req.json().catch(() => ({}));
  const fake = new Request(c.req.url, { method: 'PUT', body: JSON.stringify(body), headers: c.req.raw.headers });
  return admin.fetch(fake, c.env, c.executionCtx as any);
});

admin.post('/ads/toggle', async (c) => {
  const u = c.get('user') as User | undefined;
  if (!isAdmin(u)) return c.json({ ok: false, error: 'forbidden' }, 403);
  const body: any = await c.req.json().catch(() => ({}));
  const current = await getAdSettings(c.env.DB);
  const next = body.enabled === undefined ? !current.enabled : !!body.enabled;
  await run(
    c.env.DB,
    `INSERT INTO ad_settings (id, enabled, updated_by, updated_at)
     VALUES (1, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(id) DO UPDATE SET enabled = excluded.enabled, updated_by = excluded.updated_by, updated_at = CURRENT_TIMESTAMP`,
    next ? 1 : 0,
    u?.id ?? null,
  );
  const settings = await getAdSettings(c.env.DB);
  return c.json({ ok: true, enabled: settings.enabled, settings });
});

/* ------------------------------------------------------------------ *
 * Auto-Moderation Bot control panel (admin only)
 * ------------------------------------------------------------------ */
admin.get('/moderation', async (c) => {
  const u = c.get('user') as User | undefined;
  if (!isStaff(u)) return c.json({ ok: false, error: 'forbidden' }, 403);
  const settings = await getModerationSettings(c.env.DB);
  const words = await all<{ id: number; word: string; severity: string }>(
    c.env.DB, 'SELECT id, word, severity FROM blacklist_words ORDER BY id DESC');
  const recent = await all(
    c.env.DB,
    `SELECT l.*, u.full_name, u.handle FROM moderation_log l
     LEFT JOIN users u ON u.id = l.user_id ORDER BY l.id DESC LIMIT 40`);
  const stats = {
    actions: (await one<{ n: number }>(c.env.DB, 'SELECT COUNT(*) AS n FROM moderation_log'))?.n || 0,
    blocked: (await one<{ n: number }>(c.env.DB, "SELECT COUNT(*) AS n FROM moderation_log WHERE action='block'"))?.n || 0,
    masked: (await one<{ n: number }>(c.env.DB, "SELECT COUNT(*) AS n FROM moderation_log WHERE action='mask'"))?.n || 0,
    auto_bans: (await one<{ n: number }>(c.env.DB, "SELECT COUNT(*) AS n FROM moderation_log WHERE action='auto_ban'"))?.n || 0,
    strikes: (await one<{ n: number }>(c.env.DB, 'SELECT COUNT(*) AS n FROM user_strikes'))?.n || 0,
  };
  return c.json({
    ok: true, settings, words, recent, stats,
    builtin_count: BUILTIN_BLOCKLIST.length,
  });
});

admin.put('/moderation', async (c) => {
  const u = c.get('user') as User | undefined;
  if (!isAdmin(u)) return c.json({ ok: false, error: 'forbidden' }, 403);
  const b: any = await c.req.json().catch(() => ({}));
  const cur = await getModerationSettings(c.env.DB);
  const num = (v: any, d: number) => (Number.isFinite(Number(v)) ? Number(v) : d);
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

  await run(
    c.env.DB,
    `INSERT INTO moderation_settings
       (id, enabled, sensitivity, block_links, block_media, auto_ban_hours, mask_offensive, strike_limit, updated_by, updated_at)
     VALUES (1,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP)
     ON CONFLICT(id) DO UPDATE SET
       enabled = excluded.enabled, sensitivity = excluded.sensitivity,
       block_links = excluded.block_links, block_media = excluded.block_media,
       auto_ban_hours = excluded.auto_ban_hours, mask_offensive = excluded.mask_offensive,
       strike_limit = excluded.strike_limit, updated_by = excluded.updated_by,
       updated_at = CURRENT_TIMESTAMP`,
    (b.enabled === undefined ? cur.enabled : !!b.enabled) ? 1 : 0,
    clamp(num(b.sensitivity, cur.sensitivity), 0, 100),
    (b.block_links === undefined ? cur.block_links : !!b.block_links) ? 1 : 0,
    (b.block_media === undefined ? cur.block_media : !!b.block_media) ? 1 : 0,
    clamp(num(b.auto_ban_hours, cur.auto_ban_hours), 0, 8760),
    (b.mask_offensive === undefined ? cur.mask_offensive : !!b.mask_offensive) ? 1 : 0,
    clamp(num(b.strike_limit, cur.strike_limit), 0, 100),
    u?.id ?? null,
  );
  return c.json({ ok: true, settings: await getModerationSettings(c.env.DB) });
});

admin.post('/moderation/toggle', async (c) => {
  const u = c.get('user') as User | undefined;
  if (!isAdmin(u)) return c.json({ ok: false, error: 'forbidden' }, 403);
  const b: any = await c.req.json().catch(() => ({}));
  const cur = await getModerationSettings(c.env.DB);
  const next = b.enabled === undefined ? !cur.enabled : !!b.enabled;
  await run(
    c.env.DB,
    `INSERT INTO moderation_settings (id, enabled, updated_by, updated_at)
     VALUES (1,?,?,CURRENT_TIMESTAMP)
     ON CONFLICT(id) DO UPDATE SET enabled=excluded.enabled, updated_by=excluded.updated_by, updated_at=CURRENT_TIMESTAMP`,
    next ? 1 : 0, u?.id ?? null);
  return c.json({ ok: true, enabled: next });
});

admin.post('/moderation/words', async (c) => {
  const u = c.get('user') as User | undefined;
  if (!isAdmin(u)) return c.json({ ok: false, error: 'forbidden' }, 403);
  const b: any = await c.req.json().catch(() => ({}));
  const word = String(b.word || '').trim().slice(0, 120);
  if (!word) return c.json({ ok: false, error: 'empty_word' }, 400);
  await run(
    c.env.DB,
    `INSERT INTO blacklist_words (word, severity, created_by) VALUES (?,?,?)
     ON CONFLICT(word) DO UPDATE SET severity = excluded.severity`,
    word, ['low', 'medium', 'high'].includes(b.severity) ? b.severity : 'medium', u?.id ?? null);
  return c.json({ ok: true });
});

admin.delete('/moderation/words/:id', async (c) => {
  const u = c.get('user') as User | undefined;
  if (!isAdmin(u)) return c.json({ ok: false, error: 'forbidden' }, 403);
  await run(c.env.DB, 'DELETE FROM blacklist_words WHERE id = ?', Number(c.req.param('id')));
  return c.json({ ok: true });
});

admin.post('/moderation/test', async (c) => {
  const u = c.get('user') as User | undefined;
  if (!isStaff(u)) return c.json({ ok: false, error: 'forbidden' }, 403);
  const b: any = await c.req.json().catch(() => ({}));
  const { moderateMessage } = await import('../lib/moderation');
  const verdict = await moderateMessage(c.env.DB, { body: String(b.body || '') });
  return c.json({ ok: true, verdict });
});

export default admin;
