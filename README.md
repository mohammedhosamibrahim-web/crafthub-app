# CraftHub — منصة المهن العالمية | Global Professions Video & Community Platform

A full-stack, production-ready **PWA** built with **Hono + Cloudflare Pages (Workers) + D1**.
Vanilla-JS SPA frontend (no build step for the client), Arabic-first with RTL/LTR auto-switching.

---

## 🔗 URLs

| | |
|---|---|
| **Local dev** | `http://localhost:3000` |
| **Production** | _pending deploy_ |
| **API base** | `/api/*` |
| **Health** | `/api/health` |

---

## 🎨 1. Dual Accent Theme System

| Token | Light (default) | Dark |
|---|---|---|
| Background | `#FFFFFF` | `#0F0F0F` |
| Text | `#0F172A` | `#F8FAFC` |

**Two accents used together** (defined as CSS vars in `public/static/styles.css`):

- 🔴 **YouTube Red `#FF0000`** — video progress bar, `LIVE` badges, Subscribe buttons, primary action icons, active-tab gradient.
- 🟢 **Financial Green `#10B981`** — earnings/wallet figures, verification badges, connection status, success marks.
- **Active tabs** use a `linear-gradient(#FF0000 → #10B981)` bottom border (both accents together).
- Toggle: top-bar sun/moon button or **Settings → Theme**. Persisted in `localStorage`.

---

## 📱 2. Simplified Phone Registration (no OTP)

- **No Google / Apple / LinkedIn** sign-up — only direct phone registration (`src/routes/auth.ts`).
- **201 countries** with flags (emoji derived from ISO), native + Arabic names, dial codes (`src/data/countries.ts`).
- **Programmatic Regex-length validation** per country: `POST /api/auth/validate-phone`.
  Wrong length/format → blocked with `رقم الهاتف غير متوافق مع كود الدولة المختار`.
- Correct number → **account created instantly** and user lands on their channel. No SMS OTP.
- Fields: full name, phone + dial code, email, age, gender, **sector & profession**.

---

## 💼 3. Global Professions Database (`src/data/professions.ts`)

**59 professions across 9 sectors** — seeded into D1 (`professions` table) and used to build 67 chat rooms.

| Sector | Sample professions |
|---|---|
| `engineering` | civil, architect, software, electrical, mechanical, mechatronics, networks, AI, aviation, petroleum, renewable |
| `medical` | physician, dentist, pharmacy, nursing, physiotherapy, veterinary, labs, radiology, surgery, psychiatry |
| `automotive` | global dealer engineer, repair, ECU programming, auto mechatronics, showroom sales |
| `media` | photographer, cinematographer, drone pilot, content creator, audio distributor, editor |
| `crafts` | plumbing, home electrical, carpentry, blacksmithing, painting/decor, HVAC, aluminium, appliance repair, lathe |
| `business` | accountant, admin, digital marketing, sales, HR, data analysis, lawyer, import/export |
| `education` | teacher, lecturer, personal trainer, researcher, translator |
| `services` | chef, hotel management, aviation/hospitality, logistics |
| `general` | **متنوع** — browse-all only |

---

## 💬 4. WhatsApp-Style Communities & Chat Engine

- **Media**: text, images, video, **voice notes with waveform**, PDF/files, **stickers**, full emoji panel.
- **Message context menu** (right-click *and* long-press): Reply, Copy, Delete for everyone, Delete for me.
- **3-dots header menu** — user: clear all messages (mine only), mute notifications. Admin/mod: view members, add member, remove member, pause chat.
- **Hierarchical gating** (`canEnterRoom` in `src/routes/chat.ts`):
  - Professional room → only that profession may enter.
  - Sector room → that sector only.
  - **`general` users → general room ONLY** (verified: 1 of 67 rooms accessible).
  - Denied → `غير مصلوح لك بالدخول، هذا المجتمع مخصص لأصحاب مهنة [X] فقط`.
- Join button flips to **تم الانضمام** immediately.
- Live polling every 4 s; `message_hides` powers per-user deletion.

---

## 📺 5. Pixel YouTube-Style Channel Profile

Banner → round avatar → name (+blue verified check) → `@handle` → **subscribers only** → video count → profession.
Primary action: red **اشتراك / Subscribe** for visitors, **تعديل القناة / Edit Channel** for the owner.

