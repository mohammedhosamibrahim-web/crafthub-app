import { Hono } from 'hono';
import type { Env, User } from '../lib/core';
import { all, one, run, publicUser, monetizationEligible } from '../lib/core';
import { COUNTRIES, flagEmoji } from '../data/countries';
import { professionById, sectorById, sectorOfProfession } from '../data/professions';

const profile = new Hono<{ Bindings: Env }>();

// Public channel profile (YouTube-style)
profile.get('/channel/:handle', async (c) => {
  const handle = c.req.param('handle');
  const u = await one<User>(c.env.DB, 'SELECT * FROM users WHERE handle = ?', handle);
  if (!u) return c.json({ ok: false, error: 'not_found' }, 404);

  const me = c.get('user') as User | undefined;
  const videos = await all(
    c.env.DB,
    `SELECT id, title, thumbnail, kind, views, likes, duration, is_live, created_at
     FROM videos WHERE user_id = ? AND visibility='public' ORDER BY created_at DESC LIMIT 60`,
    u.id,
  );
  const playlists = await all(c.env.DB, 'SELECT * FROM playlists WHERE user_id = ?', u.id);
  const isSubscribed = me
    ? !!(await one(c.env.DB, 'SELECT id FROM subscriptions WHERE channel_id = ? AND user_id = ?', u.id, me.id))
    : false;

  const watchHours = Math.round(((await one<{ s: number }>(c.env.DB,
    'SELECT COALESCE(SUM(watch_seconds),0) AS s FROM videos WHERE user_id = ?', u.id))?.s || 0) / 3600);
  const shortViews = ((await all<{ v: number }>(c.env.DB,
    'SELECT views AS v FROM videos WHERE user_id = ? AND kind = \'short\'', u.id)) || [])
    .reduce((a, b) => a + (b.v || 0), 0);
  const elig = monetizationEligible(u, watchHours, shortViews);

  return c.json({
    ok: true,
    channel: {
      id: u.id,
      full_name: u.full_name,
      handle: u.handle,
      avatar: u.avatar,
      banner: u.banner,
      bio: u.bio,
      profession_name: u.profession_name,
      sector_name: u.sector_name,
      subscribers: u.subscribers,
      is_verified: u.is_verified,
      is_company: u.is_company,
      role: u.role,
      created_at: u.created_at,
    },
    stats: {
      videos: videos.length,
      videos_count: videos.filter((v: any) => v.kind === 'long').length,
      shorts_count: videos.filter((v: any) => v.kind === 'short').length,
      live_count: videos.filter((v: any) => v.is_live).length,
      views: videos.reduce((a: number, b: any) => a + (b.views || 0), 0),
      watch_hours: watchHours,
      short_views: shortViews,
    },
    monetization: elig,
    subscribers: u.subscribers,
    is_subscribed: isSubscribed,
    is_owner: !!me && me.id === u.id,
    videos,
    playlists,
  });
});

// My own profile
profile.get('/me/channel', async (c) => {
  const u = c.get('user') as User | undefined;
  if (!u) return c.json({ ok: false, error: 'unauthorized' }, 401);
  return c.redirect(`/api/channel/${u.handle}`, 307);
});

// Update channel info
profile.put('/me/channel', async (c) => {
  const u = c.get('user') as User | undefined;
  if (!u) return c.json({ ok: false, error: 'unauthorized' }, 401);
  const b = await c.req.json().catch(() => ({} as any));

  let country_code = u.country_code;
  let country_name = u.country_name;
  if (b.dial) {
    let d = String(b.dial);
    if (!d.startsWith('+')) d = '+' + d.replace(/[^0-9]/g, '');
    const cn = COUNTRIES.find((x) => `+${String(x.dial).replace(/[^0-9]/g, '')}` === d);
    if (cn) { country_code = d; country_name = `${flagEmoji(cn.iso)} ${cn.name}`; }
  }

  let profession_id = u.profession_id;
  let profession_name = u.profession_name;
  let sector_id = u.sector_id;
  let sector_name = u.sector_name;
  if (b.profession_id) {
    const p = professionById(String(b.profession_id));
    if (p) {
      profession_id = p.id;
      profession_name = p.ar;
      const s = sectorById(String(b.sector_id || '')) || sectorOfProfession(p.id);
      if (s) { sector_id = s.id; sector_name = s.ar; }
    }
  }

  await run(
    c.env.DB,
    `UPDATE users SET full_name = COALESCE(?, full_name), bio = COALESCE(?, bio),
      avatar = COALESCE(?, avatar), banner = COALESCE(?, banner),
      country_code = ?, country_name = ?, profession_id = ?, profession_name = ?,
      sector_id = ?, sector_name = ?, is_company = COALESCE(?, is_company),
      tax_id = COALESCE(?, tax_id) WHERE id = ?`,
    b.full_name ?? null, b.bio ?? null, b.avatar ?? null, b.banner ?? null,
    country_code, country_name, profession_id, profession_name, sector_id, sector_name,
    b.is_company === undefined ? null : (b.is_company ? 1 : 0), b.tax_id ?? null, u.id,
  );
  const updated = await one<User>(c.env.DB, 'SELECT * FROM users WHERE id = ?', u.id);
  return c.json({ ok: true, user: publicUser(updated) });
});

