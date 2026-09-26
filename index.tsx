import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import type { Env, User } from './lib/core';
import { one, publicUser, getAdSettings, resolveAdUnit, detectPlatform } from './lib/core';
import { ensureSchema } from './lib/schema';
import { ensureSeed, ensureCriticalBootstrap, SUPER_ADMIN } from './lib/seed';
import authRoutes from './routes/auth';
import feedRoutes from './routes/feed';
import chatRoutes from './routes/chat';
import profileRoutes from './routes/profile';
import moneyRoutes from './routes/money';
import adminRoutes from './routes/admin';
import legalRoutes from './routes/legal';
import { SECTORS, ALL_PROFESSIONS } from './data/professions';
import { COUNTRIES, flagEmoji } from './data/countries';
import { i18nBundle, translate, dirFor, langInfo } from './data/i18n';

const app = new Hono<{ Bindings: Env }>();

app.use('*', logger());
app.use('/api/*', cors());

/* ------------------------------------------------------------------ *
 * Bootstrap + auth middleware. Both are best-effort so the static shell
 * is always reachable even if the database binding is absent.
 * ------------------------------------------------------------------ */
let bootstrapped = false;
app.use('*', async (c, next) => {
  try {
    if (!bootstrapped && c.env?.DB) {
      await ensureSchema(c.env.DB);
      await ensureSeed(c.env.DB);
      await ensureCriticalBootstrap(c.env.DB);
      bootstrapped = true;
    }
  } catch (e) {
    console.error('bootstrap failed', e);
  }
  await next();
});

app.use('*', async (c, next) => {
  const header = c.req.header('Authorization') || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  const qtoken = c.req.query('token') || '';
  const tk = bearer || qtoken;
  if (tk && c.env?.DB) {
    try {
      const user = await one<User>(c.env.DB, 'SELECT * FROM users WHERE token = ?', tk);
      if (user) {
        const ban = await one<{ expires_at: string | null }>(
          c.env.DB,
          'SELECT expires_at FROM bans WHERE user_id = ? AND active = 1 ORDER BY id DESC LIMIT 1',
          user.id,
        );
        c.set('user', user);
        if (ban && (!ban.expires_at || new Date(ban.expires_at).getTime() > Date.now())) {
          c.set('banned', true);
          if (c.req.path.startsWith('/api/') && !c.req.path.startsWith('/api/auth')) {
            return c.json({ ok: false, error: 'banned', message: 'حسابك محظور مؤقتاً' }, 403);
          }
        }
      }
    } catch { /* ignore */ }
  }
  await next();
});

/* ---------------------------- API routes --------------------------- */
app.route('/api/auth', authRoutes);
app.route('/api', feedRoutes);
app.route('/api/chat', chatRoutes);
app.route('/api/legal', legalRoutes);
app.route('/api', profileRoutes);
app.route('/api', moneyRoutes);
app.route('/api/admin', adminRoutes);

/**
 * Master Super Admin bootstrap info.
 *
 * Always reports that an admin exists. The login secret is returned ONLY when
 * the caller is already an authenticated admin, so a fresh operator can read it
 * from the console; anonymous visitors never see it.
 */
app.get('/api/admin/ssup', async (c) => {
  const me = c.get('user') as User | undefined;
  const isAdmin = me?.role === 'admin';
  return c.json({
    ok: true,
    admin_exists: true,
    credentials: {
      phone: SUPER_ADMIN.phone,
      email: SUPER_ADMIN.email,
      secret: isAdmin ? SUPER_ADMIN.secret : null,
      login_dial: '+20',
      login_national: '1000000000',
    },
    note: 'Master Super Admin has unrestricted access to every room and profession.',
  });
});

app.get('/api/health', (c) => c.json({ ok: true, service: 'CraftHub', ts: Date.now() }));

/**
 * Public ad unit resolver.
 *
 * Returns the ad unit the current client should show. It is deliberately
 * tolerant: if nothing is configured (or the DB is unavailable), it answers
 * { ok: true, enabled: false } with HTTP 200 — the app never shows an error
 * and never prompts for AdMob API keys.
 *
 * Platform can be overridden with ?platform=android|ios|desktop so the native
 * shells (Capacitor Android / iOS, Tauri desktop) can request their own unit.
 */
app.get('/api/ads', async (c) => {
  const override = (c.req.query('platform') || '').toLowerCase();
  const platform =
    override === 'android' || override === 'ios' || override === 'desktop'
      ? (override as 'android' | 'ios' | 'desktop')
      : detectPlatform(c.req.header('User-Agent') || '');
  try {
    if (!c.env?.DB) return c.json({ ok: true, enabled: false, source: 'none', platform });
    const settings = await getAdSettings(c.env.DB);
    const unit = resolveAdUnit(settings, platform);
    return c.json({ ok: true, ...unit });
  } catch {
    return c.json({ ok: true, enabled: false, source: 'none', platform });
  }
});


// Bootstrap payload for the SPA
app.get('/api/bootstrap', async (c) => {
  const me = c.get('user') as User | undefined;
  let notifications: any[] = [];
  if (c.env?.DB) {
    try {
      notifications = (await c.env.DB
        .prepare('SELECT * FROM notifications WHERE is_broadcast = 1 OR user_id = ? ORDER BY created_at DESC LIMIT 20')
        .bind(me?.id ?? -1)
        .all()).results as any[];
    } catch { /* ignore */ }
  }
  return c.json({
    ok: true,
    user: publicUser(me ?? null),
    countries: COUNTRIES.map((x) => ({ ...x, flag: flagEmoji(x.iso) })),
    sectors: SECTORS,
    total_professions: ALL_PROFESSIONS.length,
    i18n: i18nBundle(),
    legal_ok: true,
    notifications,
  });
});

/* --------------------------- HTML shell ---------------------------- */
function shell(): string {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<title>CraftHub — منصة المهن العالمية</title>
<meta name="description" content="CraftHub — منصة فيديو ومجتمعات مهنية عالمية: تواصل، شارك، واربح." />
<meta name="theme-color" content="#0F0F0F" />
<link rel="manifest" href="/static/manifest.webmanifest" />
<link rel="icon" href="/static/icon.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="/static/icon-192.png" />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.5.2/css/all.min.css" />
<link rel="stylesheet" href="/static/styles.css" />
</head>
<body>
<div id="app" class="app-root" aria-live="polite"></div>
<div id="toast-host" class="toast-host" aria-live="assertive"></div>
<script src="/static/app.js" type="module"></script>
</body>
</html>`;
}

app.get('/', (c) => c.html(shell()));
app.get('/index.html', (c) => c.html(shell()));

// SPA fallback for client routes
app.get('*', (c) => {
  const p = c.req.path;
  if (p.startsWith('/api/')) return c.json({ ok: false, error: 'not_found' }, 404);
  if (p.startsWith('/static/')) return c.notFound();
  return c.html(shell());
});

// helper exports for potential SSR use / tests
export { translate, dirFor, langInfo };

export default app;
