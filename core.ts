import { COUNTRIES } from '../data/countries';

export type Env = {
  DB: D1Database;
  R2?: R2Bucket;
};

export type User = {
  id: number;
  full_name: string;
  handle: string;
  phone: string;
  country_code: string;
  country_name: string;
  email: string;
  age: number;
  gender: string;
  sector_id: string;
  sector_name: string;
  profession_id: string;
  profession_name: string;
  avatar: string;
  banner: string;
  bio: string;
  role: string;
  is_company: number;
  is_verified: number;
  tax_id: string;
  subscribers: number;
  premium: number;
  token: string;
  created_at: string;
};

export function nowIso(): string {
  return new Date().toISOString();
}

export function token(bytes = 24): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function slugify(input: string): string {
  return String(input)
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'user';
}

/* ------------------------------------------------------------------ *
 * Phone validation — country dial code + national number length
 * ------------------------------------------------------------------ */
export function normaliseDial(dial: string): string {
  return String(dial).replace(/[^0-9]/g, '');
}

export function validatePhone(dial: string, rawPhone: string) {
  const cleanDial = normaliseDial(dial);
  let national = String(rawPhone).replace(/[\s\-()]/g, '');
  if (national.startsWith('+')) national = national.slice(1);
  if (national.startsWith('00')) national = national.slice(2);
  // strip a duplicated dial prefix if the user typed the full international form
  if (national.startsWith(cleanDial) && national.length > cleanDial.length) {
    national = national.slice(cleanDial.length);
  }
  if (!/^\d+$/.test(national)) {
    return { ok: false, national, reason: 'digits_only' as const };
  }
  const country = COUNTRIES.find((c) => normaliseDial(c.dial) === cleanDial);
  const allowed = country ? country.len : [7, 8, 9, 10, 11, 12];
  const ok = allowed.includes(national.length);
  return { ok, national, reason: ok ? ('ok' as const) : ('length' as const), country };
}

/* ------------------------------------------------------------------ *
 * Small D1 helpers
 * ------------------------------------------------------------------ */
export async function one<T = any>(db: D1Database, sql: string, ...args: any[]): Promise<T | null> {
  const stmt = db.prepare(sql);
  const bound = args.length ? stmt.bind(...args) : stmt;
  return (await bound.first<T>()) ?? null;
}

export async function all<T = any>(db: D1Database, sql: string, ...args: any[]): Promise<T[]> {
  const stmt = db.prepare(sql);
  const bound = args.length ? stmt.bind(...args) : stmt;
  const res = await bound.all<T>();
  return (res.results ?? []) as T[];
}

export async function run(db: D1Database, sql: string, ...args: any[]) {
  const stmt = db.prepare(sql);
  const bound = args.length ? stmt.bind(...args) : stmt;
  return bound.run();
}

export async function kvGet(db: D1Database, key: string): Promise<string | null> {
  const row = await one<{ value: string }>(db, 'SELECT value FROM kv WHERE key = ?', key);
  return row?.value ?? null;
}

export async function kvSet(db: D1Database, key: string, value: string) {
  await run(
    db,
    'INSERT INTO kv (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP',
    key,
    value,
  );
}

/* ------------------------------------------------------------------ *
 * Ads configuration
 *
 * AdMob keys are OPTIONAL. When they are absent the app silently uses
 * the admin's custom ad links/banners. Nothing here ever throws or
 * demands an API key — an unconfigured app simply reports { enabled:false }.
 * ------------------------------------------------------------------ */
export type AdSettings = {
  enabled: boolean
  android_link: string
  android_banner: string
  ios_link: string
  ios_banner: string
  desktop_link: string
  desktop_banner: string
  admob_app_id: string
  admob_banner_unit: string
  admob_android_banner_unit: string
  admob_ios_banner_unit: string
  network: string
  updated_at: string
}

export const DEFAULT_ADS: AdSettings = {
  enabled: false,
  android_link: '',
  android_banner: '',
  ios_link: '',
  ios_banner: '',
  desktop_link: '',
  desktop_banner: '',
  admob_app_id: '',
  admob_banner_unit: '',
  admob_android_banner_unit: '',
  admob_ios_banner_unit: '',
  network: 'custom',
  updated_at: '',
}

