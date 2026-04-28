import type { HttpClient } from "./client.ts";
import type {
  AnyRecord,
  CollectionTypes,
  ListOptions,
  ListResponse,
  MutationOptions,
} from "./types.ts";

/**
 * Typed CRUD interface for a single collection. Generic params:
 *   R — the record type (from `Schema[K]['record']`)
 *   C — the create-input type (from `Schema[K]['create']`)
 *   U — the update-input type (from `Schema[K]['update']`)
 */
export class Collection<
  R extends AnyRecord = AnyRecord,
  C extends AnyRecord = AnyRecord,
  U extends AnyRecord = AnyRecord,
> {
  constructor(private readonly client: HttpClient, private readonly name: string) {}

  /** Paginated list. Filters / sort / expand pass through to the server expression engine. */
  async list(options: ListOptions = {}): Promise<ListResponse<R>> {
    const query: Record<string, string | number | boolean | undefined> = {
      page: options.page,
      perPage: options.perPage,
      filter: options.filter,
      sort: options.sort,
      expand: options.expand,
      fields: options.fields,
      skipTotal: options.skipTotal ? "1" : undefined,
    };
    return await this.client.request<ListResponse<R>>(`/api/${this.encName()}`, {
      query,
      ...(options.requestKey !== undefined ? { requestKey: options.requestKey } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    });
  }

  /** Iterate every record matching the filter. Internal pagination. */
  async *iterate(options: Omit<ListOptions, "page"> = {}): AsyncGenerator<R, void, void> {
    const perPage = options.perPage ?? 100;
    let page = 1;
    while (true) {
      const res = await this.list({ ...options, page, perPage });
      for (const r of res.data) yield r;
      if (res.data.length < perPage || page >= res.totalPages) return;
      page++;
    }
  }

  async get(id: string, opts: MutationOptions = {}): Promise<R> {
    return await this.client.request<R>(`/api/${this.encName()}/${enc(id)}`, opts);
  }

  async create(body: C, opts: MutationOptions = {}): Promise<R> {
    return await this.client.request<R>(`/api/${this.encName()}`, {
      method: "POST",
      body,
      ...opts,
    });
  }

  async update(id: string, body: U, opts: MutationOptions = {}): Promise<R> {
    return await this.client.request<R>(`/api/${this.encName()}/${enc(id)}`, {
      method: "PATCH",
      body,
      ...opts,
    });
  }

  async delete(id: string, opts: MutationOptions = {}): Promise<null> {
    return await this.client.request<null>(`/api/${this.encName()}/${enc(id)}`, {
      method: "DELETE",
      ...opts,
    });
  }

  private encName(): string { return enc(this.name); }
}

/** Helper type bridging Schema to Collection generics. */
export type CollectionFor<T extends CollectionTypes> = Collection<T["record"], T["create"], T["update"]>;

function enc(s: string): string { return encodeURIComponent(s); }