**7 tabs in order**: الرئيسية · الفيديوهات · Shorts · البث المباشر · قوائم التشغيل · المجتمع · الإحصاءات (CraftHub Studio).

---

## ▶️ 6. Player & Shorts

- **Player**: red progress bar, current/total time, play-pause, volume, quality, fullscreen.
- **Action bar**: Like, Dislike, Share, Download, Save + channel info row with Subscribe.
- **Shorts**: vertical snap-scrolling feed, autoplay via `IntersectionObserver`, looping.
  Side rail: channel avatar, heart, comments, share, save, and a **spinning audio disc**.

---

## 💰 7. Monetization & Revenue Sharing

**Sources**: long-video ads, Shorts ads, CraftHub Premium, Super Chat, memberships.

**Eligibility**: `1,000 subscribers` **AND** (`4,000 watch hours` **OR** `10M Shorts views`).

| Type | Creator | Platform |
|---|---|---|
| Long videos | **55%** | 45% |
| Shorts | **45%** | 55% |

- Wallet in **USD ($)**, live **CPM/RPM** tracking, per-source earnings breakdown.
- Withdrawals via **IBAN / PayPal / InstaPay**, **minimum $100** (enforced server-side), manual admin review.

---

## 🛡️ 8. Admin & Moderator Controls

- **Admin**: create rooms, system broadcast, pause/unpause rooms, temporary bans (hours + reason + expiry), verify companies, review withdrawals, change roles.
- **Moderator**: remove abusive messages/comments instantly, work the reports queue.
- **Verified Company ✔️** badge granted when a commercial registration is submitted.

---

## ⚖️ 9. Legal Policies

`GET /api/legal` returns full bilingual (AR+EN) documents:
**Terms of Service** (publishing rules, respect for professions, anti-fraud, ban penalties),
**Privacy Policy** (data, phone masking, commercial-register protection, financial security),
**Monetization Terms** (calculation, withdrawal conditions, anti-fake-views).

---

## 🌍 10. 50 Languages with Auto RTL/LTR

**50 locales** (`src/data/i18n.ts`): ar, en, es, fr, de, zh-Hans, zh-Hant, hi, pt, ru, tr, ja, ko, it, id, ur, bn, vi, fa, pl, nl, tl, ms, th, el, sv, cs, ro, hu, uk, he, da, fi, no, sw, ta, te, mr, gu, pa, ml, si, kk, uz, az, sr, sk, bg, ca, af.

- Full dictionaries: **Arabic (223 keys)** + **English (223 keys)**; other 48 ship core UI with English fallback.
- **RTL auto-applied** for `ar, ur, fa, he`; LTR for the rest — sets `<html dir>` live.
- Switcher: **Settings → Language** (searchable grid) or the top-bar globe.

---

## 📐 11. UI Spacing & Quality Polish

- Spacing driven by a strict `--sp-1…--sp-12` scale; cards/fields/tabs have explicit padding so text never overlaps.
- **Brand logo is inert** — clicking "CraftHub" performs **no navigation** (spec §11); the wordmark is a non-interactive `<div>`.

---

