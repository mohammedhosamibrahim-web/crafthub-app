import { Hono } from 'hono';
import type { Env, User } from '../lib/core';
import { all, one, run } from '../lib/core';
import { moderateMessage, recordModeration } from '../lib/moderation';
import { sectorById, professionById } from '../data/professions';

const chat = new Hono<{ Bindings: Env }>();

/* ------------------------------------------------------------------ *
 * Room visibility rules
 *  - 'general' room + 'sector:*' rooms: everyone
 *  - professional room (profession_id = <prof>): only that profession
 *  - 'general' profession users: ONLY the general room
 * ------------------------------------------------------------------ */
export function canEnterRoom(user: User, room: { profession_id: string; sector_id: string }) {
  // Master Super Admin bypasses ALL restrictions — every room, every sector,
  // public or private, with no limits.
  if (user.role === 'admin') return { ok: true, superuser: true };
  if (room.profession_id === 'general') return { ok: true };
  if (user.profession_id === 'general') {
    return { ok: false, room: room.profession_id };
  }
  if (room.profession_id === user.profession_id) return { ok: true };
  if (room.profession_id === `sector:${room.sector_id}` && user.sector_id === room.sector_id) return { ok: true };
  return { ok: false, room: room.profession_id };
}


/**
 * Exact denial copy required by spec §2:
 *   غير مصلوح لك بالدخول، هذا المجتمع مخصص لأصحاب مهنة [اسم المهنة] فقط
 */
export function deniedMessage(professionName: string) {
  return `غير مصلوح لك بالدخول، هذا المجتمع مخصص لأصحاب مهنة ${professionName} فقط`;
}

// List rooms with membership/access info
chat.get('/rooms', async (c) => {
  const u = c.get('user') as User | undefined;
  const rooms = await all<any>(c.env.DB, 'SELECT * FROM rooms ORDER BY id ASC');
  const counts = await all<{ room_id: number; n: number }>(
    c.env.DB, 'SELECT room_id, COUNT(*) AS n FROM room_members GROUP BY room_id');
  const countMap = new Map(counts.map((x) => [x.room_id, x.n]));

  let joined = new Set<number>();
  if (u) {
    const m = await all<{ room_id: number }>(c.env.DB, 'SELECT room_id FROM room_members WHERE user_id = ?', u.id);
    joined = new Set(m.map((x) => x.room_id));
  }

  const out = rooms.map((r) => {
    const access = u ? canEnterRoom(u, r) : { ok: true };
    return {
      ...r,
      member_count: countMap.get(r.id) || 0,
      joined: joined.has(r.id),
      can_enter: access.ok,
      required_profession: access.ok ? null : (access as any).room,
    };
  });
  return c.json({ ok: true, rooms: out });
});

chat.get('/rooms/:slug', async (c) => {
  const u = c.get('user') as User | undefined;
  const slug = c.req.param('slug');
  const room = await one<any>(c.env.DB, 'SELECT * FROM rooms WHERE slug = ?', slug);
  if (!room) return c.json({ ok: false, error: 'not_found' }, 404);

  const access = u ? canEnterRoom(u, room) : { ok: true };
  if (!access.ok) {
    let profName = (access as any).room;
    const sec = sectorById(String(profName));
    if (sec) profName = sec.ar;
    const pfr = professionById(String((access as any).room));
    if (pfr) profName = pfr.ar;
    return c.json({
      ok: false,
      error: 'access_denied',
      required_profession: profName,
      message: deniedMessage(profName),
    }, 403);
  }
  const members = await all(
    c.env.DB,
    `SELECT u.id, u.full_name, u.handle, u.avatar, u.profession_name, u.is_verified, u.role
     FROM room_members m JOIN users u ON u.id = m.user_id WHERE m.room_id = ? ORDER BY u.full_name`,
    room.id,
  );
  return c.json({ ok: true, room, members });
});

