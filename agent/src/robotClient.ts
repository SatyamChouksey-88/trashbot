import { logSchema, statusSchema } from "./contract.js";

const DEFAULT_TIMEOUT_MS = 5000;
const PHOTO_TIMEOUT_MS = 8000;

export class RobotClient {
  constructor(
    private baseUrl = process.env.TRASHBOT_URL ?? "http://trashbot.local",
    private token = process.env.TRASHBOT_TOKEN ?? "",
  ) {}

  private headers(json = false): HeadersInit {
    const h: Record<string, string> = {};
    if (this.token) h["X-TrashBot-Token"] = this.token;
    if (json) h["Content-Type"] = "application/json";
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
    } catch {
      if (retry) return this.getJson(path, false);
      throw this.friendlyNetworkError();
    }
  }

  async getStatus() {
    return statusSchema.parse(await this.getJson("/api/status"));
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

  async postJson(path: string, body: unknown = {}, retries = 0): Promise<unknown> {
    const url = `${this.baseUrl}${path}`;
    let lastErr: unknown;
    for (let i = 0; i <= retries; i++) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), DEFAULT_TIMEOUT_MS);
        const res = await fetch(url, {
          method: "POST",
          headers: this.headers(true),
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });
        clearTimeout(t);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        return text ? JSON.parse(text) : {};
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr instanceof Error ? lastErr : this.friendlyNetworkError();
  }

  async stop() {
    return this.postJson("/api/stop", {}, 2);
  }

  async setMode(mode: "idle" | "manual") {
    return this.postJson("/api/mode", { mode });
  }

  async drive(direction: string, speed: number, duration_ms: number) {
    await this.setMode("manual");
    const map: Record<string, [number, number]> = {
      forward: [speed, speed],
      back: [-speed, -speed],
      left: [-speed, speed],
      right: [speed, -speed],
    };
    const [left, right] = map[direction] ?? [0, 0];
    return this.postJson("/api/drive", { left, right, duration_ms });
  }

  async getLog(since = 0) {
    return logSchema.parse(await this.getJson(`/api/log?since=${since}`));
  }
}
