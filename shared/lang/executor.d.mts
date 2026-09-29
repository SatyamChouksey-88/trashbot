// Types for executor.mjs — the Bolo executor used by the Cursor MCP agent.
import type { Lang, Step, ResultKind, ApiCall } from './trashbot-lang.mjs';

export type Mode = 'read_only' | 'dry_run' | 'full';
export declare const MODES: readonly Mode[];

export interface HttpResult {
  ok: boolean;
  /** HTTP status, or 'offline' when the robot could not be reached */
  status: number | 'offline';
  /** Parsed JSON, or raw bytes (Uint8Array / Buffer) for /api/photo */
  data: any;
}
export type Http = (method: 'GET' | 'POST' | 'DELETE', path: string, body?: Record<string, unknown>) => Promise<HttpResult>;

export interface RunResult {
  ok: boolean;
  mode: Mode;
  kind: ResultKind;
  lang: Lang;
  notes: string[];
  steps: Step[];
  suggestions: Step[][];
  /** Chat text, already in the user's language. */
  text: string;
  lines: string[];
  /** Calls made (or, in dry_run, planned with dryRun: true) */
  calls: (ApiCall & { status?: number | 'offline'; dryRun?: boolean })[];
  /** Base64 JPEGs for MCP image content */
  images: { mimeType: 'image/jpeg'; data: string }[];
  /** The robot asked a question (confirm / clarify); pass the user's next answer to run() */
  needsAnswer: boolean;
  /** Offer to remember a phrase; call addAlias(phrase) if the user says yes */
  aliasOffer: { phrase: string; command_text: string } | null;
}

export interface Executor {
  run(text: string): Promise<RunResult>;
  /** commandText empty => save the phrase from the last aliasOffer */
  addAlias(phrase: string, commandText?: string): Promise<{ ok: boolean; text: string; reason?: string; alias?: { phrase: string; steps: Step[] } }>;
  removeAlias(phrase: string): Promise<{ ok: boolean; removed?: boolean; text?: string }>;
  listAliases(): Promise<{ phrase: string; steps: Step[] }[]>;
  readonly mode: Mode;
  readonly state: unknown;
}

export declare function createExecutor(o: {
  http: Http;
  mode?: Mode;
  lang?: 'auto' | Lang;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}): Executor;
