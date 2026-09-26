/**
 * CraftHub Auto-Moderation Bot
 *
 * Runs on every room message before it is persisted. It never throws: a bot
 * failure must never block a legitimate message, and it must never crash the
 * chat. Results are returned so the caller can decide to block or persist.
 */
import { all, one, run } from './core';

export type ModerationSettings = {
  enabled: boolean;
  sensitivity: number;      // 0..100
  block_links: boolean;
  block_media: boolean;
  auto_ban_hours: number;   // 0 = never auto-ban
  mask_offensive: boolean;  // replace the offending token with ***
  strike_limit: number;     // strikes before auto-ban
};

export const DEFAULT_MODERATION: ModerationSettings = {
  enabled: true,
  sensitivity: 50,
  block_links: true,
  block_media: false,
  auto_ban_hours: 0,
  mask_offensive: true,
  strike_limit: 3,
};

/** Built-in baseline list. Admins add/remove their own on top of this. */
export const BUILTIN_BLOCKLIST: string[] = [
  // Arabic profanity (kept intentionally mild / representative)
  'كلب', 'حمار', 'غبي', 'احمق', 'أحمق', 'تافه', 'خرا', 'زبالة', 'قذر', 'حقير',
  'لعنة', 'تبا', 'يا ابن', 'شرموط', 'عاهر', 'كسم',
  // English profanity
  'fuck', 'shit', 'bitch', 'bastard', 'asshole', 'dick', 'cunt', 'whore',
  'slut', 'retard', 'nigger', 'faggot',
  // Spam / scam markers
  'free money', 'click here', 'make money fast', 'crypto giveaway',
  'ربح سريع', 'استثمار مضمون', 'اضغط هنا', 'أرباح مضمونة',
];

/** Links / promo patterns. Applied when block_links is on. */
const LINK_RE = /(https?:\/\/|www\.)\S+/gi;
const CONTACT_RE = /(\+?\d[\d\s\-().]{7,}\d)|(\b\w+@\w+\.\w{2,}\b)/g;

export function maskWord(text: string, word: string): string {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(escaped, 'gi'), '*'.repeat(Math.max(3, word.length)));
}

export async function getModerationSettings(db: D1Database): Promise<ModerationSettings> {
  try {
    const row = await one<any>(db, 'SELECT * FROM moderation_settings WHERE id = 1');
    if (!row) return { ...DEFAULT_MODERATION };
    return {
      enabled: !!row.enabled,
      sensitivity: Number(row.sensitivity ?? 50),
      block_links: !!row.block_links,
      block_media: !!row.block_media,
      auto_ban_hours: Number(row.auto_ban_hours ?? 0),
      mask_offensive: !!row.mask_offensive,
      strike_limit: Number(row.strike_limit ?? 3),
    };
  } catch {
    return { ...DEFAULT_MODERATION };
  }
}

export async function getBlacklist(db: D1Database): Promise<string[]> {
  try {
    const rows = await all<{ word: string }>(db, 'SELECT word FROM blacklist_words');
    const custom = rows.map((r) => r.word).filter(Boolean);
    // Built-ins first, then admin additions (de-duplicated case-insensitively).
    const seen = new Set<string>();
    const out: string[] = [];
    for (const w of [...BUILTIN_BLOCKLIST, ...custom]) {
      const k = w.toLowerCase();
      if (!seen.has(k)) { seen.add(k); out.push(w); }
    }
    return out;
  } catch {
    return [...BUILTIN_BLOCKLIST];
  }
}

export type ModerationVerdict = {
  blocked: boolean;
  clean: string;          // text safe to display/persist
  matched: string[];
  reasons: string[];
  action: 'allow' | 'mask' | 'block';
};

/**
 * Inspects a message. Pure-ish (reads settings + blacklist, writes nothing).
 *
 * sensitivity 0..100 maps to how aggressively we treat a match:
 *   >= 80 -> any match blocks
 *   >= 40 -> first match masks, 2+ matches block
 *   <  40 -> matches are masked only
 * Link/contact spam is judged separately from profanity.
 */
