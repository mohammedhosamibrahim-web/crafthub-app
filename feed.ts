import { Hono } from 'hono';
import type { Env, User } from '../lib/core';
import { all, one, run, publicUser } from '../lib/core';

const feed = new Hono<{ Bindings: Env }>();

type VideoRow = {
  id: number; user_id: number; title: string; description: string; thumbnail: string;
  source_url: string; kind: string; duration: number; views: number; watch_seconds: number;
  likes: number; dislikes: number; is_live: number; created_at: string;
  channel_name: string; channel_handle: string; channel_avatar: string;
  channel_verified: number; channel_profession: string; subscribers: number;
};

const VIDEO_SELECT = `
  SELECT v.*, u.full_name AS channel_name, u.handle AS channel_handle, u.avatar AS channel_avatar,
         u.is_verified AS channel_verified, u.profession_name AS channel_profession,
         u.subscribers AS subscribers
  FROM videos v JOIN users u ON u.id = v.user_id`;

feed.get('/feed', async (c) => {
  const kind = c.req.query('kind');
  const profession = c.req.query('profession');
  const q = (c.req.query('q') || '').trim();
  const limit = Math.min(Number(c.req.query('limit') || 24), 60);

  const where: string[] = ["v.visibility = 'public'"];
  const args: any[] = [];
  if (kind) { where.push('v.kind = ?'); args.push(kind); }
  if (profession) { where.push('u.profession_id = ?'); args.push(profession); }
  if (q) { where.push('(v.title LIKE ? OR v.description LIKE ?)'); args.push(`%${q}%`, `%${q}%`); }

  const rows = await all<VideoRow>(
    c.env.DB,
    `${VIDEO_SELECT} WHERE ${where.join(' AND ')} ORDER BY v.created_at DESC, v.id DESC LIMIT ?`,
    ...args, limit,
  );
  const trending = await all<VideoRow>(
    c.env.DB,
    `${VIDEO_SELECT} WHERE v.visibility='public' ORDER BY v.views DESC LIMIT 8`,
  );
  return c.json({ ok: true, videos: rows, trending });
});

feed.get('/shorts', async (c) => {
  const rows = await all<VideoRow>(
    c.env.DB,
    `${VIDEO_SELECT} WHERE v.kind = 'short' AND v.visibility='public' ORDER BY v.created_at DESC LIMIT 40`,
  );
  return c.json({ ok: true, shorts: rows });
});

feed.get('/live', async (c) => {
  const rows = await all<VideoRow>(
    c.env.DB,
    `${VIDEO_SELECT} WHERE v.is_live = 1 ORDER BY v.created_at DESC LIMIT 30`,
  );
  return c.json({ ok: true, live: rows });
});

feed.get('/videos/:id', async (c) => {
  const id = Number(c.req.param('id'));
  const v = await one<VideoRow>(c.env.DB, `${VIDEO_SELECT} WHERE v.id = ?`, id);
  if (!v) return c.json({ ok: false, error: 'not_found' }, 404);

  const comments = await all(
    c.env.DB,
    `SELECT cm.id, cm.body, cm.created_at, cm.is_removed, u.id AS user_id, u.full_name, u.handle,
            u.avatar, u.is_verified
     FROM comments cm JOIN users u ON u.id = cm.user_id
     WHERE cm.video_id = ? AND cm.is_removed = 0 ORDER BY cm.created_at DESC LIMIT 100`,
    id,
  );

  let myReactions: string[] = [];
  const u = c.get('user') as User | undefined;
  if (u) {
    myReactions = (await all<{ kind: string }>(c.env.DB,
      'SELECT kind FROM reactions WHERE video_id = ? AND user_id = ?', id, u.id)).map((r) => r.kind);
  }
  return c.json({ ok: true, video: v, comments, myReactions });
});

// view + watch time (drives monetization hours)
feed.post('/videos/:id/view', async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json().catch(() => ({} as any));
  const seconds = Math.max(0, Math.min(Number(body.seconds || 0), 4 * 3600));
  const v = await one<{ id: number; user_id: number; kind: string }>(
    c.env.DB, 'SELECT id, user_id, kind FROM videos WHERE id = ?', id);
  if (!v) return c.json({ ok: false, error: 'not_found' }, 404);

  await run(c.env.DB, 'UPDATE videos SET views = views + 1, watch_seconds = watch_seconds + ? WHERE id = ?', seconds, id);
  const u = c.get('user') as User | undefined;
  if (u) await run(c.env.DB, 'INSERT INTO watch_history (user_id, video_id, seconds) VALUES (?,?,?)', u.id, id, seconds);

  // Attribute a small ad revenue slice to the creator (demo accounting model).
  const gross = Math.round((seconds / 3600) * 0.35 * 100) / 100; // RPM-based estimate
  if (gross > 0) {
    const src = v.kind === 'short' ? 'ads_short' : 'ads_long';
    const creator = Math.round(gross * (v.kind === 'short' ? 0.45 : 0.55) * 100) / 100;
    const platform = Math.round((gross - creator) * 100) / 100;
    await run(c.env.DB,
      'INSERT INTO earnings (user_id, video_id, source, gross, creator_share, platform_share) VALUES (?,?,?,?,?,?)',
      v.user_id, id, src, gross, creator, platform);
    await run(c.env.DB,
      `INSERT INTO wallets (user_id, balance, lifetime, cpm, rpm) VALUES (?,?,?,?,?)
       ON CONFLICT(user_id) DO UPDATE SET balance = balance + ?, lifetime = lifetime + ?,
       cpm = cpm + 0, rpm = rpm + ?`,
      v.user_id, creator, creator, 0, gross, creator, creator, gross);
  }
  return c.json({ ok: true });
});

