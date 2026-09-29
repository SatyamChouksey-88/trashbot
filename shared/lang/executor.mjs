/*
 * Bolo executor for the Cursor MCP agent (TrashBot v4).
 * Turns one Hinglish/English message into robot API calls, respecting TRASHBOT_MODE.
 * Pure logic: the caller injects `http`, so this file has no network code and is fully testable.
 *
 * Modes:
 *   read_only  info only (status, photo, battery, report, mistakes, health). Motion is refused.
 *   dry_run    info + "DRY RUN — I would …" for motion. Nothing moves. Corrections and learned phrases are saved.
 *   full       everything.
 * In EVERY mode, stop and emergency stop are really sent (stopping is never blocked).
 * Emergency-stop RESET is never done by the agent: only a human on the phone app can do it.
 */
import {
  parseCommand, toApiCalls, validateAlias, aliasKey, formatInfo, formatError, t, describeSteps,
} from './trashbot-lang.mjs';

export const MODES = Object.freeze(['read_only', 'dry_run', 'full']);
const MOTION = new Set(['CLEAN', 'MOVE', 'TURN', 'SCOOP']);
const REPEATABLE = new Set(['CLEAN', 'MOVE', 'TURN', 'SCOOP', 'PHOTO', 'STATUS', 'HEALTH', 'BATTERY', 'REPORT', 'MISTAKES']);
const ALIAS_TTL_MS = 30000;

