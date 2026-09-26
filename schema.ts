// Idempotent schema bootstrap. Runs once per isolate so the app works on a
// fresh D1 database even before `wrangler d1 migrations apply` is executed.
export const SCHEMA_SQL: string[] = [
  `CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL, handle TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL, country_code TEXT NOT NULL, country_name TEXT NOT NULL,
    email TEXT NOT NULL, age INTEGER NOT NULL, gender TEXT NOT NULL,
    sector_id TEXT NOT NULL, sector_name TEXT NOT NULL,
    profession_id TEXT NOT NULL, profession_name TEXT NOT NULL,
    avatar TEXT DEFAULT '', banner TEXT DEFAULT '', bio TEXT DEFAULT '',
    role TEXT DEFAULT 'user', is_company INTEGER DEFAULT 0, is_verified INTEGER DEFAULT 0,
    tax_id TEXT DEFAULT '', subscribers INTEGER DEFAULT 0, premium INTEGER DEFAULT 0,
    token TEXT UNIQUE NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone)`,
  `CREATE TABLE IF NOT EXISTS professions (id TEXT PRIMARY KEY, sector_id TEXT NOT NULL,
    sector_name TEXT NOT NULL, name_ar TEXT NOT NULL, name_en TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS rooms (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL, profession_id TEXT DEFAULT 'general', sector_id TEXT DEFAULT 'general',
    description TEXT DEFAULT '', is_public INTEGER DEFAULT 1, is_paused INTEGER DEFAULT 0,
    paused_reason TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS room_members (id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER NOT NULL, user_id INTEGER NOT NULL, joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    muted INTEGER DEFAULT 0, UNIQUE(room_id, user_id))`,
  `CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, room_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL, type TEXT DEFAULT 'text', body TEXT DEFAULT '', media_url TEXT DEFAULT '',
    file_name TEXT DEFAULT '', reply_to INTEGER, deleted_for_all INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id)`,
  `CREATE TABLE IF NOT EXISTS message_hides (id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER NOT NULL, user_id INTEGER NOT NULL, UNIQUE(message_id, user_id))`,
  `CREATE TABLE IF NOT EXISTS videos (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
    title TEXT NOT NULL, description TEXT DEFAULT '', thumbnail TEXT DEFAULT '', source_url TEXT DEFAULT '',
    kind TEXT DEFAULT 'long', duration INTEGER DEFAULT 0, views INTEGER DEFAULT 0,
    watch_seconds INTEGER DEFAULT 0, likes INTEGER DEFAULT 0, dislikes INTEGER DEFAULT 0,
    is_live INTEGER DEFAULT 0, visibility TEXT DEFAULT 'public',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE INDEX IF NOT EXISTS idx_videos_user ON videos(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_videos_kind ON videos(kind)`,
  `CREATE TABLE IF NOT EXISTS reactions (id INTEGER PRIMARY KEY AUTOINCREMENT, video_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL, kind TEXT NOT NULL, UNIQUE(video_id, user_id, kind))`,
  `CREATE TABLE IF NOT EXISTS comments (id INTEGER PRIMARY KEY AUTOINCREMENT, video_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL, body TEXT NOT NULL, is_removed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS subscriptions (id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel_id INTEGER NOT NULL, user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(channel_id, user_id))`,
  `CREATE TABLE IF NOT EXISTS playlists (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
    title TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS playlist_items (id INTEGER PRIMARY KEY AUTOINCREMENT,
    playlist_id INTEGER NOT NULL, video_id INTEGER NOT NULL, UNIQUE(playlist_id, video_id))`,
  `CREATE TABLE IF NOT EXISTS watch_history (id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL, video_id INTEGER NOT NULL, seconds INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS wallets (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER UNIQUE NOT NULL,
    balance REAL DEFAULT 0, lifetime REAL DEFAULT 0, cpm REAL DEFAULT 0, rpm REAL DEFAULT 0,
    currency TEXT DEFAULT 'USD')`,
  `CREATE TABLE IF NOT EXISTS earnings (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
    video_id INTEGER, source TEXT NOT NULL, gross REAL DEFAULT 0, creator_share REAL DEFAULT 0,
    platform_share REAL DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS withdrawals (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
    amount REAL NOT NULL, method TEXT NOT NULL, destination TEXT NOT NULL, status TEXT DEFAULT 'pending',
    note TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS bans (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
    issued_by INTEGER NOT NULL, reason TEXT NOT NULL, hours INTEGER DEFAULT 0, expires_at DATETIME,
    active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER,
    title TEXT NOT NULL, body TEXT DEFAULT '', is_broadcast INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS reports (id INTEGER PRIMARY KEY AUTOINCREMENT, reporter_id INTEGER NOT NULL,
    target_type TEXT NOT NULL, target_id INTEGER NOT NULL, reason TEXT DEFAULT '', handled INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  // Admin-managed custom ads. Single row (id = 1). AdMob keys are OPTIONAL:
  // when empty the app silently falls back to the admin's custom links and
  // never shows an error or prompts for API keys.
  `CREATE TABLE IF NOT EXISTS ad_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    enabled INTEGER DEFAULT 0,
    android_link TEXT DEFAULT '', android_banner TEXT DEFAULT '',
    ios_link TEXT DEFAULT '', ios_banner TEXT DEFAULT '',
    desktop_link TEXT DEFAULT '', desktop_banner TEXT DEFAULT '',
    admob_app_id TEXT DEFAULT '', admob_banner_unit TEXT DEFAULT '',
    admob_android_banner_unit TEXT DEFAULT '', admob_ios_banner_unit TEXT DEFAULT '',
    network TEXT DEFAULT 'custom', updated_by INTEGER,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  // Auto-moderation bot configuration (single row, id = 1)
  `CREATE TABLE IF NOT EXISTS moderation_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    enabled INTEGER DEFAULT 1,
    sensitivity INTEGER DEFAULT 50,
    block_links INTEGER DEFAULT 1,
    block_media INTEGER DEFAULT 0,
    auto_ban_hours INTEGER DEFAULT 0,
    mask_offensive INTEGER DEFAULT 1,
    strike_limit INTEGER DEFAULT 3,
    updated_by INTEGER, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  // Admin-managed blacklisted words/phrases
  `CREATE TABLE IF NOT EXISTS blacklist_words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    word TEXT UNIQUE NOT NULL,
    severity TEXT DEFAULT 'medium',
    is_regex INTEGER DEFAULT 0,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  // Every automatic moderation action, for the admin audit trail
  `CREATE TABLE IF NOT EXISTS moderation_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id INTEGER, user_id INTEGER, message_id INTEGER,
    action TEXT NOT NULL, matched TEXT DEFAULT '', reason TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
  `CREATE INDEX IF NOT EXISTS idx_modlog_created ON moderation_log(created_at)`,
  `CREATE TABLE IF NOT EXISTS user_strikes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, room_id INTEGER,
    reason TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
];

let schemaReady: Promise<void> | null = null;

export function ensureSchema(db: D1Database): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      for (const sql of SCHEMA_SQL) {
        try { await db.prepare(sql).run(); } catch { /* already exists */ }
      }
    })();
  }
  return schemaReady;
}
