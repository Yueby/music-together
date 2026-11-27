# Music Together Cloudflare Worker

This optional Worker accelerates selected API routes on the proxied Music Together hostname. Origin requests continue through the existing Cloudflare Tunnel to the VPS.

| Module | Edge behavior |
| --- | --- |
| Mini-app audio | The VPS authenticates and resolves the request. The Worker streams validated audio from the provider CDN with a 32 MiB cap and private, no-store caching. |
| Covers | The Worker caches allowlisted raster images for 24 hours. The Web limit is 3 MiB and the mini-app limit is 2 MiB. Transient CDN failures fall back to the VPS. |
| Public metadata | Eligible same-origin GETs use a cookie-independent edge cache. Origin reads forward only the `mt_identity` cookie for VPS rate limiting. |

Audio resolution has a 15-second budget including the JSON body. Resolve transport errors and timeouts return `503 MEDIA_RELAY_FAILED`. VPS responses without a relay resolution pass through with their original status and body. Invalid resolve JSON or a rejected CDN response triggers `X-MT-Relay: fallback-v1` with `X-MT-Relay-Reason` set to `origin`, `network`, `encoding`, `length`, or `size`. CDN and fallback headers have 6- and 25-second deadlines respectively, for a combined maximum header-wait budget of 46 seconds. Valid declared lengths use a fixed-length stream. Responses without a length are streamed with a byte counter. Once response headers have been sent, a length mismatch or cap violation ends the download with a stream error.

Audio `Server-Timing` reports `vps_resolve`, `cdn_ttfb`, and `total` in milliseconds as available, plus `fallback;desc="<reason>"` on fallback. `total` ends when Worker response headers are ready. Audio CORS exposes `Server-Timing`, and `Timing-Allow-Origin` uses `ALLOWED_MAPP_ORIGIN` when configured.

Cover cache keys and upstream requests retain only a valid NetEase `param` (for example, `600y600`). Other query parameters, including all QQ and Kugou cover query parameters, are dropped.

Metadata TTLs are 3 minutes for search, 5 minutes for artist pages and public playlists, 10 minutes for radar, and 30 minutes for lyrics. TTML honors origin max-age up to 6 hours. Without an origin max-age, TTML defaults to 6 hours or 10 minutes for a response with `lines: null`.

Metadata cache writes skip responses with `private`, `no-store`, `no-cache`, `max-age=0`, `Vary: Cookie`, `Vary: *`, or `Set-Cookie`. Stored responses omit cookies and CORS headers.

## Deploy

1. Keep the origin hostname proxied through Cloudflare and routed to the existing Tunnel. Edit the hostname and zone in `wrangler.toml` if they differ.
2. Configure `MAPP_RELAY_SECRET` in the VPS environment and enable the desired origins and relay sources on the VPS.
3. Set the three independent switches in `[vars]`. Each accepts `"false"` or `"0"` to pass requests directly to the VPS. Omitted switches default to enabled.
4. From this directory, use an authenticated Wrangler CLI and enter the same secret value as the VPS when prompted.

   ~~~sh
   wrangler secret put MAPP_RELAY_SECRET
   wrangler deploy
   ~~~

5. In the Cloudflare Dashboard, enable **Fail open (proceed)** on every Worker route. The API setting is `request_limit_fail_open`. Set it after route creation and verify it after changing routes. It is managed in the Dashboard or API, outside `wrangler.toml`.
6. Also configure a Cloudflare **Cache Rule** for the PWA entry files (`/sw.js`, `/registerSW.js`, `/manifest.webmanifest`) with **Bypass cache** + **Browser TTL: Respect origin** so Cloudflare's default 4-hour Browser Cache TTL does not override the origin's `Cache-Control: no-cache`. See [docs/architecture/deployment.md](../../docs/architecture/deployment.md) for the exact filter expression and full Cloudflare setup checklist.

Use Worker routes and keep the trailing `*` for query strings. The Worker checks the pathname, so `/api/music/playlist/mine` continues to the VPS. Never mount `/*` or use a Custom Domain. Worker observability is disabled. Keep credentials and signed media URLs out of logs.

## Mini-app cover fast mode

Set `ALLOWED_MAPP_ORIGIN` to the exact browser origin allowed by the VPS to enable fast CORS preflights and cover GETs, and to add CORS headers to synthetic audio `503` responses when the resolve request fails. The Worker checks the Origin and bearer format. Matching requests can fetch public, allowlisted images without VPS token verification or its per-user rate limit. Leave the variable unset to route authenticated cover requests through VPS verification. Requests containing `mini_app_token` always go to the VPS.

Cover and metadata responses report cache activity with `X-MT-Edge-Cache` and `Server-Timing` (`edge`, plus `origin` on a miss). To disable a module, set its switch to `"false"` and redeploy. To disable the entire Worker, remove the Worker routes in Cloudflare.

## Verify from the repository root

~~~sh
pnpm exec vitest run deploy/cf-worker
pnpm --filter @music-together/client exec tsc -p ../../deploy/cf-worker/tsconfig.json --noEmit
~~~
