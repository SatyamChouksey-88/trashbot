import { logSchema, statusSchema } from "./contract.js";

const DEFAULT_TIMEOUT_MS = 5000;
const PHOTO_TIMEOUT_MS = 8000;

export class RobotClient {
  constructor(
    private baseUrl = process.env.TRASHBOT_URL ?? "http://trashbot.local",
    private token = process.env.TRASHBOT_TOKEN ?? "",
  ) {}

  private headers(): HeadersInit {
    const h: Record<string, string> = {};
    if (this.token) h["X-TrashBot-Token"] = this.token;
    return h;
  }

  private friendlyNetworkError(): Error {
    return new Error(
      `Robot not reachable at ${this.baseUrl} — is it switched on and on the same WiFi as this laptop?`,
    );
  }

  async getJson(path: string, retry = true): Promise<unknown> {
    const url = `${this.baseUrl}${path}`;
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), DEFAULT_TIMEOUT_MS);
      const res = await fetch(url, { headers: this.headers(), signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (e) {
      if (retry) return this.getJson(path, false);
      throw this.friendlyNetworkError();
    }
  }

  async getStatus() {
    const data = await this.getJson("/api/status");
    return statusSchema.parse(data);
  }

  async getPhoto(): Promise<Buffer> {
    const url = `${this.baseUrl}/api/photo`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), PHOTO_TIMEOUT_MS);
    try {
      const res = await fetch(url, { headers: this.headers(), signal: ctrl.signal });
      clearTimeout(t);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch {
      throw this.friendlyNetworkError();
    }
  }

  async postJson(path: string, body: unknown, retries = 0): Promise<unknown> {
    const url = `${this.baseUrl}${path}`;
    let lastErr: unknown;
    for (let i = 0; i <= retries; i++) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), DEFAULT_TIMEOUT_MS);
        const res = await fetch(url, {
          method: "POST",
          headers: { ...this.headers(), "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
        clearTimeout(t);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr instanceof Error ? lastErr : this.friendlyNetworkError();
  }

  async stop() {
    return this.postJson("/api/stop", {}, 2);
  }

  async getLog(since = 0) {
    const data = await this.getJson(`/api/log?since=${since}`);
    return logSchema.parse(data);
  }
}
