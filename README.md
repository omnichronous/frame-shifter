# Frame Shifter

Visual multi-city flight itinerary planner. Users build routes by clicking price markers on a map, then book via deep links.

## Architecture

- **Two pages:** `/map` (route builder) and `/bookings` (trip options + deep links)
- **Backend:** n8n webhooks on top of Kiwi Tequila API (`one_per_city` param, "to anywhere" search)
- **State:** cookie-based via `useItinerary` (solo / bookings). With `?room=`, PartyServer is source of truth for legs and mirrors into cookies.
- **API wrapper:** `useAPI` composable wraps all n8n calls with `useFetch` + base URL from runtime config
- **Airport search:** server endpoint `/api/airports` reads from `server/assets/airports.csv` via Nitro storage + PapaParse
- **Deployment:** Netlify SSR (`nitro.preset: 'netlify'`), serverless functions for SSR + API routes. Production env vars: `NUXT_PUBLIC_N8N_API`, `NUXT_PUBLIC_COLLAB_HOST`
- **Collab:** PartyServer on Cloudflare Workers (`workers/collab/server.ts` + `wrangler.jsonc`); run `pnpm dev:collab` alongside `pnpm dev`

## Date Conventions

- API format: `dd/MM/yyyy` (Tequila convention)
- HTML input format: `yyyy-MM-dd`
- Conversion uses `date-fns` `parse` and `format` — never manual string manipulation

## Current Constraints

- Development cache: week-long cache on every Tequila response in n8n (rate limit protection)
- Hardcoded +3 days per leg (not yet configurable)
- Return leg supported via Finish modal ("End in [city]" vs "Return to [origin]") and origin marker hint
- Finishing enters a "finished" state on the map (icons replace price markers, View Bookings button) — does not auto-navigate to bookings
- Prices on markers may be stale — no freshness indicator in UI

## Setup

Make sure to install dependencies:

```bash
pnpm install
```

## Development Server

Start the Nuxt app on `http://127.0.0.1:3000`:

```bash
pnpm dev
```

For couples share-link sync, also start the PartyServer worker (default `127.0.0.1:8787`):

```bash
pnpm dev:collab
```

First time: `npx wrangler login` (Cloudflare account). Production: `pnpm deploy:collab`, then set Netlify `NUXT_PUBLIC_COLLAB_HOST` to `collab.frame-shifter.workers.dev` (no `https://`).

## Production

Build the application for production:

```bash
pnpm build
```

Locally preview production build:

```bash
pnpm preview
```
