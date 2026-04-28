# vaultbase

Official TypeScript SDK for [Vaultbase](https://vaultbase.dev) — a typed
REST + WebSocket / SSE client. Zero dependencies, ESM + CJS dual build,
works in browsers, Node 18+, Bun, and Deno.

```bash
npm install vaultbase
```

## Quick start

```ts
import { Vaultbase } from "vaultbase";
import type { Schema } from "./vaultbase-schema.gen";  // optional, from codegen

const vb = new Vaultbase<Schema>({ baseUrl: "https://api.example.com" });

// Auth
const { token, record } = await vb.auth.users.login({
  email: "alice@x.com",
  password: "supersecret",
});

// Records — typed end-to-end
const post = await vb.collection("posts").create({ title: "hi", author: record.id });

const list = await vb.collection("posts").list({
  filter: 'published = true',
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

// Batch (≤ 100 ops, atomic)
await vb.batch()
  .create("posts", { title: "x" })
  .update("posts", "id1", { title: "y" })
  .delete("posts", "id2")
  .run();
```

## Codegen

Snapshot mode (recommended):

```bash
# One-time: capture the schema
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api.example.com/api/admin/migrations/snapshot \
  > vaultbase-schema.json

# Anyone can regen types from the committed JSON, no admin token:
npx vb-types --schema=./vaultbase-schema.json --out=./vaultbase-schema.gen.ts
```

Live mode (dev only):

```bash
npx vb-types --url=https://api.example.com --admin-token=$VB_ADMIN
```

## Auth stores

Default browser store is `SessionStorageAuthStore` (survives F5, dies on
tab close — XSS-safer than `localStorage`). Default off-browser is
`MemoryAuthStore`.

```ts
import { LocalStorageAuthStore, CookieAuthStore } from "vaultbase";

const vb = new Vaultbase({
  baseUrl,
  // For cross-tab persistence (XSS exposure caveat applies):
  authStore: new LocalStorageAuthStore(),
});

// SSR / cookie deployments — host writes the HttpOnly cookie:
const vb2 = new Vaultbase({
  baseUrl,
  authStore: new CookieAuthStore(),
  authTransport: "cookie-only",
});
```

## Error handling

Every call rejects with a `VaultbaseError`. Switch on `kind` instead of
string-matching:

```ts
import { isVaultbaseError } from "vaultbase";

try {
  await vb.collection("posts").create({});
} catch (e) {
  if (!isVaultbaseError(e)) throw e;
  switch (e.kind) {
    case "validation":    showFieldErrors(e.data.details); break;
    case "auth":          redirectToLogin(); break;
    case "rate_limit":    await sleep(e.data.retryAfterMs); break;
    case "network":       toast("offline"); break;
    case "conflict":      reload(); break;
    case "server":        report(e.data.status); break;
    case "aborted":       /* intentional, ignore */ break;
  }
}
```

## Auto-cancel

Off by default. Opt in per call:

```ts
vb.collection("posts").list(
  { filter: `title ~ "${q}"` },
  { requestKey: "search-box" }, // new request with same key aborts the previous
);
```

## Realtime

WebSocket-first. Falls back to SSE when WS is blocked. Reconnects with
exponential backoff + jitter; re-subscribes on every reconnect.

```ts
const off = vb.subscribe("posts", "*",     (e) => {});
const off2 = vb.subscribe("posts", "abc123", (e) => {});  // single record
const off3 = vb.subscribe("posts", ["a","b"], (e) => {}); // multi
```

The server's `security.allowed_origins` setting must include your page's
origin. SDK surfaces upgrade rejection as `{ kind: "auth", reason: "forbidden" }`.

## Versioning

SDK semver is independent of the server. The `vaultbaseServerCompat`
field in `package.json` advertises the supported server range. SDK
patch / minor releases never require a server upgrade.

## License

MIT.
