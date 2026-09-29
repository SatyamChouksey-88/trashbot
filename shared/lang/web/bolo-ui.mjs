/*
 * "Bolo" — the Hinglish/English command box for the TrashBot phone page.
 * Vanilla JS, no dependencies, no CDN. The robot serves this file as /bolo-ui.mjs.
 *
 * Usage on the robot page (web_index.h):
 *   <div id="bolo"></div>
 *   <script type="module">
 *     import * as L from '/lang.mjs';
 *     import { mountBolo } from '/bolo-ui.mjs';
 *     mountBolo(document.getElementById('bolo'), { L });
 *   </script>
 *
 * Safety: a stop word is sent to /api/stop BEFORE anything else and cancels any running
 * sequence. Every motion goes through the normal robot API, so firmware safety still applies.
 */

const CSS = `
.tb-bolo{--b-bg:#fff;--b-fg:#111;--b-mut:#666;--b-line:#ddd;--b-acc:#0a7d55;--b-stop:#c62828;--b-chip:#eef6f2;
  font:16px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--b-fg);background:var(--b-bg);
  border:1px solid var(--b-line);border-radius:14px;padding:12px;max-width:560px;margin:8px auto}
@media (prefers-color-scheme:dark){.tb-bolo{--b-bg:#15181a;--b-fg:#eee;--b-mut:#9aa;--b-line:#333;--b-acc:#39c38e;--b-chip:#1f2a26}}
.tb-bolo h2{font-size:18px;margin:0 0 8px}
.tb-bolo .row{display:flex;gap:8px;align-items:center}
.tb-bolo input[type=text]{flex:1;min-width:0;font-size:17px;padding:12px;border:1px solid var(--b-line);border-radius:10px;
  background:transparent;color:inherit}
.tb-bolo button{font:inherit;min-height:44px;padding:8px 14px;border-radius:10px;border:1px solid var(--b-line);
  background:transparent;color:inherit;cursor:pointer}
.tb-bolo .send{background:var(--b-acc);color:#fff;border:0}
.tb-bolo .stop{width:100%;margin-top:10px;background:var(--b-stop);color:#fff;border:0;font-weight:700;font-size:20px;min-height:56px}
.tb-bolo .hint{color:var(--b-mut);font-size:13px;margin:6px 2px}
.tb-bolo .reply{margin-top:8px;padding:10px;border-radius:10px;background:var(--b-chip);min-height:22px;white-space:pre-wrap}
.tb-bolo .reply.err{outline:2px solid var(--b-stop)}
.tb-bolo .chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
.tb-bolo .chips button{background:var(--b-chip)}
.tb-bolo img.photo{max-width:100%;border-radius:10px;margin-top:8px;display:none}
.tb-bolo details{margin-top:10px}
.tb-bolo summary{cursor:pointer;color:var(--b-mut)}
.tb-bolo,.tb-bolo *{box-sizing:border-box}
.tb-bolo .seg{display:flex;flex-wrap:wrap;gap:6px;align-items:center}
.tb-bolo .reply,.tb-bolo li{overflow-wrap:anywhere}
.tb-bolo .seg button[aria-pressed=true]{background:var(--b-acc);color:#fff;border-color:var(--b-acc)}
.tb-bolo ul{padding-left:18px;margin:6px 0}
.tb-bolo li{margin:2px 0}
.tb-bolo .hist{color:var(--b-mut);font-size:13px}
`;

const HTML = `
<h2>🗣️ Bolo — Hinglish / English</h2>
<form class="row" data-r="form" autocomplete="off">
  <input type="text" data-r="input" enterkeyhint="send" aria-label="Command"
         placeholder="jaise: kachra saaf karo · 20 cm aage · ruko">
  <button class="send" type="submit" aria-label="Send">➤</button>
</form>
<div class="hint">🎤 Bolna hai? Phone keyboard ka mic dabao (Hinglish, English ya हिंदी — sab chalega).</div>
<div class="reply" data-r="reply" role="status" aria-live="polite"></div>
<div class="chips" data-r="chips"></div>
<img class="photo" data-r="photo" alt="Robot camera photo">
<button class="stop" type="button" data-r="stop">■ RUKO · STOP</button>
<details>
  <summary>Settings · Learned phrases · History</summary>
  <p class="seg" data-r="langs">Language:
    <button type="button" data-lang="auto">Auto</button>
    <button type="button" data-lang="hi">Hinglish</button>
    <button type="button" data-lang="en">English</button>
  </p>
  <p><label><input type="checkbox" data-r="speak"> Phone jawab bol ke sunaye (speak replies)</label></p>
  <div><b>Learned phrases</b> <button type="button" data-r="reset">Sab bhool jao</button><ul data-r="aliases"></ul></div>
  <div class="hist"><b>History</b><ul data-r="history"></ul></div>
</details>
`;

