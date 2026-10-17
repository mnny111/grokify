# Grokify

A HeyGrok-inspired conversational product and Solana token launchpad, with a real database, authenticated project ownership, versioned products, and treasury automation.

## Implemented

- Responsive white interface, animated silver robot, navigation, project search, workspace, builder, preview, documentation, treasury and activity screens.
- Sites/ChatGPT sign-in with server-side ownership checks. D1 persists projects, messages, immutable build snapshots, product data, policies, and transaction jobs.
- Guided blueprints work without API keys. Connected xAI conversations update a validated blueprint. With xAI configured, Build generates a custom HTML/CSS/JS interface connected to the supported backend modules through a restricted sandbox bridge.
- Four backend modules: launchpad child-coin drafts, AI text tools with saved results, live DexScreener watchlist snapshots, and arithmetic challenges scored on the server with replay protection.
- AES-GCM encrypted dedicated treasury per parent product. Child coins use their parent's treasury as their on-chain creator.
- Pinata metadata upload, PumpPortal token creation (zero developer purchase), creator-fee collection, Jupiter order/execute buybacks, Solana confirmation reconciliation, transaction persistence before submission, per-treasury locks, exact integer accounting, reserves and rolling daily caps.
- Scheduled runner, paused by default; no fabricated live tokens, revenue or AI replies.

## Local launch

Requires Node 22.13+ (Node 24 recommended).

```sh
npm ci
npm run build
node --import ./scripts/sites-env.mjs node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --file drizzle/0000_pretty_skaar.sql --persist-to .wrangler/state
npm run dev
```

Open http://127.0.0.1:5173 and use the local sign-in link. The development identity is intentionally local-only; production uses Sites identity. Apply the initial SQL only to a new database. For later schema changes, generate and apply only new migration files.

Windows environments with a broken npm command shim can invoke `node "C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js" ci` and `node scripts/run-framework.mjs dev` directly.

## Connect live integrations

Set runtime secrets in the hosting provider. Never put keys in source or browser code. See `.env.example` for names. Local Workers use an ignored `.dev.vars` file; hosted Sites use runtime environment variables.

| Setting | Purpose |
|---|---|
| `XAI_API_KEY` | Real Grok conversation, generated interfaces and AI tools |
| `XAI_MODEL` | Configurable xAI model; default `grok-4.7` |
| `SOLANA_RPC_URL` | Dedicated mainnet RPC with transaction history |
| `PINATA_JWT` | Upload token logo and metadata |
| `TREASURY_MASTER_KEY` | 32 random bytes encoded as base64; encrypts per-product keys |
| `ENABLE_MAINNET` | Must equal `true` to permit launch/claim/buyback signing |
| `JUPITER_API_KEY` | Optional higher-limit Jupiter access |
| `RUNNER_SECRET` | Long random secret protecting `/api/runner` |

Generate encryption material in your own secure terminal/password manager and store it directly as a secret. Back up the master key and database together. This is a custodial implementation: the server controls treasury keys. It has no user-facing withdrawal/recovery UI and is not ready to accept public customer deposits without operational review.

Create a treasury from the Token & treasury tab, fund it from your own wallet, launch the main token, reconcile the transaction, then enable a spending policy. A minimum balance check of 0.02 SOL is not a guaranteed estimate of provider/network costs. Child coins share the parent's creator wallet. Existing unrelated tokens cannot be attached to claim their fees.

## Revenue runner

Run `node scripts/revenue-runner.mjs` as an always-on process, or `node scripts/revenue-runner.mjs --once` from a scheduler. Supply `GROKIFY_ORIGIN` and `RUNNER_SECRET`. For a private Site also supply its authorized `SITES_SERVICE_TOKEN`; keep the Site private. The Node runner can run on Railway as a worker process with those environment variables. The app itself currently uses Sites/Cloudflare D1, not a drop-in Railway Node web server.

A cycle reconciles pending signatures, then either buys from the accumulated eligible allocation or claims creator fees (at most hourly). Only confirmed claim transaction SOL deltas are counted as revenue. Treasury deposits are excluded. Purchases are capped by eligible revenue, balance after reserve, per-trade cap and rolling 24-hour cap. Raising the percentage applies to cumulative recorded receipts. Purchased tokens remain in the treasury, not burned or distributed.

Transactions are persisted before broadcast. Uncertain submissions block new financial work until reconciled. An expired transaction without a recorded signature becomes retryable; reliable RPC transaction history is essential. Provider errors remain visible in activity. Locks expire after 3 minutes; calls are bounded. The provided runner processes up to 20 enabled parent products per tick; larger installations require fair batching/queue scheduling.

## Product generation boundary