## 🚀 API Reference

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/validate-phone` | Programmatic phone validation |
| POST | `/api/auth/register` | Direct registration (no OTP) |
| POST | `/api/auth/login` | Login by phone |
| GET | `/api/auth/meta` | Countries + professions tree |
| GET | `/api/feed?q=&kind=` | Feed + trending |
| GET | `/api/shorts`, `/api/live` | Shorts / live lists |
| GET/POST | `/api/videos/:id`, `/api/videos` | Read / create |
| POST | `/api/videos/:id/view` | Watch time → earnings |
| POST | `/api/videos/:id/react` | Like / dislike / save |
| GET/POST | `/api/videos/:id/comments` | Comments |
| GET | `/api/chat/rooms` | Rooms + access flags |
| GET/POST | `/api/chat/rooms/:slug/messages` | Chat messages |
| POST | `/api/chat/rooms/:slug/{join,leave,mute,clear,pause,members}` | Membership |
| POST | `/api/messages/:id/delete` | Delete for me / everyone |
| GET | `/api/channel/:handle` | Channel profile + stats |
| POST | `/api/channel/:handle/subscribe` | Subscribe |
| PUT | `/api/me/channel` | Edit channel |
| GET | `/api/wallet` | Wallet + eligibility + withdrawals |
| POST | `/api/withdrawals` | Request payout (min $100) |
| GET | `/api/admin/overview` | Admin dashboard |
| POST | `/api/admin/{broadcast,users/:id/{verify,role,ban},withdrawals/:id/:decision}` | Admin actions |
| GET | `/api/legal` | Terms / Privacy / Monetization |

---

## 🗄️ Data Architecture

**Storage**: Cloudflare **D1** (SQLite). Schema auto-bootstraps on first request (`src/lib/schema.ts`) and seeds professions + 67 rooms (`src/lib/seed.ts`) — so it works on a fresh DB before any CLI migration. Migration file also provided: `migrations/0001_initial_schema.sql`.

**Tables**: `users`, `professions`, `rooms`, `room_members`, `messages`, `message_hides`, `videos`, `reactions`, `comments`, `subscriptions`, `playlists`, `playlist_items`, `watch_history`, `wallets`, `earnings`, `withdrawals`, `bans`, `notifications`, `reports`, `kv`, `sessions`.

---

## 🧑‍💻 User Guide

1. **Sign up** → `#/signup` — pick country (flag + dial code), enter phone; a green ✓ confirms validity. Submit to land on your channel instantly.
2. **Watch** → home feed → click a thumbnail → player, actions, comments.
3. **Shorts** → `#/shorts` — scroll/swipe vertically, auto-plays; use ↑/↓ or `j`/`k`.
4. **Communities** → `#/community/general` — pick a room; rooms outside your profession show a lock and an access message.
5. **Channel** → `#/channel/<handle>` — 7 tabs; owner sees *Edit Channel*, visitors see red *Subscribe*.
6. **Studio** → `#/studio` — analytics, eligibility progress, revenue split, publish videos.
7. **Wallet** → `#/wallet` — balance, CPM/RPM, earnings breakdown, request payout (≥ $100).
8. **Settings** → `#/settings` — theme, 50 languages (auto RTL/LTR), legal documents.
9. **Admin** → `#/admin` (admin/moderator only) — broadcast, verify, ban, rooms, withdrawals, reports.
10. **Install** → use the browser menu "Add to Home Screen" (PWA manifest + service worker included).

---

## 🛠️ Commands

```bash
npm run build              # vite build → dist/
pm2 start ecosystem.config.cjs   # local dev server on :3000
npm run db:migrate:local   # apply D1 migrations locally
npm run db:console:local   # open local D1 console
npm run deploy             # build + wrangler pages deploy dist
```

---

## 📦 Project Structure

```
webapp/
├── src/
│   ├── index.tsx           # Hono app, auth middleware, HTML shell, SPA fallback
│   ├── lib/{core,schema,seed}.ts
│   ├── routes/{auth,feed,chat,profile,money,admin,legal}.ts
│   └── data/{countries,professions,i18n}.ts
├── public/static/
│   ├── app.js              # SPA entry / router
│   ├── core.js             # state, helpers, API client, i18n, widgets
│   ├── styles.css          # dual-accent theme system
│   ├── pages/{shell,feed,watch,shorts,chat,channel,auth,settings,wallet,studio,admin,legal}.js
│   ├── sw.js, manifest.webmanifest, icon.svg
├── migrations/0001_initial_schema.sql
├── wrangler.jsonc, vite.config.ts, ecosystem.config.cjs, tsconfig.json
```

---

## ✅ Verification Status

Tested locally against a live `wrangler pages dev` + D1 instance:

- **201 countries**, **59 professions**, **50 languages**, **67 chat rooms** seeded ✅
- Phone validation: valid `+20 1012345678` ✓ accepted; `+20 123456` ✗ rejected; mismatched dial code ✗ rejected ✅
- Registration with no OTP + duplicate-phone guard ✅
- Profession gating: physician → dentist room **denied**; own room + general **allowed**; general-user → **1/67 rooms** ✅
- Feed / shorts / live / reactions / comments / watch-time earnings ✅
- Monetization: 55/45 & 45/55 splits, $100 minimum enforced, insufficient-balance guard ✅
- Subscribe/unsubscribe with live subscriber count ✅
- Admin: overview counts, broadcast, company verification, 6-hour ban ✅
- Legal docs (3 × 4 sections) + i18n (223 AR/EN keys, RTL set = ar/ur/fa/he) ✅
- All 15 frontend ES modules pass `node --check`; production build succeeds ✅