chat.post('/rooms/:slug/join', async (c) => {
  const u = c.get('user') as User | undefined;
  if (!u) return c.json({ ok: false, error: 'unauthorized' }, 401);
  const room = await one<any>(c.env.DB, 'SELECT * FROM rooms WHERE slug = ?', c.req.param('slug'));
  if (!room) return c.json({ ok: false, error: 'not_found' }, 404);
  const access = canEnterRoom(u, room);
  if (!access.ok) {
    let profName = (access as any).room;
    const sec = sectorById(String(profName));
    if (sec) profName = sec.ar;
    const pfr = professionById(String((access as any).room));
    if (pfr) profName = pfr.ar;
    return c.json({
      ok: false,
      error: 'access_denied',
      required_profession: profName,
      message: deniedMessage(profName),
    }, 403);
  }
  await run(c.env.DB, 'INSERT OR IGNORE INTO room_members (room_id, user_id) VALUES (?,?)', room.id, u.id);
  return c.json({ ok: true, joined: true });
});

chat.post('/rooms/:slug/leave', async (c) => {
  const u = c.get('user') as User | undefined;
  if (!u) return c.json({ ok: false, error: 'unauthorized' }, 401);
  const room = await one<any>(c.env.DB, 'SELECT * FROM rooms WHERE slug = ?', c.req.param('slug'));
  if (!room) return c.json({ ok: false, error: 'not_found' }, 404);
  await run(c.env.DB, 'DELETE FROM room_members WHERE room_id = ? AND user_id = ?', room.id, u.id);
  return c.json({ ok: true, joined: false });
});

// Messages
chat.get('/rooms/:slug/messages', async (c) => {
  const u = c.get('user') as User | undefined;
  if (!u) return c.json({ ok: false, error: 'unauthorized' }, 401);
  const room = await one<any>(c.env.DB, 'SELECT * FROM rooms WHERE slug = ?', c.req.param('slug'));
  if (!room) return c.json({ ok: false, error: 'not_found' }, 404);
  const access = canEnterRoom(u, room);
  if (!access.ok) {
    let profName = (access as any).room;
    const sec = sectorById(String(profName));
    if (sec) profName = sec.ar;
    const pfr = professionById(String((access as any).room));
    if (pfr) profName = pfr.ar;
    return c.json({
      ok: false,
      error: 'access_denied',
      required_profession: profName,
      message: deniedMessage(profName),
    }, 403);
  }
  const after = Number(c.req.query('after') || 0);
  const rows = await all(
    c.env.DB,
    `SELECT m.id, m.type, m.body, m.media_url, m.file_name, m.reply_to, m.deleted_for_all, m.created_at,
            u.id AS user_id, u.full_name, u.handle, u.avatar, u.is_verified,
            r.body AS reply_body, ru.full_name AS reply_name
     FROM messages m
     JOIN users u ON u.id = m.user_id
     LEFT JOIN messages r ON r.id = m.reply_to
     LEFT JOIN users ru ON ru.id = r.user_id
     WHERE m.room_id = ? AND m.id > ?
       AND m.id NOT IN (SELECT message_id FROM message_hides WHERE user_id = ?)
     ORDER BY m.id ASC LIMIT 200`,
    room.id, after, u.id,
  );
  return c.json({ ok: true, messages: rows, room_paused: !!room.is_paused });
});

