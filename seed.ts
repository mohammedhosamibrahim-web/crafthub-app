import { SECTORS, ALL_PROFESSIONS } from '../data/professions';
import { run, one, token } from './core';

/**
 * Master Super Admin bootstrap.
 *
 * Created once on first boot. The account is a full platform superuser: it
 * bypasses every profession/room access restriction and can moderate any room,
 * including private ones. Credentials are printed to the console so a fresh
 * deployment is never locked out.
 */
export const SUPER_ADMIN = {
  full_name: 'مشرف النظام الرئيسي | Master Super Admin',
  handle: 'super-admin',
  phone: '+201000000000',       // dial +20, national 1000000000 (valid EG length 10)
  country_code: '+20',
  country_name: 'Egypt',
  email: 'admin@crafthub.com',
  secret: 'CraftHub@Admin#2026',  // shown in console + admin panel
  age: 30,
  gender: 'male',
  sector_id: 'general',
  profession_id: 'general',
};

async function ensureSuperAdmin(db: D1Database) {
  const existing = await one<{ id: number }>(
    db, 'SELECT id FROM users WHERE email = ? OR handle = ?',
    SUPER_ADMIN.email, SUPER_ADMIN.handle,
  );
  if (existing) {
    // Guarantee the account keeps superuser rights + the documented secret.
    try {
      await run(
        db,
        "UPDATE users SET role = 'admin', is_verified = 1 WHERE id = ?",
        existing.id,
      );
    } catch { /* ignore */ }
    return existing.id;
  }

  const tk = token(24);
  const res = await run(
    db,
    `INSERT INTO users
       (full_name, handle, phone, country_code, country_name, email, age, gender,
        sector_id, sector_name, profession_id, profession_name, role, is_company,
        is_verified, token)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,'admin',0,1,?)`,
    SUPER_ADMIN.full_name, SUPER_ADMIN.handle, SUPER_ADMIN.phone,
    SUPER_ADMIN.country_code, SUPER_ADMIN.country_name, SUPER_ADMIN.email,
    SUPER_ADMIN.age, SUPER_ADMIN.gender,
    SUPER_ADMIN.sector_id, 'متنوع | General',
    SUPER_ADMIN.profession_id, 'متنوع | General',
    tk,
  );
  const id = res.meta?.last_row_id;
  try {
    await run(db, 'INSERT INTO wallets (user_id) VALUES (?)', id);
  } catch { /* ignore */ }

  // Print the credentials exactly once, on first creation.
  const line = '─'.repeat(64);
  console.log(`\n${line}
  🔐 CraftHub — MASTER SUPER ADMIN CREATED
${line}
  Phone    : ${SUPER_ADMIN.phone}
  Email    : ${SUPER_ADMIN.email}
  Secret   : ${SUPER_ADMIN.secret}
  Login    : POST /api/auth/login  { "dial": "+20", "phone": "1000000000" }
  Rights   : FULL access to ALL rooms, professions & private chats (no limits)
${line}\n`);
  return id;
}

// Ensure the professions lookup + one community room per sector is present.
export async function ensureSeed(db: D1Database) {
  const marker = await one<{ value: string }>(db, "SELECT value FROM kv WHERE key = 'seed_version'");
  if (marker?.value === '2') return;

  for (const p of ALL_PROFESSIONS) {
    const sector = SECTORS.find((s) => s.professions.some((x) => x.id === p.id))!;
    await run(
      db,
      `INSERT INTO professions (id, sector_id, sector_name, name_ar, name_en)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET sector_name = excluded.sector_name,
         name_ar = excluded.name_ar, name_en = excluded.name_en`,
      p.id, sector.id, sector.ar, p.ar, p.en,
    );
  }

  // General room, always available to everyone.
  await run(
    db,
    `INSERT INTO rooms (name, slug, profession_id, sector_id, description, is_public)
     VALUES ('الشات العام | General Chat', 'general', 'general', 'general', 'غرفة عامة لجميع الأعضاء', 1)
     ON CONFLICT(slug) DO NOTHING`,
  );

  for (const s of SECTORS) {
    if (s.id === 'general') continue;
    const slug = `sector-${s.id}`;
    await run(
      db,
      `INSERT INTO rooms (name, slug, profession_id, sector_id, description, is_public)
       VALUES (?, ?, ?, ?, ?, 1) ON CONFLICT(slug) DO NOTHING`,
      `${s.ar} | ${s.en}`, slug, `sector:${s.id}`, s.id, s.ar,
    );
    for (const p of s.professions) {
      await run(
        db,
        `INSERT INTO rooms (name, slug, profession_id, sector_id, description, is_public)
         VALUES (?, ?, ?, ?, ?, 1) ON CONFLICT(slug) DO NOTHING`,
        `${p.ar} | ${p.en}`, `room-${p.id}`, p.id, s.id, p.en,
      );
    }
  }

  // A couple of platform keys
  await run(db, "INSERT INTO kv (key, value) VALUES ('terms_version','1') ON CONFLICT(key) DO NOTHING");
  await run(db, "INSERT INTO kv (key, value) VALUES ('platform_currency','USD') ON CONFLICT(key) DO NOTHING");
  await run(
    db,
    "INSERT INTO kv (key, value) VALUES ('seed_version','2') ON CONFLICT(key) DO UPDATE SET value='2'",
  );
}

/**
 * Runs on EVERY boot (not gated by seed_version) so the master admin and the
 * moderation defaults exist even on databases seeded by an earlier version.
 */
export async function ensureCriticalBootstrap(db: D1Database) {
  await ensureSuperAdmin(db);
  try {
    await run(
      db,
      `INSERT INTO moderation_settings (id, enabled, sensitivity, block_links, mask_offensive)
       VALUES (1, 1, 50, 1, 1)
       ON CONFLICT(id) DO NOTHING`,
    );
  } catch { /* ignore */ }
}