AI produces a custom frontend, not unrestricted server code. Generated code runs in an opaque-origin iframe with external connections, navigation, forms and same-origin access blocked. Its message bridge allows only the selected module's operations. It cannot sign transactions or read secrets. The hosted runtime supplies the actual backend functionality.

The launchpad currently permits its owner to prepare treasury-funded child coins. Open public launches require a sponsorship/payment and abuse-control design. AI tools, dashboards and games do not yet collect subscription/payment revenue; their token creator fees can fund the implemented buybacks. Browser speech recognition provides voice input; xAI realtime voice and a Grok MCP connector are not implemented.

The default token logo is a generated SVG monogram. Custom logo upload, arbitrary external integrations, unrestricted generated backend hosting, wallet withdrawals, fee-sharing configurations, and production billing are not implemented. These are explicit scope boundaries, not mocked features.

## Verification — 17 October 2026

- TypeScript check and production build passed.
- Eight unit tests passed for exact amount conversion, spend caps, reserve protection and blueprint validation.
- Eighteen API integration checks passed against the real local D1 instance: authentication, cross-origin protection, persistent projects/messages/builds, optimistic revisions, product runtimes, real scoring, replay rejection, child coin association, and fail-closed live integration states.
- Browser verified desktop homepage, 390px mobile iframe layout, local sign-in, project creation, build/preview and a successful game answer saved to history.
- No xAI account, Pinata account, treasury key, dedicated RPC or funded wallet was supplied. AI generation, token launches, fee claims and swaps are implemented but NOT verified live end-to-end. No financial transaction was performed.
- Live deployments have a separate empty database; local QA records are not published.

```sh
node --test tests/domain.test.mjs
node tests/integration.mjs
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm run build
```

Integration tests are local-only and create QA records. Unit tests are not evidence of funded financial correctness.

## Provider references checked during implementation

- https://docs.x.ai/developers/rest-api-reference/inference/chat-completions
- https://pumpportal.fun/creation/
- https://pumpportal.fun/creator-fee/
- https://github.com/pump-fun/pump-public-docs
- https://developers.jup.ag/docs/swap/order-and-execute

Pump APIs evolve. Recent fee-account/sweep changes and shared-fee tokens need real-chain compatibility verification. This implementation uses single-recipient creator wallets; it does not configure immutable Pump fee shares. Do not enable unattended mainnet execution until a small funded test verifies the current provider behavior and all receipts.

## Coin websites and public launchpad

- `/launchpad` lists all confirmed tokens across owners, including child coins. Search by name, ticker or mint, with 24-item pagination. Drafts and submitted-but-unconfirmed launches are excluded.
- Projects reserve a permanent unique `site_slug` on creation (existing projects reserve one on their next build). Duplicate names receive an ID suffix. Existing built projects without a slug retain a stable `p-<project-id>` fallback.
- `/sites/<slug>` displays the published product, token identity and a voice-capable assistant restricted to public project details. A child coin can display its parent product when it has no own build. Unbuilt and unlaunched drafts return 404 from the public site API.
- New token metadata links to the coin's website. Previously minted metadata is not rewritten.
- Public payloads omit private prompts, ownership IDs, encrypted keys and unpublished blueprint changes.
- Migration `0001_aberrant_sleepwalker.sql` adds the nullable unique site name; it must run against the same database used by the application.

### grokify.fun and Railway

The Worker routes `slug.grokify.fun/` to `/sites/slug`. `PRODUCT_BASE_DOMAIN` defaults to `grokify.fun`. Keep `PRODUCT_SUBDOMAINS_ENABLED=false` until wildcard DNS, TLS, routing, and the production database are verified; existing `/sites/` links remain usable meanwhile. Set it to `true` only on the deployment actually serving those subdomains.

On Railway, attach `grokify.fun` and `*.grokify.fun` to the web service's HTTP port. Use the exact DNS and certificate-validation records provided by Railway. One wildcard routes future coin names without creating a DNS record for every coin. Do not add guessed DNS targets.

**Hosting boundary:** the working Sites deployment uses managed Cloudflare D1 migrations and a trusted identity gateway. The current `npm start` command is Wrangler local preview, not a production Railway database/authentication adapter. Deploying that command to Railway does not configure persistent production storage or real user sign-in. Complete that integration before accepting customer data or funds. Custom product hosts strip untrusted Sites identity headers; public reads work with a configured database, but authenticated writes require a real Railway-compatible identity integration. Never inject a shared owner identity or a Sites bypass credential to make public requests work.

Tests: `node --test tests/sites.test.mjs` and `node tests/sites-integration.mjs`. `node tests/directory-integration.mjs` verifies 26-token pagination and cross-owner listings using temporary local-only fixtures which it removes afterward. These fixture tests do not prove on-chain launches or wildcard DNS readiness.
