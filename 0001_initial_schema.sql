-- CraftHub : initial schema
-- Users -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  full_name TEXT NOT NULL,
  handle TEXT UNIQUE NOT NULL,
  phone TEXT NOT NULL,
  country_code TEXT NOT NULL,
  country_name TEXT NOT NULL,
  email TEXT NOT NULL,
  age INTEGER NOT NULL,
  gender TEXT NOT NULL,
  sector_id TEXT NOT NULL,
  sector_name TEXT NOT NULL,
  profession_id TEXT NOT NULL,
  profession_name TEXT NOT NULL,
  avatar TEXT DEFAULT '',
  banner TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  role TEXT DEFAULT 'user',            -- user | moderator | admin
  is_company INTEGER DEFAULT 0,
  is_verified INTEGER DEFAULT 0,       -- Verified Company badge
  tax_id TEXT DEFAULT '',
  subscribers INTEGER DEFAULT 0,
  premium INTEGER DEFAULT 0,
  token TEXT UNIQUE NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_token ON users(token);

-- Professions lookup (seeded from static tree) -----------------------------
CREATE TABLE IF NOT EXISTS professions (
  id TEXT PRIMARY KEY,
  sector_id TEXT NOT NULL,
  sector_name TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  name_en TEXT NOT NULL
);

-- Communities / rooms ------------------------------------------------------
CREATE TABLE IF NOT EXISTS rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  profession_id TEXT DEFAULT 'general', -- 'general' visible to everyone
  sector_id TEXT DEFAULT 'general',
  description TEXT DEFAULT '',
  is_public INTEGER DEFAULT 1,
  is_paused INTEGER DEFAULT 0,
  paused_reason TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS room_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  muted INTEGER DEFAULT 0,
  UNIQUE(room_id, user_id)
);

-- Messages (WhatsApp style) -----------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  type TEXT DEFAULT 'text',   -- text | image | video | audio | file | sticker
  body TEXT DEFAULT '',
  media_url TEXT DEFAULT '',
  file_name TEXT DEFAULT '',
  reply_to INTEGER,
  deleted_for_all INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_messages_room ON messages(room_id);

CREATE TABLE IF NOT EXISTS message_hides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  UNIQUE(message_id, user_id)
);

-- Content -------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS videos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  thumbnail TEXT DEFAULT '',
  source_url TEXT DEFAULT '',
  kind TEXT DEFAULT 'long',    -- long | short | live
  duration INTEGER DEFAULT 0,
  views INTEGER DEFAULT 0,
  watch_seconds INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  dislikes INTEGER DEFAULT 0,
  is_live INTEGER DEFAULT 0,
  visibility TEXT DEFAULT 'public',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_videos_user ON videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_kind ON videos(kind);

CREATE TABLE IF NOT EXISTS reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  kind TEXT NOT NULL,  -- like | dislike | save
  UNIQUE(video_id, user_id, kind)
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  body TEXT NOT NULL,
  is_removed INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_comments_video ON comments(video_id);

CREATE TABLE IF NOT EXISTS subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(channel_id, user_id)
);

CREATE TABLE IF NOT EXISTS playlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS playlist_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  playlist_id INTEGER NOT NULL,
  video_id INTEGER NOT NULL,
  UNIQUE(playlist_id, video_id)
);

CREATE TABLE IF NOT EXISTS watch_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  video_id INTEGER NOT NULL,
  seconds INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Monetization --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wallets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER UNIQUE NOT NULL,
  balance REAL DEFAULT 0,
  lifetime REAL DEFAULT 0,
  cpm REAL DEFAULT 0,
  rpm REAL DEFAULT 0,
  currency TEXT DEFAULT 'USD'
);

CREATE TABLE IF NOT EXISTS earnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  video_id INTEGER,
  source TEXT NOT NULL,        -- ads_long | ads_short | premium | superchat | membership
  gross REAL DEFAULT 0,
  creator_share REAL DEFAULT 0,
  platform_share REAL DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS withdrawals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  method TEXT NOT NULL,        -- IBAN | PayPal | InstaPay
  destination TEXT NOT NULL,
  status TEXT DEFAULT 'pending', -- pending | approved | rejected | paid
  note TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Moderation / admin --------------------------------------------------------
CREATE TABLE IF NOT EXISTS bans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  issued_by INTEGER NOT NULL,
  reason TEXT NOT NULL,
  hours INTEGER DEFAULT 0,
  expires_at DATETIME,
  active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,             -- NULL = broadcast to everyone
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  is_broadcast INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_id INTEGER NOT NULL,
  target_type TEXT NOT NULL,   -- message | comment | user
  target_id INTEGER NOT NULL,
  reason TEXT DEFAULT '',
  handled INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Misc key/value (platform settings, liveness, counters) --------------------
CREATE TABLE IF NOT EXISTS kv (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sessions ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
