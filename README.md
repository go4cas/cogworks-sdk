# @cogworks/sdk

Official TypeScript SDK for [Cogworks](https://cogworks.dev) — a typed
REST + WebSocket / SSE client. Zero runtime dependencies, ESM + CJS dual
build, works in browsers, Node 18+, Bun, and Deno.

```bash
npm install @cogworks/sdk
# or
bun add @cogworks/sdk
```

## Quick start

```ts
import { Cogworks } from "@cogworks/sdk";
import type { Schema } from "./cogworks-schema.gen";  // optional, from codegen

const vb = new Cogworks<Schema>({ baseUrl: "https://api.example.com" });

// Auth
const { token, record } = await vb.auth.users.login({
  email: "alice@x.com",
  password: "supersecret",
});

// Records — typed end-to-end
const post = await vb.collection("posts").create({ title: "hi", author: record.id });

// Safe filter via tagged template (escapes + quotes per type)
const list = await vb.collection("posts").list({
  filter: vb.q`status = ${"published"} && title ~ ${userTerm}`,
  sort: '-created',
  perPage: 30,
});

// Realtime — WebSocket with SSE auto-fallback
const off = vb.subscribe("posts", "*", (e) => {
  console.log(e.type, e.record);
});
off();

// Files
const meta = await vb.files.upload("posts", post.id, "cover", file, {
  onProgress: ({ loaded, total }) => console.log(loaded / total),
});
const url = vb.files.url(meta.filename);

// Batch (≤ 100 ops, atomic, per-op tuple result)
const [created, fetched, listed] = await vb.batch()
  .create("posts", { title: "x" })
  .get("users", "u1")
  .list("posts", { perPage: 10 })
  .run();
created.body.title;          // typed as PostRecord
fetched.body.email;          // typed as UserRecord
listed.body.data[0].title;   // typed as ListResponse<PostRecord>
```

## Typed filter builder (`vb.q`)

Tagged-template filter that handles encoding + escaping per JS type. Stops
quote-bug + injection-shaped mistakes at the type system layer.

```ts
import { Cogworks, field } from "@cogworks/sdk";

const term = req.query.q;
const filter = vb.q`title ~ ${term} && status = ${"published"} && deleted = ${false}`;
//                  ↓
//   `title ~ "hello" && status = "published" && deleted = false`
```

| Value | Encoded as |
|---|---|
| `string` | quoted with `"…"`, embedded `\` and `"` escaped |
| `number` | bare; rejects `NaN` / `±Infinity` |
| `boolean` | `true` / `false` |
| `null` | `null` |
| `Date` | quoted ISO-8601 string |
| `Array<…>` | `(v1, v2, …)` for use with `?=` / `?~` array-prefix ops |
| `field("name")` | bare identifier (validated against the same regex the server uses) |
| `undefined` | **throws** — use `null` |
| anything else | **throws** |

`field()` is the escape hatch when the *column* is dynamic:

```ts
const col = userPicked === "title" ? "title" : "created_at";
const f = vb.q`${field(col)} != ${null}`;
```

## Optimistic concurrency (ETag / `If-Match`)

The SDK auto-caches per-record ETags from `GET /api/v1/<col>/<id>` responses
and auto-attaches `If-Match` on the next `update` / `delete`:

```ts
const post = await vb.collection("posts").get("p1");
//   → vb.client.etags now has W/"<updated_at>" cached for posts:p1

await vb.collection("posts").update("p1", { title: "new" });
//   → PATCH /api/v1/posts/p1
//     If-Match: W/"<cached>"
//
// If the record changed since the get, the server returns 412 and the SDK
// throws CogworksError(kind: "precondition_failed", currentEtag).
```

Per-call overrides:

```ts
await coll.update("p1", body, { ifMatch: false });        // skip precondition
await coll.update("p1", body, { ifMatch: storedEtag });   // explicit override
```

Catching the conflict:

```ts
try {
  await coll.update("p1", body);
} catch (e) {
  if (isCogworksError(e) && e.kind === "precondition_failed") {
    const fresh = await coll.get("p1");
    // …re-merge edits, retry…
  }
}
```

A successful `delete` clears the cached entry so a subsequent re-create
doesn't carry the stale tag forward.

## Codegen — `cw-types`

Snapshot mode (recommended):

```bash
# One-time: capture the schema
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api.example.com/api/v1/admin/migrations/snapshot \
  > cogworks-schema.json

# Anyone can regen types from the committed JSON, no admin token:
npx cw-types --schema=./cogworks-schema.json --out=./cogworks-schema.gen.ts
```

Live mode (dev only):

```bash
npx cw-types --url=https://api.example.com --admin-token=$CW_ADMIN
```

## Schema migrations — `cw-migrate`

Diff and apply schema snapshots between environments. Three subcommands hit
the existing `/api/v1/admin/migrations/{snapshot,diff,apply}` endpoints.

```bash
# Pull a snapshot from prod
npx cw-migrate pull \
  --url=https://prod.example.com --admin-token=$PROD \
  --out=./schema.json

# Diff against staging
npx cw-migrate diff \
  --url=https://staging.example.com --admin-token=$STAGING \
  --schema=./schema.json

# Apply (requires --yes; refuses in non-interactive contexts otherwise)
npx cw-migrate apply \
  --url=https://staging.example.com --admin-token=$STAGING \
  --schema=./schema.json --mode=additive --yes
```

Modes:
- `additive` (default) — only create missing collections / fields. Never updates.
- `sync` — also push updates to existing collections to match the snapshot.

Flags:
- `--yes` / `-y` — required for non-interactive apply
- `--dry-run` — diff + plan, exit before writing

Programmatic API at `@cogworks/sdk/migrate`:

```ts
import { pullSnapshot, diffSnapshot, applySnapshot } from "@cogworks/sdk/migrate";

const snap = await pullSnapshot({ url, adminToken });
const diff = await diffSnapshot(snap, { url: targetUrl, adminToken });
if (diff.some((d) => d.kind !== "unchanged")) {
  await applySnapshot(snap, { url: targetUrl, adminToken, mode: "sync" });
}
```

## Auth stores

Default browser store is `SessionStorageAuthStore` (survives F5, dies on
tab close — XSS-safer than `localStorage`). Default off-browser is
`MemoryAuthStore`.

```ts
import { LocalStorageAuthStore, CookieAuthStore } from "@cogworks/sdk";

const vb = new Cogworks({
  baseUrl,
  // For cross-tab persistence (XSS exposure caveat applies):
  authStore: new LocalStorageAuthStore(),
});

// SSR / cookie deployments — host writes the HttpOnly cookie:
const vb2 = new Cogworks({
  baseUrl,
  authStore: new CookieAuthStore(),
  authTransport: "cookie-only",
});
```

## Error handling

Every call rejects with a `CogworksError`. Switch on `kind` instead of
string-matching:

```ts
import { isCogworksError } from "@cogworks/sdk";

try {
  await vb.collection("posts").create({});
} catch (e) {
  if (!isCogworksError(e)) throw e;
  switch (e.kind) {
    case "validation":          showFieldErrors(e.data.details); break;
    case "auth":                redirectToLogin(); break;
    case "rate_limit":          await sleep(e.data.retryAfterMs); break;
    case "network":             toast("offline"); break;
    case "conflict":            reload(); break;
    case "precondition_failed": reloadAndMerge(e.data.currentEtag); break;
    case "server":              report(e.data.status); break;
    case "aborted":             /* intentional, ignore */ break;
  }
}
```

## Auto-cancel

Off by default. Opt in per call:

```ts
vb.collection("posts").list(
  { filter: vb.q`title ~ ${q}` },
  { requestKey: "search-box" }, // new request with same key aborts the previous
);
```

## Realtime

WebSocket-first. Falls back to SSE when WS is blocked. Reconnects with
exponential backoff + jitter; re-subscribes on every reconnect.

```ts
const off  = vb.subscribe("posts", "*",          (e) => {});
const off2 = vb.subscribe("posts", "abc123",     (e) => {});  // single record
const off3 = vb.subscribe("posts", ["a", "b"],   (e) => {});  // multi-topic
```

The server's `security.allowed_origins` setting must include your page's
origin. SDK surfaces upgrade rejection as `{ kind: "auth", reason: "forbidden" }`.

## Sub-path exports

| Import | Purpose |
|---|---|
| `@cogworks/sdk` | Main client + auth + records + filter + batch |
| `@cogworks/sdk/realtime` | Standalone realtime manager (advanced — `vb.subscribe` covers the common case) |
| `@cogworks/sdk/codegen` | Programmatic schema → TS code generation |
| `@cogworks/sdk/migrate` | `pullSnapshot` / `diffSnapshot` / `applySnapshot` for env-to-env workflows |

## Versioning

SDK semver is independent of the server. The `cogworksServerCompat`
field in `package.json` advertises the supported server range. SDK
patch / minor releases never require a server upgrade.

## License

MIT.