// like / dislike / save
feed.post('/videos/:id/react', async (c) => {
  const u = c.get('user') as User | undefined;
  if (!u) return c.json({ ok: false, error: 'unauthorized' }, 401);
  const id = Number(c.req.param('id'));
  const { kind } = await c.req.json().catch(() => ({ kind: '' }));
  if (!['like', 'dislike', 'save'].includes(kind)) return c.json({ ok: false, error: 'bad_kind' }, 400);

  const existing = await one(c.env.DB,
    'SELECT id FROM reactions WHERE video_id = ? AND user_id = ? AND kind = ?', id, u.id, kind);
  if (existing) {
    await run(c.env.DB, 'DELETE FROM reactions WHERE id = ?', (existing as any).id);
    if (kind === 'like') await run(c.env.DB, 'UPDATE videos SET likes = MAX(likes - 1, 0) WHERE id = ?', id);
    if (kind === 'dislike') await run(c.env.DB, 'UPDATE videos SET dislikes = MAX(dislikes - 1, 0) WHERE id = ?', id);
    return c.json({ ok: true, active: false });
  }
  await run(c.env.DB, 'INSERT INTO reactions (video_id, user_id, kind) VALUES (?,?,?)', id, u.id, kind);
  if (kind === 'like') await run(c.env.DB, 'UPDATE videos SET likes = likes + 1 WHERE id = ?', id);
  if (kind === 'dislike') await run(c.env.DB, 'UPDATE videos SET dislikes = dislikes + 1 WHERE id = ?', id);
  return c.json({ ok: true, active: true });
});

feed.get('/videos/:id/comments', async (c) => {
  const id = Number(c.req.param('id'));
  const comments = await all(
    c.env.DB,
    `SELECT cm.id, cm.body, cm.created_at, u.id AS user_id, u.full_name, u.handle, u.avatar, u.is_verified
     FROM comments cm JOIN users u ON u.id = cm.user_id
     WHERE cm.video_id = ? AND cm.is_removed = 0 ORDER BY cm.created_at DESC LIMIT 100`,
    id,
  );
  return c.json({ ok: true, comments });
});

feed.post('/videos/:id/comments', async (c) => {
  const u = c.get('user') as User | undefined;
  if (!u) return c.json({ ok: false, error: 'unauthorized' }, 401);
  const id = Number(c.req.param('id'));
  const { body } = await c.req.json().catch(() => ({ body: '' }));
  if (!body || !String(body).trim()) return c.json({ ok: false, error: 'empty' }, 400);
  const res = await run(c.env.DB, 'INSERT INTO comments (video_id, user_id, body) VALUES (?,?,?)',
    id, u.id, String(body).trim().slice(0, 2000));
  return c.json({ ok: true, id: res.meta?.last_row_id });
});

// create video / shorts / live
feed.post('/videos', async (c) => {
  const u = c.get('user') as User | undefined;
  if (!u) return c.json({ ok: false, error: 'unauthorized' }, 401);
  const b = await c.req.json().catch(() => ({} as any));
  if (!b.title) return c.json({ ok: false, error: 'missing_title' }, 400);
  const kind = ['long', 'short', 'live'].includes(b.kind) ? b.kind : 'long';
  const res = await run(
    c.env.DB,
    `INSERT INTO videos (user_id, title, description, thumbnail, source_url, kind, duration, is_live)
     VALUES (?,?,?,?,?,?,?,?)`,
    u.id, String(b.title).slice(0, 200), String(b.description || '').slice(0, 5000),
    String(b.thumbnail || ''), String(b.source_url || ''), kind,
    Number(b.duration || 0), kind === 'live' ? 1 : 0,
  );
  return c.json({ ok: true, id: res.meta?.last_row_id });
});

feed.delete('/videos/:id', async (c) => {
  const u = c.get('user') as User | undefined;
  if (!u) return c.json({ ok: false, error: 'unauthorized' }, 401);
  const id = Number(c.req.param('id'));
  const v = await one<{ user_id: number }>(c.env.DB, 'SELECT user_id FROM videos WHERE id = ?', id);
  if (!v) return c.json({ ok: false, error: 'not_found' }, 404);
  if (v.user_id !== u.id && !['admin', 'moderator'].includes(u.role)) {
    return c.json({ ok: false, error: 'forbidden' }, 403);
  }
  await run(c.env.DB, 'DELETE FROM videos WHERE id = ?', id);
  return c.json({ ok: true });
});

export default feed;
