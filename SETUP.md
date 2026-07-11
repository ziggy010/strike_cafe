# Go-live guide

The app currently runs in **demo mode** (localStorage + BroadcastChannel). This is fully
functional on one device/network of browser tabs and is the right way to evaluate the
product with café staff. Going live means three steps: hosting, Supabase, and printing QR
codes.

## 1. Host the app (free)

1. Push this folder to GitHub.
2. Import it into [Vercel](https://vercel.com) — accept the defaults. You'll get a URL
   like `strike-yard.vercel.app`; connect a custom domain later if you want.

The demo mode works immediately on the hosted URL. You can already print QR codes and
trial-run the café on it — data stays on each device, so use one shared staff
device/browser during the trial.

## 2. Move data to Supabase (multi-device, durable)

Demo mode's limitation: each device has its own data. For real service (customer phones
→ kitchen screen) you need the shared backend:

1. Create a project at [supabase.com](https://supabase.com) (free tier is enough).
2. SQL Editor → paste and run `supabase/schema.sql`.
3. Database → Replication → enable Realtime for `orders`, `order_lines`, `waiter_calls`.
4. Storage → create a public bucket `menu-photos`.
5. Authentication → add staff emails; insert matching rows in the `staff` table with roles.
6. Project Settings → API → copy the URL and anon key into `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```
7. **Adapter step (development task):** implement the Supabase adapter behind the store
   interface in `src/lib/store.ts`. Every screen already talks to that one class — the
   swap touches no UI code. The schema mirrors `src/lib/types.ts` one-to-one.
   `@supabase/supabase-js` is already installed.

This step is deliberately left for when real credentials exist, so it can be built and
tested against the live project instead of shipped blind.

## 3. Print table QR codes

Staff panel → Tables → **Print all** (or download PNGs per table). Laminate and stick to
tables. QRs encode `https://<your-domain>/t/<table-id>` — they survive menu changes.

## Phase 2 backlog (recommended order)

1. **Supabase adapter** (above) — the real multi-device backend.
2. **eSewa/Khalti payment** at order time — needs merchant onboarding with each provider;
   keep cash/counter-QR as fallback during rush hours.
3. **Receipt printing** — ESC/POS via a cheap Bluetooth thermal printer from the staff
   phone, or browser print of the order card.
4. **Push notifications** for "order ready" (PWA push needs HTTPS + user opt-in).
5. **Loyalty punch card** keyed on customer phone number at feedback time.
