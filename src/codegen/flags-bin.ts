/**
 * `vb-flags` CLI. Reads flag definitions from a running vaultbase admin
 * API, emits a `flags.gen.ts` augmenting the SDK's `FlagSchema` interface.
 *
 *   vb-flags --url=https://api.example.com --admin-token=$TOKEN > flags.gen.ts
 */
import { promises as fs } from "node:fs";
import { resolve, dirname } from "node:path";
import { fetchFlags, generateFlagTypes } from "./flags.ts";

interface Args { url: string; adminToken: string; out: string }

function parseArgs(argv: string[]): Args {
  const args: Args = { url: "", adminToken: "", out: "./flags.gen.ts" };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] ?? "";
    if (a.startsWith("--url=")) args.url = a.slice("--url=".length);
    else if (a === "--url") { const v = argv[++i]; if (v) args.url = v; }
    else if (a.startsWith("--admin-token=")) args.adminToken = a.slice("--admin-token=".length);
    else if (a === "--admin-token") { const v = argv[++i]; if (v) args.adminToken = v; }
    else if (a.startsWith("--out=")) args.out = a.slice("--out=".length);
    else if (a === "--out" || a === "-o") { const next = argv[++i]; if (next) args.out = next; }
    else if (a === "--help" || a === "-h") { printUsage(); process.exit(0); }
  }
  return args;
}

function printUsage(): void {
  process.stdout.write(
`vb-flags — generate TypeScript types from a vaultbase server's feature flags

Usage:
  vb-flags --url=<server-url> --admin-token=<token> [--out=flags.gen.ts]

Pipe to stdout when --out is - (single dash).

Example:
  vb-flags --url=https://api.example.com --admin-token=$ADMIN_TOKEN -o ./src/flags.gen.ts
`);
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.url || !args.adminToken) { printUsage(); process.exit(1); }

  const flags = await fetchFlags({ url: args.url, adminToken: args.adminToken });
  const out = generateFlagTypes(flags);
  if (args.out === "-") {
    process.stdout.write(out);
    return;
  }
  const outPath = resolve(args.out);
  await fs.mkdir(dirname(outPath), { recursive: true });
  // Atomic write — same envelope as vb-types.
  const tmp = `${outPath}.tmp-${process.pid}`;
  await fs.writeFile(tmp, out, "utf8");
  await fs.rename(tmp, outPath);
  process.stdout.write(`wrote ${outPath} (${flags.length} flag${flags.length === 1 ? "" : "s"})\n`);
}

main().catch((err) => {
  process.stderr.write(`vb-flags failed: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