**Not yet implemented**: real-time WebSockets (chat uses 4 s polling), actual media upload to R2 (chat/file attachments use object URLs; video takes a URL), live-streaming ingest, and server-side OTP (intentionally removed per spec).

**Recommended next steps**: deploy, add R2 upload for media, swap polling for Durable Objects/WebSockets, wire a real payment provider for payouts.

- **Tech Stack**: Hono · TypeScript · Cloudflare Pages/Workers · D1 · Vanilla-JS PWA
- **Status**: ✅ Runs locally, production deploy pending
- **Last Updated**: 2026-09-22

---

## Ads System (AdMob is NOT required)

The app runs with **zero ad-network keys**. AdMob App ID / Banner Ad Units are
optional and are never requested at runtime.

### Admin → Custom Ads
`Dashboard → Custom Ads` tab. Fields:

| Field | Purpose |
|---|---|
| Master **Toggle Switch** | Turn ads on/off instantly |
| `android_link` / `android_banner` | Android tap-through URL + banner image |
| `ios_link` / `ios_banner` | iOS tap-through URL + banner image |
| `desktop_link` / `desktop_banner` | Web/Windows tap-through + banner |
| `admob_app_id`, `admob_banner_unit`, `admob_android_banner_unit`, `admob_ios_banner_unit` | **Optional.** Only used when present |

### API

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/ads` | public | Platform-aware unit. `?platform=android\|ios\|desktop` overrides UA sniffing. |
| `GET` | `/api/admin/ads` | staff | Current settings + `admob_configured` / `custom_configured` flags |
| `PUT`/`POST` | `/api/admin/ads` | admin | Save settings |
| `POST` | `/api/admin/ads/toggle` | admin | Flip `enabled` without resubmitting the form |

### Silent fallback contract
1. Custom link/banner configured **and** ads enabled → serve it (`source: "custom"`).
2. Otherwise, if AdMob keys *happen* to be set → report them (`source: "admob"`).
3. Otherwise → HTTP **200** `{"ok":true,"enabled":false,"source":"none"}`.

There is never an error, never a modal, and never an API-key prompt. The feed
renders nothing when `enabled` is false.

---

## Native Build Artifacts

> **This sandbox cannot produce `.apk`/`.aab`.** It is a Linux Cloudflare Pages
> environment with no Android SDK, JDK/Gradle, Flutter or Capacitor toolchain,
> and it publishes **web assets only**. Android artifacts must be built on a
> machine/CI with the Android SDK — see `native/android/build_android.sh` and
> `.github/workflows/native-builds.yml`.

### ✅ Windows — buildable and already built here
Cross-compiled with `mingw-w64` + packaged with NSIS. These are genuine binaries:

| Artifact | Size | Type |
|---|---|---|
| `native/windows/CraftHub.exe` | 131 KB | PE32+ Windows GUI (x86-64) |
| `native/windows/CraftHub-Setup.exe` | 164 KB | Nullsoft installer (Start Menu + Desktop shortcuts, uninstaller) |

```bash
sudo apt-get install -y gcc-mingw-w64-x86-64 nsis
APP_URL="https://<your-app>.pages.dev/" bash native/windows/build.sh
```

### ⏳ Android — source ready, needs an Android build host
Complete Capacitor project in `native/android/` (manifest, Gradle, release
signing with graceful debug fallback, `MainActivity`, generated mipmap launcher
icons at all 5 densities + 512px Play Store icon).

```bash
export ANDROID_HOME=$HOME/Android/Sdk     # JDK 17 + SDK platform 35 + build-tools
bash native/android/build_android.sh      # → artifacts/*.apk and *.aab
```

**Signed Play Store `.aab`:** copy `native/android/keystore.properties.example`
→ `android/keystore.properties` and fill it in. Without it the build still
succeeds but produces a debug-signed artifact (fine for direct testing,
rejected by Play Console).

### CI
`.github/workflows/native-builds.yml` runs on `workflow_dispatch`/push and
uploads `crafthub-android` (`.apk` + `.aab`) and `crafthub-windows`
(`.exe` + `Setup.exe`) as downloadable artifacts. Add secrets
`ANDROID_KEYSTORE_BASE64`, `ANDROID_STORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
`ANDROID_KEY_PASSWORD` for a signed AAB.

### PWA (works today, no build needed)
The app is already an installable PWA — Android Chrome "Add to Home screen" and
Windows Edge/Chrome "Install app" both produce a real standalone app from the
deployed URL.