function require0(professionId: string) {
  // helper: find the sector that owns a profession
  const { SECTORS } = require('../data/professions') as any;
  return undefined;
}

// Subscribe / unsubscribe
profile.post('/channel/:handle/subscribe', async (c) => {
  const me = c.get('user') as User | undefined;
  if (!me) return c.json({ ok: false, error: 'unauthorized' }, 401);
  const target = await one<User>(c.env.DB, 'SELECT * FROM users WHERE handle = ?', c.req.param('handle'));
  if (!target) return c.json({ ok: false, error: 'not_found' }, 404);
  if (target.id === me.id) return c.json({ ok: false, error: 'self' }, 400);

  const existing = await one(c.env.DB, 'SELECT id FROM subscriptions WHERE channel_id = ? AND user_id = ?', target.id, me.id);
  if (existing) {
    await run(c.env.DB, 'DELETE FROM subscriptions WHERE id = ?', (existing as any).id);
    await run(c.env.DB, 'UPDATE users SET subscribers = MAX(subscribers - 1, 0) WHERE id = ?', target.id);
    const fresh = await one<{ subscribers: number }>(c.env.DB, 'SELECT subscribers FROM users WHERE id = ?', target.id);
    return c.json({ ok: true, subscribed: false, subscribers: fresh?.subscribers ?? 0 });
  }
  await run(c.env.DB, 'INSERT INTO subscriptions (channel_id, user_id) VALUES (?,?)', target.id, me.id);
  await run(c.env.DB, 'UPDATE users SET subscribers = subscribers + 1 WHERE id = ?', target.id);
  const fresh = await one<{ subscribers: number }>(c.env.DB, 'SELECT subscribers FROM users WHERE id = ?', target.id);
  return c.json({ ok: true, subscribed: true, subscribers: fresh?.subscribers ?? 0 });
});

// Recommended channels (same sector / profession)
profile.get('/channels', async (c) => {
  const me = c.get('user') as User | undefined;
  const rows = await all<User>(
    c.env.DB,
    `SELECT id, full_name, handle, avatar, profession_name, sector_id, subscribers, is_verified
     FROM users ORDER BY subscribers DESC LIMIT 30`,
  );
  const mine = me ? rows.filter((r: any) => r.sector_id === me.sector_id && r.id !== me.id) : [];
  return c.json({ ok: true, channels: rows, same_sector: mine.slice(0, 8) });
});

// Playlists
profile.post('/playlists', async (c) => {
  const u = c.get('user') as User | undefined;
  if (!u) return c.json({ ok: false, error: 'unauthorized' }, 401);
  const { title } = await c.req.json().catch(() => ({ title: '' }));
  if (!title) return c.json({ ok: false, error: 'missing_title' }, 400);
  const res = await run(c.env.DB, 'INSERT INTO playlists (user_id, title) VALUES (?,?)', u.id, String(title));
  return c.json({ ok: true, id: res.meta?.last_row_id });
});

profile.post('/playlists/:id/items', async (c) => {
  const u = c.get('user') as User | undefined;
  if (!u) return c.json({ ok: false, error: 'unauthorized' }, 401);
  const pid = Number(c.req.param('id'));
  const { video_id } = await c.req.json().catch(() => ({ video_id: 0 }));
  const pl = await one<{ user_id: number }>(c.env.DB, 'SELECT user_id FROM playlists WHERE id = ?', pid);
  if (!pl || pl.user_id !== u.id) return c.json({ ok: false, error: 'forbidden' }, 403);
  await run(c.env.DB, 'INSERT OR IGNORE INTO playlist_items (playlist_id, video_id) VALUES (?,?)', pid, Number(video_id));
  return c.json({ ok: true });
});

export default profile;