function toBase64(data) {
  if (!data) return '';
  if (typeof data === 'string') return data;
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

/**
 * @param {object} o
 * @param {(method: string, path: string, body?: object) => Promise<{ok: boolean, status: number|'offline', data: any}>} o.http
 * @param {'read_only'|'dry_run'|'full'} [o.mode]
 * @param {'auto'|'en'|'hi'} [o.lang]
 * @param {() => number} [o.now]
 * @param {(ms: number) => Promise<void>} [o.sleep]
 */
export function createExecutor(o) {
  if (!o || typeof o.http !== 'function') throw new Error('createExecutor needs { http }');
  const mode = MODES.includes(o.mode) ? o.mode : 'dry_run';
  const now = o.now || (() => Date.now());
  const sleep = o.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  const state = {
    lang: o.lang === 'en' || o.lang === 'hi' ? o.lang : 'auto',
    lastLang: 'hi',
    pending: null,
    origin: null, // { text, offer } for the pending question
    lastSteps: null,
    aliases: null,
    aliasesAt: 0,
    aliasesSupported: true,
    turnLeftSign: 0,
    lastOffer: null,
  };

  async function call(method, path, body, retries = 0) {
    for (let i = 0; ; i++) {
      let r;
      try { r = await o.http(method, path, body); } catch { r = { ok: false, status: 'offline', data: null }; }
      if (!r || typeof r !== 'object') r = { ok: false, status: 'offline', data: null };
      if (r.ok || r.status !== 'offline' || i >= retries) return r;
    }
  }

  async function loadAliases(force = false) {
    if (!force && state.aliases && now() - state.aliasesAt < ALIAS_TTL_MS) return state.aliases;
    const r = await call('GET', '/api/aliases');
    if (r.status === 404) state.aliasesSupported = false;
    state.aliases = r.ok && r.data && Array.isArray(r.data.aliases) ? r.data.aliases : [];
    state.aliasesAt = now();
    return state.aliases;
  }

  async function turnLeftSign() {
    if (state.turnLeftSign) return state.turnLeftSign;
    const r = await call('GET', '/api/status');
    state.turnLeftSign = r.ok && r.data && r.data.turn_left_sign === -1 ? -1 : 1;
    return state.turnLeftSign;
  }

  async function info(step, L, out) {
    switch (step.intent) {
      case 'STATUS':
      case 'BATTERY':
      case 'HEALTH':
      case 'MISTAKES': {
        const path = { STATUS: '/api/status', BATTERY: '/api/status', HEALTH: '/api/health', MISTAKES: '/api/mistakes' }[step.intent];
        const r = await call('GET', path);
        if (!r.ok) return fail(r, L, out);
        out.lines.push(formatInfo(step.intent, r.data, L));
        return true;
      }
      case 'REPORT': {
        const a = await call('GET', '/api/mission/current');
        const b = await call('GET', '/api/mission/history');
        if (!a.ok && !b.ok) return fail(a, L, out);
        const history = Array.isArray(b.data) ? b.data : (b.data && (b.data.missions || b.data.history)) || [];
        out.lines.push(formatInfo('REPORT', { current: a.ok ? a.data : null, history }, L));
        return true;
      }
      case 'PHOTO': {
        const img = await call('GET', '/api/photo');
        if (!img.ok) return fail(img, L, out);
        out.images.push({ mimeType: 'image/jpeg', data: toBase64(img.data) });
        const st = await call('GET', '/api/status');
        out.lines.push(formatInfo('PHOTO', st.ok ? st.data : {}, L));
        return true;
      }
      default:
        return true;
    }
  }

  function fail(r, L, out) {
    out.ok = false;
    out.lines.push(formatError(r.status, L, r.data));
    return false;
  }

  async function runSteps(steps, L, out, stopAlreadySent) {
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      const last = i === steps.length - 1;
      if (s.intent === 'STOP' || s.intent === 'ESTOP') {
        if (i === 0 && stopAlreadySent) continue;
        const r = await call('POST', s.intent === 'ESTOP' ? '/api/estop' : '/api/stop', undefined, 2);
        out.calls.push({ method: 'POST', path: s.intent === 'ESTOP' ? '/api/estop' : '/api/stop', status: r.status });
        if (!r.ok) return fail(r, L, out);
        continue;
      }
      if (s.intent === 'ESTOP_RESET') { out.lines.push(t('estop_reset_phone_only', {}, L)); out.ok = false; return false; }
      if (s.intent === 'HELP') { out.lines.push(t('help', {}, L)); continue; }
      if (s.intent === 'LANG') { state.lang = s.params.lang; state.lastLang = s.params.lang; continue; }
      if (['STATUS', 'BATTERY', 'HEALTH', 'MISTAKES', 'REPORT', 'PHOTO'].includes(s.intent)) {
        if (!(await info(s, L, out))) return false;
        continue;
      }
      // Writes: motion + corrections
      if (mode === 'read_only') { out.lines.push(t('err_readonly', {}, L)); out.ok = false; return false; }
      const calls = toApiCalls(s, { turnLeftSign: await turnLeftSign() });
      if (MOTION.has(s.intent) && mode === 'dry_run') {
        out.lines.push(t('dry_run', { what: describeSteps([s], L) }, L));
        for (const c of calls) out.calls.push({ ...c, dryRun: true });
        continue;
      }
      for (const c of calls) {
        const r = await call(c.method, c.path, c.body);
        out.calls.push({ ...c, status: r.status });
        if (!r.ok) return fail(r, L, out);
        const wait = r.data && Number.isFinite(r.data.duration_ms) ? r.data.duration_ms : 0;
        if (!last && wait > 0) await sleep(Math.min(wait, 10000) + 300);
      }
    }
    return true;
  }

  /** Run one user message. Returns text for the chat plus structured details. */
  async function run(text) {
    const res = parseCommand(text, {
      lang: state.lang, lastLang: state.lastLang, aliases: await loadAliases(), pending: state.pending, now: now(), lastSteps: state.lastSteps,
    });
    if (state.lang === 'auto') state.lastLang = res.lang;
    const L = res.lang;
    const out = {
      ok: true, mode, kind: res.kind, lang: L, notes: res.notes, steps: res.steps, suggestions: res.suggestions,
      lines: [], calls: [], images: [], aliasOffer: null, needsAnswer: false,
    };

    // Safety first: stop words are sent before anything else, in every mode.
    let stopSent = false;
    if (res.stopFirst) {
      const path = res.steps[0].intent === 'ESTOP' ? '/api/estop' : '/api/stop';
      const r = await call('POST', path, undefined, 2);
      out.calls.push({ method: 'POST', path, status: r.status });
      if (!r.ok) { fail(r, L, out); return finish(out); }
      stopSent = true;
    }

    if (res.kind === 'confirm' || res.kind === 'clarify') {
      state.pending = { suggestions: res.suggestions, at: now() };
      state.origin = { text, offer: res.unknownWords.length > 0 || res.notes.includes('did_you_mean') };
      out.lines.push(res.replyText);
      out.needsAnswer = true;
      return finish(out);
    }
    const origin = state.origin;
    if (res.kind !== 'command') {
      if (res.kind === 'cancelled') { state.pending = null; state.origin = null; }
      out.lines.push(res.replyText);
      return finish(out);
    }
    state.pending = null;
    state.origin = null;
    // In read_only / dry_run a motion is not really done, so don't say "Theek hai: …" for it.
    const blocked = mode !== 'full' && res.steps.some((s) => MOTION.has(s.intent));
    if (!blocked) out.lines.push(res.replyText);
    const ok = await runSteps(res.steps, L, out, stopSent);
    if (ok && res.steps.every((s) => REPEATABLE.has(s.intent))) state.lastSteps = res.steps;
    if (ok && res.notes.includes('confirmed') && origin && origin.offer && state.aliasesSupported && mode !== 'read_only') {
      const v = validateAlias({ phrase: origin.text, steps: res.steps }, { existing: state.aliases || [] });
      if (v.ok) {
        out.aliasOffer = { phrase: v.alias.phrase, command_text: describeSteps(v.alias.steps, 'hi') };
        state.lastOffer = { phrase: v.alias.phrase, steps: v.alias.steps };
        out.lines.push(t('alias_offer', { phrase: v.alias.phrase }, L));
      }
    }
    return finish(out);
  }

  function finish(out) {
    if (out.mode === 'dry_run' && out.calls.some((c) => c.dryRun)) out.lines.unshift('[DRY RUN]');
    out.text = out.lines.join('\n');
    return out;
  }

  /**
   * Save a learned phrase. `commandText` is a command the parser already understands ("10 cm aage").
   * Leave it empty to save the phrase that run() just offered (aliasOffer).
   */
  async function addAlias(phrase, commandText) {
    const L = state.lang === 'auto' ? state.lastLang : state.lang;
    const no = (why) => ({ ok: false, text: t('alias_rejected', { why: t(`alias_why_${why}`, {}, L) }, L), reason: why });
    if (mode === 'read_only') return { ok: false, text: t('err_readonly', {}, L), reason: 'read_only' };
    let steps = null;
    if (!commandText && state.lastOffer && aliasKey(state.lastOffer.phrase) === aliasKey(String(phrase || ''))) {
      steps = state.lastOffer.steps;
    } else {
      const parsed = parseCommand(String(commandText || ''), { lang: L, now: now() });
      if (parsed.kind !== 'command' || !parsed.steps.length) return no('bad_steps');
      steps = parsed.steps;
    }
    const list = await loadAliases(true);
    if (!state.aliasesSupported) return { ok: false, text: t('alias_unsupported', {}, L), reason: 'unsupported' };
    const v = validateAlias({ phrase, steps }, { existing: list });
    if (!v.ok) return no(v.reason);
    for (const a of list) {
      if (aliasKey(a.phrase) === aliasKey(v.alias.phrase)) await call('DELETE', `/api/aliases?phrase=${encodeURIComponent(a.phrase)}`);
    }
    const r = await call('POST', '/api/aliases', v.alias);
    state.aliases = null;
    if (!r.ok) return { ok: false, text: formatError(r.status, L, r.data), reason: 'robot' };
    return { ok: true, text: t('alias_saved', { phrase: v.alias.phrase, what: describeSteps(v.alias.steps, L) }, L), alias: v.alias };
  }

  async function removeAlias(phrase) {
    if (mode === 'read_only') return { ok: false, text: t('err_readonly', {}, 'en') };
    const r = await call('DELETE', `/api/aliases?phrase=${encodeURIComponent(String(phrase || ''))}`);
    state.aliases = null;
    return { ok: r.ok, removed: !!(r.data && r.data.removed) };
  }

  async function listAliases() {
    return loadAliases(true);
  }

  return { run, addAlias, removeAlias, listAliases, state, mode };
}