/** Reads ad settings. Never throws — returns defaults if the row is missing. */
export async function getAdSettings(db: D1Database): Promise<AdSettings> {
  try {
    const row = await one<any>(db, 'SELECT * FROM ad_settings WHERE id = 1')
    if (!row) return { ...DEFAULT_ADS }
    return {
      enabled: !!row.enabled,
      android_link: row.android_link || '',
      android_banner: row.android_banner || '',
      ios_link: row.ios_link || '',
      ios_banner: row.ios_banner || '',
      desktop_link: row.desktop_link || '',
      desktop_banner: row.desktop_banner || '',
      admob_app_id: row.admob_app_id || '',
      admob_banner_unit: row.admob_banner_unit || '',
      admob_android_banner_unit: row.admob_android_banner_unit || '',
      admob_ios_banner_unit: row.admob_ios_banner_unit || '',
      network: row.network || 'custom',
      updated_at: row.updated_at || '',
    }
  } catch {
    return { ...DEFAULT_ADS }
  }
}

/** Detects the requesting platform from the User-Agent / client hint. */
export function detectPlatform(ua: string): 'android' | 'ios' | 'desktop' {
  const s = (ua || '').toLowerCase()
  if (/android/.test(s)) return 'android'
  if (/iphone|ipad|ipod|ios/.test(s)) return 'ios'
  return 'desktop'
}

/**
 * Resolves the ad unit to serve for a given client without ever erroring.
 *
 * Resolution order (AdMob is never required):
 *   1. If the platform has a custom link/banner from the admin -> serve it.
 *   2. Else if AdMob keys happen to be configured -> report the AdMob unit.
 *   3. Else -> { enabled: false }. No error, no API-key prompt.
 */
export function resolveAdUnit(settings: AdSettings, platform: 'android' | 'ios' | 'desktop') {
  const link = (settings as any)[`${platform}_link`] as string
  const banner = (settings as any)[`${platform}_banner`] as string

  if (settings.enabled && (link || banner)) {
    return {
      enabled: true,
      source: 'custom' as const,
      platform,
      link: link || '',
      banner: banner || '',
      admob: null,
    }
  }

  const unit =
    platform === 'android'
      ? settings.admob_android_banner_unit || settings.admob_banner_unit
      : platform === 'ios'
        ? settings.admob_ios_banner_unit || settings.admob_banner_unit
        : ''

  if (settings.enabled && settings.admob_app_id && unit) {
    return {
      enabled: true,
      source: 'admob' as const,
      platform,
      link: '',
      banner: '',
      admob: { app_id: settings.admob_app_id, banner_unit: unit },
    }
  }

  // Nothing configured -> degrade silently.
  return { enabled: false, source: 'none' as const, platform, link: '', banner: '', admob: null }
}

/* ------------------------------------------------------------------ *
 * Money math (revenue sharing)
 * ------------------------------------------------------------------ */
export const CREATOR_SHARE = { long: 0.55, short: 0.45, ads_long: 0.55, ads_short: 0.45 } as const;

export function splitRevenue(source: string, gross: number) {
  const creatorRate =
    source === 'ads_short' || source === 'ads_long'
      ? CREATOR_SHARE[source]
      : 0.7; // premium / superchat / membership
  const creator = Math.round(gross * creatorRate * 100) / 100;
  const platform = Math.round((gross - creator) * 100) / 100;
  return { creator, platform, creatorRate };
}

export function monetizationEligible(user: { subscribers: number }, watchHours: number, shortViews: number) {
  const subs = user.subscribers >= 1000;
  const hours = watchHours >= 4000;
  const shorts = shortViews >= 10_000_000;
  return { eligible: subs && (hours || shorts), subs, hours, shorts };
}

export function publicUser(u: Partial<User> | null) {
  if (!u) return null;
  const { token: _t, phone, tax_id, ...rest } = u as User;
  const maskedPhone = phone
    ? phone.replace(/(\d{2})\d+(\d{2})/, (_m, a, b) => `${a}****${b}`)
    : '';
  return { ...rest, phone: maskedPhone };
}

export function requireAuth(c: any): User | null {
  const u = c.get('user');
  return u || null;
}
