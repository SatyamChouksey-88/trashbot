// Single import point for the shared Bolo code (paths live here only).
export * from "../../shared/lang/trashbot-lang.mjs";
export { createExecutor, MODES } from "../../shared/lang/executor.mjs";
export type { Executor, Http, HttpResult, Mode, RunResult } from "../../shared/lang/executor.mjs";