function safeStorage() {
  const mem = new Map();
  return {
    get(k) { try { return window.localStorage.getItem(k); } catch { return mem.get(k) ?? null; } },
    set(k, v) { try { window.localStorage.setItem(k, v); } catch { mem.set(k, v); } },
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const REPEATABLE = new Set(['CLEAN', 'MOVE', 'TURN', 'SCOOP', 'PHOTO', 'STATUS', 'HEALTH', 'BATTERY', 'REPORT', 'MISTAKES']);

/**
 * @param {HTMLElement} root
 * @param {{ L: object, apiBase?: string, fetchImpl?: Function }} opts  L = the module from /lang.mjs
 */
export function mountBolo(root, opts) {
  const L = opts && opts.L;
  if (!root || !L || typeof L.parseCommand !== 'function') throw new Error('mountBolo needs a root element and { L }');
  const base = (opts.apiBase || '').replace(/\/$/, '');
  const fetchImpl = opts.fetchImpl || ((...a) => fetch(...a));
  const store = safeStorage();

  if (!document.getElementById('tb-bolo-css')) {
    const st = document.createElement('style');
    st.id = 'tb-bolo-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  root.classList.add('tb-bolo');
  root.innerHTML = HTML;
  const $ = (r) => root.querySelector(`[data-r="${r}"]`);

  const state = {
    mode: ['auto', 'en', 'hi'].includes(store.get('tb_bolo_lang')) ? store.get('tb_bolo_lang') : 'auto',
    speak: store.get('tb_bolo_speak') === '1',
    lastLang: store.get('tb_bolo_last_lang') === 'en' ? 'en' : 'hi',
    pending: null, // { suggestions, at, originText, offerAlias }
    lastSteps: null,
    aliases: [],
    aliasesSupported: true,
    turnLeftSign: 1,
    run: 0,
    history: [],
  };
  const lang = () => (state.mode === 'auto' ? state.lastLang : state.mode);

  // ---------------- robot API ----------------
  async function api(method, path, body, { timeoutMs = 5000, retries = 0 } = {}) {
    for (let attempt = 0; ; attempt++) {
      const ctl = new AbortController();
      const timer = setTimeout(() => ctl.abort(), timeoutMs);
      try {
        const headers = {};
        if (body !== undefined) headers['Content-Type'] = 'application/json';
        const tok = store.get('tb_token');
        if (tok) headers['X-TrashBot-Token'] = tok;
        const res = await fetchImpl(base + path, {
          method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: ctl.signal, cache: 'no-store',
        });
        const ct = res.headers.get('content-type') || '';
        const data = ct.includes('json') ? await res.json().catch(() => null) : ct.startsWith('image/') ? await res.blob() : null;
        return { ok: res.ok, status: res.status, data };
      } catch {
        if (attempt >= retries) return { ok: false, status: 'offline', data: null };
      } finally {
        clearTimeout(timer);
      }
    }
  }
  const sendStop = (intent = 'STOP') =>
    api('POST', intent === 'ESTOP' ? '/api/estop' : '/api/stop', undefined, { retries: 2, timeoutMs: 2000 });

  // ---------------- output ----------------
  function say(text, { err = false, lng = lang() } = {}) {
    const el = $('reply');
    el.textContent = text;
    el.classList.toggle('err', !!err);
    if (state.speak && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = 'en-IN'; // replies are romanised, an Indian-English voice reads Hinglish well
        u.rate = 1;
        window.speechSynthesis.speak(u);
      } catch { /* speech is optional */ }
    }
    void lng;
  }
  function setChips(list) {
    const box = $('chips');
    box.replaceChildren();
    for (const c of list) {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = c.label;
      b.addEventListener('click', c.onClick);
      box.appendChild(b);
    }
  }
  function addHistory(text, reply) {
    state.history.unshift({ text, reply });
    state.history = state.history.slice(0, 5);
    const ul = $('history');
    ul.replaceChildren(...state.history.map((h) => {
      const li = document.createElement('li');
      li.textContent = `"${h.text}" → ${h.reply}`;
      return li;
    }));
  }
  function renderLangButtons() {
    for (const b of root.querySelectorAll('[data-lang]')) b.setAttribute('aria-pressed', String(b.dataset.lang === state.mode));
  }
  function renderAliases() {
    const ul = $('aliases');
    if (!state.aliasesSupported) { ul.innerHTML = '<li>(robot firmware does not support learned phrases yet)</li>'; return; }
    if (!state.aliases.length) { ul.innerHTML = '<li>—</li>'; return; }
    ul.replaceChildren(...state.aliases.map((a) => {
      const li = document.createElement('li');
      li.textContent = `"${a.phrase}" → ${L.describeSteps(a.steps, lang())} `;
      const del = document.createElement('button');
      del.type = 'button';
      del.textContent = '✕';
      del.setAttribute('aria-label', `Forget ${a.phrase}`);
      del.addEventListener('click', async () => {
        await api('DELETE', `/api/aliases?phrase=${encodeURIComponent(a.phrase)}`);
        await loadAliases();
      });
      li.appendChild(del);
      return li;
    }));
  }
  async function loadAliases() {
    const r = await api('GET', '/api/aliases');
    if (r.status === 404) state.aliasesSupported = false;
    state.aliases = r.ok && r.data && Array.isArray(r.data.aliases) ? r.data.aliases : [];
    renderAliases();
  }
  async function loadRobotInfo() {
    const r = await api('GET', '/api/status');
    if (r.ok && r.data && (r.data.turn_left_sign === 1 || r.data.turn_left_sign === -1)) state.turnLeftSign = r.data.turn_left_sign;
  }

  // ---------------- execution ----------------
  function fail(r, lng) {
    const msg = L.formatError(r.status, lng, r.data);
    say(msg, { err: true, lng });
    return false;
  }

  async function runSteps(steps, lng, { alreadyStopped = false } = {}) {
    const my = ++state.run;
    let sentStop = alreadyStopped;
    for (let i = 0; i < steps.length; i++) {
      if (my !== state.run) return false; // a newer command (e.g. STOP) took over
      const s = steps[i];
      const last = i === steps.length - 1;
      switch (s.intent) {
        case 'STOP':
        case 'ESTOP':
          if (!sentStop) { const r = await sendStop(s.intent); if (!r.ok) return fail(r, lng); sentStop = true; }
          break;
        case 'HELP':
          say(L.t('help', {}, lng), { lng });
          break;
        case 'LANG':
          state.mode = s.params.lang;
          store.set('tb_bolo_lang', state.mode);
          renderLangButtons();
          say(L.t('lang_set', {}, s.params.lang), { lng: s.params.lang });
          break;
        case 'STATUS':
        case 'BATTERY': {
          const r = await api('GET', '/api/status');
          if (!r.ok) return fail(r, lng);
          say(L.formatInfo(s.intent, r.data, lng), { lng });
          break;
        }
        case 'HEALTH': {
          const r = await api('GET', '/api/health');
          if (!r.ok) return fail(r, lng);
          say(L.formatInfo('HEALTH', r.data, lng), { lng });
          break;
        }
        case 'REPORT': {
          const [a, b] = await Promise.all([api('GET', '/api/mission/current'), api('GET', '/api/mission/history')]);
          if (!a.ok && !b.ok) return fail(a, lng);
          const history = Array.isArray(b.data) ? b.data : (b.data && (b.data.missions || b.data.history)) || [];
          say(L.formatInfo('REPORT', { current: a.ok ? a.data : null, history }, lng), { lng });
          break;
        }
        case 'MISTAKES': {
          const r = await api('GET', '/api/mistakes');
          if (!r.ok) return fail(r, lng);
          say(L.formatInfo('MISTAKES', r.data, lng), { lng });
          break;
        }
        case 'PHOTO': {
          const [img, st] = await Promise.all([api('GET', '/api/photo', undefined, { timeoutMs: 8000 }), api('GET', '/api/status')]);
          if (!img.ok) return fail(img, lng);
          const el = $('photo');
          if (img.data instanceof Blob) {
            if (el.dataset.url) URL.revokeObjectURL(el.dataset.url);
            el.dataset.url = URL.createObjectURL(img.data);
            el.src = el.dataset.url;
            el.style.display = 'block';
          }
          say(L.formatInfo('PHOTO', st.ok ? st.data : {}, lng), { lng });
          break;
        }
        default: {
          // CLEAN, MOVE, TURN, SCOOP, MARK_KEEP, MARK_TRASH, ESTOP_RESET → plain robot API calls
          for (const c of L.toApiCalls(s, { turnLeftSign: state.turnLeftSign })) {
            if (my !== state.run) return false;
            const r = await api(c.method, c.path, c.body);
            if (!r.ok) return fail(r, lng);
            const wait = r.data && Number.isFinite(r.data.duration_ms) ? r.data.duration_ms : 0;
            if (!last && wait > 0) await sleep(Math.min(wait, 10000) + 300); // let a timed move finish before the next step
          }
        }
      }
    }
    if (steps.every((x) => REPEATABLE.has(x.intent))) state.lastSteps = steps;
    return true;
  }

  function offerAlias(originText, steps, lng) {
    if (!state.aliasesSupported || !originText) return;
    const v = L.validateAlias({ phrase: originText, steps }, { existing: state.aliases });
    if (!v.ok) return;
    const phrase = v.alias.phrase;
    setChips([
      {
        label: lng === 'en' ? `✓ Remember "${phrase}"` : `✓ "${phrase}" yaad rakho`,
        onClick: async () => {
          for (const a of state.aliases) {
            if (L.aliasKey(a.phrase) === L.aliasKey(phrase)) await api('DELETE', `/api/aliases?phrase=${encodeURIComponent(a.phrase)}`);
          }
          const r = await api('POST', '/api/aliases', v.alias);
          setChips([]);
          if (!r.ok) return fail(r, lng);
          await loadAliases();
          say(L.t('alias_saved', { phrase, what: L.describeSteps(v.alias.steps, lng) }, lng), { lng });
        },
      },
      { label: lng === 'en' ? '✗ No' : '✗ Nahi', onClick: () => setChips([]) },
    ]);
    say(`${$('reply').textContent} ${L.t('alias_offer', { phrase }, lng)}`.trim(), { lng });
  }

  async function executeChosen(steps, lng, origin) {
    setChips([]);
    state.pending = null;
    say(L.t('doing', { what: L.describeSteps(steps, lng) }, lng), { lng });
    const ok = await runSteps(steps, lng);
    if (ok && origin && origin.offerAlias) offerAlias(origin.originText, steps, lng);
  }

  async function submit(text) {
    const res = L.parseCommand(text, {
      lang: state.mode, lastLang: state.lastLang, aliases: state.aliases, pending: state.pending, now: Date.now(), lastSteps: state.lastSteps,
    });
    if (state.mode === 'auto') { state.lastLang = res.lang; store.set('tb_bolo_last_lang', res.lang); }
    const lng = res.lang;

    // Safety first: stop words go out before anything else and cancel running sequences.
    let stopped = false;
    if (res.stopFirst) {
      state.run++;
      const r = await sendStop(res.steps[0].intent);
      if (!r.ok) { fail(r, lng); addHistory(text, L.formatError(r.status, lng)); return; }
      stopped = true;
    }

    say(res.replyText, { lng });
    addHistory(text, res.replyText);
    $('photo').style.display = 'none';

    if (res.kind === 'command') {
      setChips([]);
      state.pending = null;
      const ok = await runSteps(res.steps, lng, { alreadyStopped: stopped });
      if (ok && res.notes.includes('confirmed') && pendingOrigin && pendingOrigin.offerAlias) {
        offerAlias(pendingOrigin.originText, res.steps, lng);
      }
      pendingOrigin = null;
      return;
    }
    if (res.kind === 'confirm' || res.kind === 'clarify') {
      const origin = { originText: text, offerAlias: res.unknownWords.length > 0 || res.notes.includes('did_you_mean') };
      state.pending = { suggestions: res.suggestions, at: Date.now() };
      pendingOrigin = origin;
      const chips = res.suggestions.map((steps) => ({
        label: res.kind === 'confirm' ? (lng === 'en' ? '✓ Yes' : '✓ Haan') : L.describeSteps(steps, lng),
        onClick: () => executeChosen(steps, lng, origin),
      }));
      chips.push({ label: lng === 'en' ? '✗ Cancel' : '✗ Rehne do', onClick: () => { setChips([]); state.pending = null; say(L.t('cancelled', {}, lng), { lng }); } });
      setChips(chips);
      return;
    }
    // cancelled / info / unknown / empty
    setChips([]);
    if (res.kind === 'cancelled') { state.pending = null; pendingOrigin = null; }
  }
  let pendingOrigin = null;

  // ---------------- wiring ----------------
  $('form').addEventListener('submit', (e) => {
    e.preventDefault();
    const text = $('input').value.trim();
    if (!text) return;
    $('input').value = '';
    submit(text);
  });
  $('stop').addEventListener('click', async () => {
    state.run++;
    state.pending = null;
    setChips([]);
    const r = await sendStop('STOP');
    if (!r.ok) fail(r, lang()); else say(L.t('stop', {}, lang()));
  });
  for (const b of root.querySelectorAll('[data-lang]')) {
    b.addEventListener('click', () => {
      state.mode = b.dataset.lang;
      store.set('tb_bolo_lang', state.mode);
      renderLangButtons();
      renderAliases();
    });
  }
  $('speak').checked = state.speak;
  $('speak').addEventListener('change', () => { state.speak = $('speak').checked; store.set('tb_bolo_speak', state.speak ? '1' : '0'); });
  $('reset').addEventListener('click', async () => {
    const r = await api('POST', '/api/aliases/reset', {});
    if (!r.ok) return fail(r, lang());
    await loadAliases();
  });

  renderLangButtons();
  say(L.t('empty', {}, lang()));
  loadAliases();
  loadRobotInfo();

  return { submit, state, api };
}
