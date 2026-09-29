import type { Http, HttpResult } from "./bolo.js";

export function makeHttp(baseUrl: string, token?: string): Http {
  return async (method, path, body): Promise<HttpResult> => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), path.startsWith("/api/photo") ? 8000 : 5000);
    try {
      const headers: Record<string, string> = {};
      if (body !== undefined) headers["Content-Type"] = "application/json";
      if (token) headers["X-TrashBot-Token"] = token;
      const res = await fetch(baseUrl.replace(/\/$/, "") + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: ctl.signal,
      });
      const ct = res.headers.get("content-type") ?? "";
      const data = ct.includes("json")
        ? await res.json().catch(() => null)
        : ct.startsWith("image/")
          ? new Uint8Array(await res.arrayBuffer())
          : null;
      return { ok: res.ok, status: res.status, data };
    } catch {
      return { ok: false, status: "offline", data: null };
    } finally {
      clearTimeout(timer);
    }
  };
}
