# Music Together Cloudflare Worker

This optional Worker accelerates selected API routes on the proxied Music Together hostname. Origin requests continue through the existing Cloudflare Tunnel to the VPS.

| Module | Edge behavior |
| --- | --- |
| Mini-app audio | The VPS authenticates and resolves the request. The Worker streams validated audio from the provider CDN and falls back to VPS streaming on resolution or CDN validation failure. Audio uses private, no-store caching. |
| Covers | The Worker caches allowlisted raster images for 24 hours. The Web limit is 3 MiB and the mini-app limit is 2 MiB. Transient failures fall back to the VPS. |
| Public metadata | Same-origin, unauthenticated GETs use an edge cache. The Worker strips cookies from origin requests and stores responses without cookies or CORS headers. |

Metadata TTLs are 3 minutes for search, 5 minutes for artist pages and public playlists, 10 minutes for radar, and 30 minutes for lyrics. TTML honors origin max-age up to 6 hours. Without an origin max-age, TTML defaults to 6 hours or 10 minutes for a response with `lines: null`.

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

Use Worker routes and keep the trailing `*` for query strings. The Worker checks the pathname, so `/api/music/playlist/mine` continues to the VPS. Never mount `/*` or use a Custom Domain. Worker observability is disabled. Keep credentials and signed media URLs out of logs.

## Mini-app cover fast mode

Set `ALLOWED_MAPP_ORIGIN` to the exact browser origin allowed by the VPS to enable fast CORS preflights and cover GETs, and to ensure Worker-synthesized `503 MEDIA_RELAY_FAILED` responses (when `resolve-v1` itself fails to reach origin) still carry CORS headers. The Worker checks the Origin and bearer format. Matching requests can fetch public, allowlisted images without VPS token verification or its per-user rate limit. Leave the variable unset to route authenticated cover requests through VPS verification. Requests containing `mini_app_token` always go to the VPS.

Cached image and metadata responses carry `X-MT-Edge-Cache: HIT` or `MISS`. To disable a module, set its switch to `"false"` and redeploy. To disable the entire Worker, remove the Worker routes in Cloudflare.

## Verify from the repository root

~~~sh
pnpm exec vitest run deploy/cf-worker
pnpm --filter @music-together/client exec tsc -p ../../deploy/cf-worker/tsconfig.json --noEmit
~~~
