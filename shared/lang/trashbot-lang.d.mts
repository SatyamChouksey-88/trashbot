// Types for trashbot-lang.mjs (TrashBot "Bolo" bilingual command parser).
// The agent (TypeScript, NodeNext) imports "../../shared/lang/trashbot-lang.mjs" and TypeScript picks up this file.

export type Lang = 'en' | 'hi';
export type Intent =
  | 'STOP' | 'ESTOP' | 'ESTOP_RESET' | 'CLEAN' | 'MOVE' | 'TURN' | 'SCOOP' | 'PHOTO' | 'STATUS' | 'HEALTH'
  | 'BATTERY' | 'REPORT' | 'MISTAKES' | 'MARK_KEEP' | 'MARK_TRASH' | 'HELP' | 'LANG' | 'REPEAT';

export interface StepParams {
  direction?: 'forward' | 'back' | 'left' | 'right';
  distance_cm?: number;
  degrees?: number;
  speed?: number;
  action?: 'down' | 'carry' | 'tip' | 'cycle';
  max_items?: number;
  max_time_s?: number;
  lang?: Lang;
}

export interface Step {
  intent: Intent;
  params: StepParams;
}

export type ResultKind = 'command' | 'confirm' | 'clarify' | 'unknown' | 'empty' | 'cancelled' | 'info';

export interface ParseResult {
  /** command = run `steps` now · confirm = ask yes/no for suggestions[0] · clarify = let the user pick one of `suggestions` */
  kind: ResultKind;
  steps: Step[];
  suggestions: Step[][];
  lang: Lang;
  reply: { key: string; vars: Record<string, unknown> };
  /** Ready-to-show reply in `lang`. */
  replyText: string;
  notes: string[];
  unknownWords: string[];
  /** true when steps[0] is STOP or ESTOP — send it before anything else. */
  stopFirst: boolean;
  tokens: string[];
}

export interface Alias {
  phrase: string;
  steps: Step[];
}

export interface Pending {
  suggestions: Step[][];
  /** ms timestamp when the question was asked */
  at: number;
}

export interface ParseOptions {
  lang?: 'auto' | Lang;
  lastLang?: Lang;
  aliases?: Alias[];
  pending?: Pending | null;
  now?: number;
  lastSteps?: Step[] | null;
}

export interface ApiCall {
  method: 'GET' | 'POST';
  path: string;
  body?: Record<string, unknown>;
}

export declare const LANG_VERSION: string;
export declare const INTENTS: readonly Intent[];
export declare const MOTION_INTENTS: readonly Intent[];
export declare const INFO_INTENTS: readonly Intent[];
export declare const LIMITS: {
  readonly move: { readonly defaultCm: number; readonly smallCm: number; readonly largeCm: number; readonly maxForwardCm: number; readonly maxBackCm: number };
  readonly turn: { readonly defaultDeg: number; readonly smallDeg: number; readonly largeDeg: number; readonly uturnDeg: number; readonly maxDeg: number };
  readonly speed: { readonly normal: number; readonly slow: number; readonly fast: number; readonly min: number; readonly max: number };
  readonly clean: { readonly defaultItems: number; readonly maxItems: number; readonly defaultTimeS: number; readonly minTimeS: number; readonly maxTimeS: number };
  readonly sequenceMaxSteps: number;
  readonly pendingTtlMs: number;
  readonly alias: { readonly maxCount: number; readonly maxPhraseChars: number; readonly maxTokens: number; readonly maxSteps: number };
  readonly maxInputChars: number;
};
export declare const LEXICON: Readonly<Record<string, { en: string[]; hi: string[] }>>;
export declare const LEXICON_ERRORS: readonly string[];
export declare const I18N: Readonly<Record<string, { en: string; hi: string }>>;
export declare const I18N_KEYS: readonly string[];
export declare const EXAMPLES: readonly { intent: Intent; hi: string[]; en: string[] }[];

/** Never throws. */
export declare function parseCommand(text: string, opts?: ParseOptions): ParseResult;
/** Same as parseCommand but throws on internal errors (tests only). */
export declare function parseCommandStrict(text: string, opts?: ParseOptions): ParseResult;
export declare function normalize(text: string): string;
export declare function tokenize(text: string): string[];
/** Validate + clamp one step; null if invalid. */
export declare function sanitizeStep(step: unknown, allowed?: ReadonlySet<Intent>): Step | null;
/** The exact robot HTTP calls for one step. turnLeftSign = sign of `degrees` that turns LEFT in the firmware. */
export declare function toApiCalls(step: Step, opts?: { turnLeftSign?: 1 | -1; label?: string }): ApiCall[];
/** Matching key of a learned phrase (fillers ignored). */
export declare function aliasKey(phrase: string): string;
export declare function validateAlias(
  alias: { phrase: string; steps: Step[] },
  opts?: { existing?: Alias[] },
): { ok: true; alias: Alias; replaced: boolean } | { ok: false; reason: string };
export declare function t(key: string, vars?: Record<string, unknown>, lang?: Lang): string;
export declare function describeStep(step: Step, lang?: Lang): string;
export declare function describeSteps(steps: Step[], lang?: Lang): string;
/** One-line answer from robot JSON for STATUS / BATTERY / HEALTH / REPORT / MISTAKES / PHOTO. */
export declare function formatInfo(intent: Intent, data: unknown, lang?: Lang): string;
/** Friendly message for an HTTP status (or 'offline'). */
export declare function formatError(status: number | 'offline', lang?: Lang, body?: { error?: string } | null): string;