export async function moderateMessage(
  db: D1Database,
  input: { body?: string; kind?: string; has_media?: boolean },
): Promise<ModerationVerdict> {
  const settings = await getModerationSettings(db);
  const text = String(input.body || '');
  const cleanBase = { clean: text, matched: [] as string[], reasons: [] as string[] };

  if (!settings.enabled) {
    return { ...cleanBase, blocked: false, action: 'allow' };
  }

  const words = await getBlacklist(db);
  const matched: string[] = [];
  let out = text;

  for (const w of words) {
    if (!w) continue;
    let hit = false;
    try {
      const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      hit = new RegExp(escaped, 'i').test(text);
    } catch { hit = text.toLowerCase().includes(w.toLowerCase()); }
    if (hit) {
      matched.push(w);
      if (settings.mask_offensive) out = maskWord(out, w);
    }
  }

  const reasons: string[] = [];
  if (matched.length) reasons.push('profanity');

  // Link / contact spam
  let linkHits = 0;
  if (settings.block_links) {
    linkHits = (text.match(LINK_RE) || []).length + (text.match(CONTACT_RE) || []).length;
    if (linkHits) {
      reasons.push('link_spam');
      out = out.replace(LINK_RE, '•••').replace(CONTACT_RE, '•••');
    }
  }

  // Media policy
  if (settings.block_media && input.has_media) reasons.push('media_blocked');

  const s = settings.sensitivity;
  let action: 'allow' | 'mask' | 'block' = 'allow';

  if (reasons.includes('media_blocked')) {
    action = 'block';
  } else if (linkHits > 0 && linkHits >= (s >= 70 ? 1 : 2)) {
    action = 'block';
  } else if (matched.length) {
    if (s >= 80) action = 'block';
    else if (s >= 40) action = matched.length >= 2 ? 'block' : 'mask';
    else action = 'mask';
  }

  return {
    blocked: action === 'block',
    clean: action === 'block' ? '' : out,
    matched,
    reasons,
    action,
  };
}

/** Records a moderation action + a strike, and auto-bans when the limit is hit. */
export async function recordModeration(
  db: D1Database,
  args: {
    roomId?: number; userId?: number; messageId?: number;
    action: string; matched?: string[]; reason?: string;
  },
): Promise<{ banned: boolean; strikes: number }> {
  try {
    await run(
      db,
      'INSERT INTO moderation_log (room_id, user_id, message_id, action, matched, reason) VALUES (?,?,?,?,?,?)',
      args.roomId ?? null,
      args.userId ?? null,
      args.messageId ?? null,
      args.action,
      (args.matched || []).join(','),
      args.reason || '',
    );

    if (args.action === 'allow' || !args.userId) return { banned: false, strikes: 0 };

    await run(
      db,
      'INSERT INTO user_strikes (user_id, room_id, reason) VALUES (?,?,?)',
      args.userId, args.roomId ?? null, args.reason || '',
    );

    const settings = await getModerationSettings(db);
    const row = await one<{ n: number }>(
      db,
      'SELECT COUNT(*) AS n FROM user_strikes WHERE user_id = ?',
      args.userId,
    );
    const strikes = row?.n || 0;

    const limit = settings.strike_limit > 0 ? settings.strike_limit : 999;
    if (settings.auto_ban_hours > 0 && strikes >= limit) {
      const expires = new Date(Date.now() + settings.auto_ban_hours * 3600 * 1000)
        .toISOString().replace('T', ' ').slice(0, 19);
      await run(
        db,
        `INSERT INTO bans (user_id, issued_by, reason, hours, expires_at, active)
         VALUES (?, 0, ?, ?, ?, 1)`,
        args.userId,
        'حظر تلقائي من بوت الإشراف',
        settings.auto_ban_hours,
        expires,
      );
      await run(
        db,
        'INSERT INTO moderation_log (user_id, action, reason) VALUES (?,?,?)',
        args.userId, 'auto_ban', `strikes=${strikes}`,
      );
      return { banned: true, strikes };
    }

    return { banned: false, strikes };
  } catch {
    return { banned: false, strikes: 0 };
  }
}
