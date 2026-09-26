import { Hono } from 'hono';
import type { Env, User } from '../lib/core';
import { one, run, token, slugify, validatePhone, publicUser } from '../lib/core';
import { COUNTRIES, flagEmoji } from '../data/countries';
import { SECTORS, ALL_PROFESSIONS, sectorById, professionById } from '../data/professions';

const auth = new Hono<{ Bindings: Env }>();

// Metadata for the signup form (countries + professions tree)
auth.get('/meta', (c) => {
  return c.json({
    countries: COUNTRIES.map((x) => ({ ...x, flag: flagEmoji(x.iso) })),
    sectors: SECTORS.map((s) => ({
      id: s.id,
      ar: s.ar,
      en: s.en,
      icon: s.icon,
      professions: s.professions,
    })),
    total_countries: COUNTRIES.length,
    total_professions: ALL_PROFESSIONS.length,
  });
});

// Programmatic phone validation (no OTP)
auth.post('/validate-phone', async (c) => {
  const { dial, phone } = await c.req.json().catch(() => ({ dial: '', phone: '' }));
  let code = String(dial || '');
  if (!code.startsWith('+')) code = '+' + code.replace(/[^0-9]/g, '');
  const res = validatePhone(code, String(phone || ''));
  return c.json({
    valid: res.ok,
    national: res.national,
    country: res.country ? { ...res.country, flag: flagEmoji(res.country.iso) } : null,
    message: res.ok ? 'ok' : 'رقم الهاتف غير متوافق مع كود الدولة المختار',
  });
});

// Direct registration — account created immediately, no SMS OTP
auth.post('/register', async (c) => {
  const b = await c.req.json().catch(() => ({} as any));
  const required = ['full_name', 'dial', 'phone', 'email', 'age', 'gender', 'profession_id'];
  for (const k of required) {
    if (b[k] === undefined || b[k] === null || String(b[k]).trim() === '') {
      return c.json({ ok: false, error: `missing_field:${k}` }, 400);
    }
  }

  const age = Number(b.age);
  if (!Number.isFinite(age) || age < 13 || age > 100) {
    return c.json({ ok: false, error: 'invalid_age', message: 'العمر يجب أن يكون بين 13 و 100' }, 400);
  }
  if (!['male', 'female'].includes(String(b.gender))) {
    return c.json({ ok: false, error: 'invalid_gender' }, 400);
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(b.email))) {
    return c.json({ ok: false, error: 'invalid_email', message: 'البريد الإلكتروني غير صحيح' }, 400);
  }

  let code = String(b.dial).trim();
  if (!code.startsWith('+')) code = '+' + code.replace(/[^0-9]/g, '');
  const v = validatePhone(code, String(b.phone));
  if (!v.ok || !v.country) {
    return c.json(
      { ok: false, error: 'invalid_phone', message: 'رقم الهاتف غير متوافق مع كود الدولة المختار' },
      400,
    );
  }

  const prof = professionById(String(b.profession_id));
  if (!prof) return c.json({ ok: false, error: 'invalid_profession' }, 400);
  const sector = sectorById(String(b.sector_id || '')) || SECTORS.find((s) => s.professions.some((p) => p.id === prof.id));
  if (!sector) return c.json({ ok: false, error: 'invalid_sector' }, 400);

  const e164 = `+${String(v.country.dial).replace(/[^0-9]/g, '')}${v.national}`;
  const dup = await one<{ id: number }>(c.env.DB, 'SELECT id FROM users WHERE phone = ?', e164);
  if (dup) {
    return c.json({ ok: false, error: 'phone_exists', message: 'رقم الهاتف مسجل بالفعل' }, 409);
  }

  // unique handle
  let handle = slugify(String(b.handle || b.full_name));
  const exists = await one<{ id: number }>(c.env.DB, 'SELECT id FROM users WHERE handle = ?', handle);
  if (exists) handle = `${handle}-${Math.floor(Math.random() * 9000 + 1000)}`;

  const tk = token(24);
  const res = await run(
    c.env.DB,
    `INSERT INTO users (full_name, handle, phone, country_code, country_name, email, age, gender,
      sector_id, sector_name, profession_id, profession_name, avatar, banner, bio, role, is_company,
      tax_id, subscribers, token)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    String(b.full_name).trim(),
    handle,
    e164,
    code,
    v.country.name,
    String(b.email).trim(),
    age,
    String(b.gender),
    sector.id,
    sector.ar,
    prof.id,
    prof.ar,
    String(b.avatar || ''),
    String(b.banner || ''),
    String(b.bio || ''),
    'user',
    b.is_company ? 1 : 0,
    String(b.tax_id || ''),
    0,
    tk,
  );

  const userId = Number(res.meta?.last_row_id);
  await run(c.env.DB, 'INSERT OR IGNORE INTO wallets (user_id) VALUES (?)', userId);
  await run(c.env.DB, 'INSERT INTO sessions (token, user_id) VALUES (?, ?)', tk, userId);

  const user = await one<User>(c.env.DB, 'SELECT * FROM users WHERE id = ?', userId);
  return c.json({ ok: true, token: tk, user: publicUser(user) });
});

// Direct login by phone number (no OTP)
auth.post('/login', async (c) => {
  const { dial, phone } = await c.req.json().catch(() => ({ dial: '', phone: '' }));
  let code = String(dial || '').trim();
  if (!code.startsWith('+')) code = '+' + code.replace(/[^0-9]/g, '');
  const v = validatePhone(code, String(phone || ''));
  if (!v.ok || !v.country) {
    return c.json({ ok: false, error: 'invalid_phone', message: 'رقم الهاتف غير متوافق مع كود الدولة المختار' }, 400);
  }
  const e164 = `+${String(v.country.dial).replace(/[^0-9]/g, '')}${v.national}`;
  const user = await one<User>(c.env.DB, 'SELECT * FROM users WHERE phone = ?', e164);
  if (!user) return c.json({ ok: false, error: 'not_found', message: 'لا يوجد حساب بهذا الرقم' }, 404);

  const tk = token(24);
  await run(c.env.DB, 'INSERT INTO sessions (token, user_id) VALUES (?, ?)', tk, user.id);
  await run(c.env.DB, 'UPDATE users SET token = ? WHERE id = ?', tk, user.id);
  return c.json({ ok: true, token: tk, user: publicUser(user) });
});

auth.get('/me', async (c) => {
  const u = c.get('user') as User | undefined;
  if (!u) return c.json({ ok: false, error: 'unauthorized' }, 401);
  return c.json({ ok: true, user: publicUser(u) });
});

auth.post('/logout', async (c) => {
  const u = c.get('user') as User | undefined;
  if (u) await run(c.env.DB, 'DELETE FROM sessions WHERE token = ?', u.token);
  return c.json({ ok: true });
});

export default auth;
