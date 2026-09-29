import { logSchema, statusSchema } from "./contract.js";

const DEFAULT_TIMEOUT_MS = 5000;
const PHOTO_TIMEOUT_MS = 8000;
const BACKOFF_MS = [500, 1000, 2000, 5000];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

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

  robotOfflineError(): Error {
    return new Error(
      `Robot offline or not reachable at ${this.baseUrl} — is it powered on and on the same network?`,
    );
  }

  private async withBackoff<T>(fn: () => Promise<T>): Promise<T> {
    let last: unknown;
    for (let i = 0; i < BACKOFF_MS.length; i++) {
      try {
        return await fn();
      } catch (e) {
        last = e;
        if (i < BACKOFF_MS.length - 1) await sleep(BACKOFF_MS[i]);
      }
    }
    throw last instanceof Error ? last : this.robotOfflineError();
  }

  async getJson(path: string): Promise<unknown> {
    return this.withBackoff(async () => {
      const url = `${this.baseUrl}${path}`;
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), DEFAULT_TIMEOUT_MS);
      try {
        const res = await fetch(url, { headers: this.headers(), signal: ctrl.signal });
        clearTimeout(t);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      } catch {
        throw this.robotOfflineError();
      }
    });
  }

  async getStatus() {
    return statusSchema.parse(await this.getJson("/api/status"));
  }

  async getPhoto(): Promise<Buffer> {
    return this.withBackoff(async () => {
      const url = `${this.baseUrl}/api/photo`;
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), PHOTO_TIMEOUT_MS);
      try {
        const res = await fetch(url, { headers: this.headers(), signal: ctrl.signal });
        clearTimeout(t);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return Buffer.from(await res.arrayBuffer());
      } catch {
        throw this.robotOfflineError();
      }
    });
  }

  async postJson(path: string, body: unknown = {}, retries = 0): Promise<unknown> {
    let lastErr: unknown;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await this.withBackoff(async () => {
          const url = `${this.baseUrl}${path}`;
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), DEFAULT_TIMEOUT_MS);
          try {
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
          } catch {
            throw this.robotOfflineError();
          }
        });
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr instanceof Error ? lastErr : this.robotOfflineError();
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

  async move(distance_cm: number, speed = 40) {
    await this.setMode("manual");
    return this.postJson("/api/move", { distance_cm, speed });
  }

  async turn(degrees: number, speed = 40) {
    await this.setMode("manual");
    return this.postJson("/api/turn", { degrees, speed });
  }

  async scoop(action: "down" | "carry" | "tip" | "cycle") {
    await this.setMode("manual");
    return this.postJson("/api/scoop", { action });
  }
}