chat.post('/rooms/:slug/messages', async (c) => {
  const u = c.get('user') as User | undefined;
  if (!u) return c.json({ ok: false, error: 'unauthorized' }, 401);
  const room = await one<any>(c.env.DB, 'SELECT * FROM rooms WHERE slug = ?', c.req.param('slug'));
  if (!room) return c.json({ ok: false, error: 'not_found' }, 404);
  const access = canEnterRoom(u, room);
  if (!access.ok) {
    let profName = String((access as any).room || '');
    const sec2 = sectorById(profName); if (sec2) profName = sec2.ar;
    const pfr2 = professionById(String((access as any).room)); if (pfr2) profName = pfr2.ar;
    return c.json({
      ok: false, error: 'access_denied',
      required_profession: profName,
      message: deniedMessage(profName),
    }, 403);
  }
  if (room.is_paused && !['admin', 'moderator'].includes(u.role)) {
    return c.json({ ok: false, error: 'paused', message: 'المحادثة موقوفة مؤقتاً' }, 423);
  }
  const b = await c.req.json().catch(() => ({} as any));
  const type = ['text', 'image', 'video', 'audio', 'file', 'sticker'].includes(b.type) ? b.type : 'text';
  if (type === 'text' && !String(b.body || '').trim()) {
    return c.json({ ok: false, error: 'empty' }, 400);
  }

  /* ---- Auto-moderation bot -------------------------------------------
   * Admins/moderators bypass the bot so staff can never be auto-blocked.
   * A bot failure must never block a legitimate message, so this is wrapped. */
  let safeBody = String(b.body || '').slice(0, 5000);
  if (!['admin', 'moderator'].includes(u.role)) {
    try {
      const verdict = await moderateMessage(c.env.DB, {
        body: safeBody,
        kind: type,
        has_media: !!b.media_url,
      });
      if (verdict.action !== 'allow') {
        await recordModeration(c.env.DB, {
          roomId: room.id, userId: u.id,
          action: verdict.action,
          matched: verdict.matched,
          reason: verdict.reasons.join(','),
        });
      }
      if (verdict.blocked) {
        return c.json({
          ok: false,
          error: 'moderation_blocked',
          masked: verdict.clean || '',
          matched: verdict.matched,
          reasons: verdict.reasons,
          message: 'تم حذف رسالتك تلقائياً بواسطة بوت الإشراف لمخالفتها قواعد المجتمع.',
        }, 422);
      }
      safeBody = verdict.clean;
    } catch { /* bot must never break chat */ }
  }

  const res = await run(
    c.env.DB,
    'INSERT INTO messages (room_id, user_id, type, body, media_url, file_name, reply_to) VALUES (?,?,?,?,?,?,?)',
    room.id, u.id, type, safeBody, String(b.media_url || ''),
    String(b.file_name || ''), b.reply_to ? Number(b.reply_to) : null,
  );
  const msg = await one(c.env.DB,
    `SELECT m.id, m.type, m.body, m.media_url, m.file_name, m.reply_to, m.created_at,
            u.id AS user_id, u.full_name, u.handle, u.avatar, u.is_verified
     FROM messages m JOIN users u ON u.id = m.user_id WHERE m.id = ?`, res.meta?.last_row_id);
  return c.json({ ok: true, message: msg });
});

// Delete for me / for everyone
chat.post('/messages/:id/delete', async (c) => {
  const u = c.get('user') as User | undefined;
  if (!u) return c.json({ ok: false, error: 'unauthorized' }, 401);
  const id = Number(c.req.param('id'));
  const { scope } = await c.req.json().catch(() => ({ scope: 'me' }));
  const m = await one<{ user_id: number }>(c.env.DB, 'SELECT user_id FROM messages WHERE id = ?', id);
  if (!m) return c.json({ ok: false, error: 'not_found' }, 404);

  if (scope === 'all') {
    if (m.user_id !== u.id && !['admin', 'moderator'].includes(u.role)) {
      return c.json({ ok: false, error: 'forbidden' }, 403);
    }
    await run(c.env.DB, "UPDATE messages SET deleted_for_all = 1, body = '', media_url = '' WHERE id = ?", id);
  } else {
    await run(c.env.DB, 'INSERT OR IGNORE INTO message_hides (message_id, user_id) VALUES (?,?)', id, u.id);
  }
  return c.json({ ok: true });
});

// Clear an entire conversation for the current user only
chat.post('/rooms/:slug/clear', async (c) => {
  const u = c.get('user') as User | undefined;
  if (!u) return c.json({ ok: false, error: 'unauthorized' }, 401);
  const room = await one<any>(c.env.DB, 'SELECT * FROM rooms WHERE slug = ?', c.req.param('slug'));
  if (!room) return c.json({ ok: false, error: 'not_found' }, 404);
  const ids = await all<{ id: number }>(c.env.DB, 'SELECT id FROM messages WHERE room_id = ?', room.id);
  for (const row of ids) {
    await run(c.env.DB, 'INSERT OR IGNORE INTO message_hides (message_id, user_id) VALUES (?,?)', row.id, u.id);
  }
  return c.json({ ok: true, cleared: ids.length });
});

