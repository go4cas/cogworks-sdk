import type { HttpClient } from "./client.ts";
import { VaultbaseError } from "./errors.ts";
import type { AnyRecord, ListOptions } from "./types.ts";

const MAX_OPS = 100;

type Op =
  | { method: "GET";    path: string }
  | { method: "POST";   path: string; body: unknown }
  | { method: "PATCH";  path: string; body: unknown }
  | { method: "DELETE"; path: string };

export interface BatchResult {
  data: Array<{ status: number; body: unknown }>;
}

export class Batch {
  private ops: Op[] = [];
  constructor(private readonly client: HttpClient) {}

  create(collection: string, body: AnyRecord): this {
    this.ops.push({ method: "POST", path: `/api/${enc(collection)}`, body });
    return this;
  }

  update(collection: string, id: string, body: AnyRecord): this {
    this.ops.push({ method: "PATCH", path: `/api/${enc(collection)}/${enc(id)}`, body });
    return this;
  }

  delete(collection: string, id: string): this {
    this.ops.push({ method: "DELETE", path: `/api/${enc(collection)}/${enc(id)}` });
    return this;
  }

  get(collection: string, id: string): this {
    this.ops.push({ method: "GET", path: `/api/${enc(collection)}/${enc(id)}` });
    return this;
  }

  list(collection: string, query: ListOptions = {}): this {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      params.set(k, String(v));
    }
    const qs = params.toString();
    this.ops.push({ method: "GET", path: `/api/${enc(collection)}${qs ? `?${qs}` : ""}` });
    return this;
  }

  size(): number { return this.ops.length; }

  async run(): Promise<BatchResult> {
    if (this.ops.length === 0) return { data: [] };
    if (this.ops.length > MAX_OPS) {
      throw VaultbaseError.validation(`Batch exceeds ${MAX_OPS} ops`, { batch: `Got ${this.ops.length} ops` });
    }
    return await this.client.request<BatchResult>("/api/batch", {
      method: "POST",
      body: { operations: this.ops },
    });
  }
}

function enc(s: string): string { return encodeURIComponent(s); }
