import type { HttpClient } from "./client.ts";

/**
 * Helpers for admin-defined custom routes mounted at `/api/v1/custom/<path>`.
 *
 *   const stats = await vb.custom.get<{ active: number }>("/stats/active-users");
 */
export class Custom {
  constructor(private readonly client: HttpClient) {}

  private path(p: string): string {
    return `/api/v1/custom${p.startsWith("/") ? "" : "/"}${p}`;
  }

  async get<T = unknown>(p: string, query?: Record<string, string>): Promise<T> {
    return await this.client.request<T>(this.path(p), query ? { query } : {});
  }
  async post<T = unknown>(p: string, body?: unknown): Promise<T> {
    return await this.client.request<T>(this.path(p), { method: "POST", body });
  }
  async patch<T = unknown>(p: string, body?: unknown): Promise<T> {
    return await this.client.request<T>(this.path(p), { method: "PATCH", body });
  }
  async put<T = unknown>(p: string, body?: unknown): Promise<T> {
    return await this.client.request<T>(this.path(p), { method: "PUT", body });
  }
  async delete<T = unknown>(p: string): Promise<T> {
    return await this.client.request<T>(this.path(p), { method: "DELETE" });
  }
}