// Mute room notifications
chat.post('/rooms/:slug/mute', async (c) => {
  const u = c.get('user') as User | undefined;
  if (!u) return c.json({ ok: false, error: 'unauthorized' }, 401);
  const { muted } = await c.req.json().catch(() => ({ muted: true }));
  const room = await one<any>(c.env.DB, 'SELECT * FROM rooms WHERE slug = ?', c.req.param('slug'));
  if (!room) return c.json({ ok: false, error: 'not_found' }, 404);
  await run(c.env.DB, 'INSERT OR IGNORE INTO room_members (room_id, user_id) VALUES (?,?)', room.id, u.id);
  await run(c.env.DB, 'UPDATE room_members SET muted = ? WHERE room_id = ? AND user_id = ?',
    muted ? 1 : 0, room.id, u.id);
  return c.json({ ok: true, muted: !!muted });
});

// Admin/moderator member management
chat.post('/rooms/:slug/members', async (c) => {
  const u = c.get('user') as User | undefined;
  if (!u) return c.json({ ok: false, error: 'unauthorized' }, 401);
  if (!['admin', 'moderator'].includes(u.role)) return c.json({ ok: false, error: 'forbidden' }, 403);
  const room = await one<any>(c.env.DB, 'SELECT * FROM rooms WHERE slug = ?', c.req.param('slug'));
  if (!room) return c.json({ ok: false, error: 'not_found' }, 404);
  const { action, user_id } = await c.req.json().catch(() => ({} as any));
  const targetId = Number(user_id);
  if (!targetId) return c.json({ ok: false, error: 'missing_user' }, 400);

  if (action === 'add') {
    await run(c.env.DB, 'INSERT OR IGNORE INTO room_members (room_id, user_id) VALUES (?,?)', room.id, targetId);
    return c.json({ ok: true, action: 'added' });
  }
  if (action === 'remove') {
    await run(c.env.DB, 'DELETE FROM room_members WHERE room_id = ? AND user_id = ?', room.id, targetId);
    return c.json({ ok: true, action: 'removed' });
  }
  return c.json({ ok: false, error: 'bad_action' }, 400);
});

// Pause / resume room
chat.post('/rooms/:slug/pause', async (c) => {
  const u = c.get('user') as User | undefined;
  if (!u || u.role !== 'admin') return c.json({ ok: false, error: 'forbidden' }, 403);
  const room = await one<any>(c.env.DB, 'SELECT * FROM rooms WHERE slug = ?', c.req.param('slug'));
  if (!room) return c.json({ ok: false, error: 'not_found' }, 404);
  const { paused, reason } = await c.req.json().catch(() => ({ paused: true }));
  await run(c.env.DB, 'UPDATE rooms SET is_paused = ?, paused_reason = ? WHERE id = ?',
    paused ? 1 : 0, String(reason || ''), room.id);
  return c.json({ ok: true, paused: !!paused });
});

// Create room (admin)
chat.post('/rooms', async (c) => {
  const u = c.get('user') as User | undefined;
  if (!u || u.role !== 'admin') return c.json({ ok: false, error: 'forbidden' }, 403);
  const b = await c.req.json().catch(() => ({} as any));
  if (!b.name || !b.slug) return c.json({ ok: false, error: 'missing_fields' }, 400);
  const slug = String(b.slug).toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 40);
  await run(c.env.DB,
    'INSERT INTO rooms (name, slug, profession_id, sector_id, description, is_public) VALUES (?,?,?,?,?,?)',
    String(b.name).slice(0, 100), slug, String(b.profession_id || 'general'),
    String(b.sector_id || 'general'), String(b.description || ''), 1);
  const room = await one(c.env.DB, 'SELECT * FROM rooms WHERE slug = ?', slug);
  return c.json({ ok: true, room });
});

export default chat;
