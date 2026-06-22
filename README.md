# OpenHeart Initiative — cardiac risk check

Free, anonymous, 13-question heart-disease risk assessment for underserved and
uninsured Americans. Static site, zero dependencies, zero build step. Scoring
runs entirely in the browser; the only thing ever sent anywhere is the optional
ZIP code, which goes to a small Cloudflare Worker that looks up nearby free
clinics.

## Layout

| Path | Purpose |
|---|---|
| `index.html` | Landing page + quiz + results (single-page, three views) |
| `styles.css` | All styling |
| `app.js` | Questions, weights, scoring, results, clinic rendering |
| `favicon.svg` | Heart + EKG mark |
| `worker/worker.js` | Clinic-lookup Worker (HRSA proxy, token stays server-side) |
| `worker/zips.js` | ZIP → lat/lon table (33,791 ZCTAs, 2024 Census gazetteer) |
| `worker/wrangler.toml` | Worker config |
| `worker/.dev.vars` | Local-only HRSA token (gitignored, never commit) |

Scoring follows the OpenHeart technical spec v1.0: 12 weighted questions,
additive score, max 25. Tiers: 0–8 lower · 9–16 moderate · 17–25 higher.
Chest pain always triggers a call-911 banner regardless of score.

## How the clinic lookup works

`GET <worker>/?zip=22903` → the Worker geocodes the ZIP from the bundled
Census table, calls HRSA's `GetHealthCentersAroundALocation` (starts at 15
miles, auto-expands to 100 until it finds 3 centers, which matters for rural
users), and returns the 5 nearest service-delivery sites as JSON. Responses
are cached at the edge for 7 days. The HRSA registration token lives only in
the Worker secret, never in page source. Nothing is logged or stored.

## Run locally

```sh
# site
cd ~/Desktop/OpenHeart && python3 -m http.server 8080

# worker (separate terminal; reads token from worker/.dev.vars)
cd ~/Desktop/OpenHeart/worker && npx wrangler dev --port 8787
```

Then in the browser console: `window.OPENHEART_API = 'http://localhost:8787'`
(or temporarily set `CLINIC_API` in app.js) and run the quiz.

## Deploy

**Worker first:**

```sh
cd worker
npx wrangler login
npx wrangler secret put HRSA_TOKEN     # paste the HRSA token
npx wrangler deploy                    # prints https://openheart-clinics.<acct>.workers.dev
```

**Then the site:** set `CLINIC_API` at the top of `app.js` to that Worker URL,
and deploy the folder (minus `worker/`) to Cloudflare Pages — either drag and
drop in the dashboard (Workers & Pages → Create → Pages → Upload assets) or
connect a GitHub repo (build command: none, output dir: `/`).

Add the custom domain under Pages → Custom domains once it's registered.

## Before public launch

- [ ] Dr. Fitch (medical advisor) signs off on question wording, weights, tier
      thresholds, and all results copy — required by the spec.
- [ ] Deploy the Worker and set `CLINIC_API` in app.js.
- [ ] Tighten the Worker CORS header from `*` to the production origin.
- [ ] Register openheartinitiative.org (Cloudflare Registrar, ~$11/yr).
- [ ] Spanish translation.
- [ ] Optional Phase 2: Claude Haiku personalized recommendation paragraphs
      via a Worker (~$0.003/assessment).
