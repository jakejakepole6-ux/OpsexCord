// @name OpsexCord
// @author @geofeed on discord

(() => {
  if (window.BdApi && window.BdApi.__nitro) return;

  let cachedReq = null;
  const getReq = () => {
    if (cachedReq && cachedReq.c) return cachedReq;
    const chunk = window.webpackChunkdiscord_app;
    if (!chunk) return null;
    const all = [];
    chunk.push([[Symbol("nitro")], {}, (r) => { all.push(r); }]);
    chunk.pop();
    let best = null, bestCount = 0;
    for (const r of all) {
      if (!r || !r.c) continue;
      const n = Object.keys(r.c).length;
      if (n > bestCount) { best = r; bestCount = n; }
    }
    if (bestCount < 1000) return null;
    cachedReq = best;
    return cachedReq;
  };

  const isObj = (v) => v && (typeof v === "object" || typeof v === "function");

  const members = (e) => {
    const out = [e];
    try {
      for (const k of Object.keys(e)) {
        const v = e[k];
        if (isObj(v)) out.push(v);
      }
    } catch {}
    return out;
  };

  function* allMembers() {
    const req = getReq();
    if (!req || !req.c) return;
    for (const id in req.c) {
      let e;
      try { e = req.c[id]?.exports; } catch { continue; }
      if (!isObj(e) || e === window) continue;
      yield* members(e);
    }
  }

  const cache = new Map();
  const find = (cacheKey, test) => {
    if (cache.has(cacheKey)) return cache.get(cacheKey);
    const { warn, error, log } = console;
    console.warn = console.error = console.log = () => {};
    try {
      for (const m of allMembers()) {
        try {
          if (test(m)) { cache.set(cacheKey, m); return m; }
        } catch {}
      }
    } finally {
      console.warn = warn; console.error = error; console.log = log;
    }
    return undefined;
  };

  let storeIndex = null, indexedCount = 0;
  const buildStoreIndex = () => {
    const req = getReq();
    if (!req) return null;
    const count = Object.keys(req.c).length;
    const idx = new Map();
    const { warn, error, log } = console;
    console.warn = console.error = console.log = () => {};
    try {
      for (const m of allMembers()) {
        try {
          if (typeof m.getName === "function") {
            const n = m.getName();
            if (typeof n === "string" && !idx.has(n)) idx.set(n, m);
          }
        } catch {}
      }
    } finally {
      console.warn = warn; console.error = error; console.log = log;
    }
    storeIndex = idx; indexedCount = count;
    return idx;
  };
  const getStore = (name) => {
    const key = `store:${name}`;
    if (cache.has(key)) return cache.get(key);
    const req = getReq();
    if (!req) return undefined;
    const count = Object.keys(req.c).length;
    if (!storeIndex || (!storeIndex.has(name) && count !== indexedCount)) buildStoreIndex();
    const hit = storeIndex && storeIndex.get(name);
    if (hit) cache.set(key, hit);
    return hit;
  };

  const Webpack = {
    getStore: (name) => getStore(name),
    getByKeys: (...keys) => find(`keys:${keys.join(",")}`, (m) => keys.every((k) => k in m)),
    getModule: (filter) => find(`fn:${filter}`, filter)
  };

  const patches = new Map();

  const addPatch = (caller, obj, method, mode, fn) => {
    const original = obj?.[method];
    if (typeof original !== "function") {
      console.warn("[NitroAPI] can't patch", method);
      return () => {};
    }

    const wrapped = function (...args) {
      if (mode === "instead") return fn(this, args, original);
      if (mode === "before") { fn(this, args); return original.apply(this, args); }
      const ret = original.apply(this, args);
      const out = fn(this, args, ret);
      return out === undefined ? ret : out;
    };

    obj[method] = wrapped;
    const list = patches.get(caller) || [];
    list.push({ obj, method, original, wrapped });
    patches.set(caller, list);

    return () => { if (obj[method] === wrapped) obj[method] = original; };
  };

  const Patcher = {
    before: (c, o, m, f) => addPatch(c, o, m, "before", f),
    after: (c, o, m, f) => addPatch(c, o, m, "after", f),
    instead: (c, o, m, f) => addPatch(c, o, m, "instead", f),
    unpatchAll: (caller) => {
      for (const p of (patches.get(caller) || []).reverse()) {
        if (p.obj[p.method] === p.wrapped) p.obj[p.method] = p.original;
      }
      patches.delete(caller);
    }
  };

  const memory = new Map();
  let ls = null;
  try {
    const frame = document.createElement("iframe");
    frame.style.display = "none";
    document.body.append(frame);
    ls = frame.contentWindow.localStorage;
  } catch {}

  const storeKey = (plugin, key) => `NitroAPI:${plugin}:${key}`;
  const Data = {
    save(plugin, key, value) {
      const raw = JSON.stringify(value);
      try { ls ? ls.setItem(storeKey(plugin, key), raw) : memory.set(storeKey(plugin, key), raw); } catch {}
    },
    load(plugin, key) {
      try {
        const raw = ls ? ls.getItem(storeKey(plugin, key)) : memory.get(storeKey(plugin, key));
        return raw == null ? undefined : JSON.parse(raw);
      } catch { return undefined; }
    },
    delete(plugin, key) {
      try { ls ? ls.removeItem(storeKey(plugin, key)) : memory.delete(storeKey(plugin, key)); } catch {}
    }
  };

  const Files = (() => {
    let dbPromise = null;
    const urls = new Map();
    const open = () => dbPromise || (dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open("NitroAPI", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("files");
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }));
    const run = async (mode, fn) => {
      const db = await open();
      return new Promise((resolve, reject) => {
        const t = db.transaction("files", mode);
        const r = fn(t.objectStore("files"));
        t.oncomplete = () => resolve(r?.result);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      });
    };
    return {
      async save(key, blob) {
        await run("readwrite", (store) => store.put(blob, key));
        const old = urls.get(key);
        if (old) URL.revokeObjectURL(old);
        urls.delete(key);
      },
      async getBlob(key) {
        return (await run("readonly", (store) => store.get(key))) || null;
      },
      async getUrl(key) {
        if (urls.has(key)) return urls.get(key);
        const blob = await run("readonly", (store) => store.get(key));
        if (!blob) return "";
        const url = URL.createObjectURL(blob);
        urls.set(key, url);
        return url;
      }
    };
  })();

  const DOM = {
    addStyle(id, css) {
      DOM.removeStyle(id);
      const el = document.createElement("style");
      el.id = `nitro-style-${id}`;
      el.textContent = css;
      document.head.append(el);
    },
    removeStyle(id) {
      document.getElementById(`nitro-style-${id}`)?.remove();
    }
  };

  const COLORS = { info: "#7c5cff", success: "#3ba55d", warning: "#faa61a", error: "#ed4245" };

  const el = (tag, props = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else n[k] = v;
    }
    for (const kid of kids) if (kid) n.append(kid);
    return n;
  };

  const LOGO_URL = "data:image/png;base64,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";

  const SETTINGS_CSS = `
.nsx-overlay { position: fixed; inset: 0; z-index: 100001; display: flex; align-items: center; justify-content: center;
  background: rgba(4,5,9,.62); backdrop-filter: blur(10px) saturate(130%); animation: nsx-fade .18s ease both; }
.nsx-modal { --nsx-accent: #f4f4f5; --nsx-line: rgba(255,255,255,.08); --nsx-muted: #7e7e87;
  width: min(880px, 94vw); height: min(620px, 88vh); display: flex; flex-direction: column; overflow: hidden;
  border-radius: 18px; color: #f4f4f5; font: 14px/1.45 "gg sans", "Segoe UI", system-ui, sans-serif;
  background: radial-gradient(720px 240px at 50% -22%, rgba(255,255,255,.07), transparent 70%), #050506;
  border: 1px solid rgba(255,255,255,.11);
  box-shadow: 0 40px 90px rgba(0,0,0,.85), 0 0 0 1px #000, 0 0 50px rgba(255,255,255,.035);
  animation: nsx-pop .26s cubic-bezier(.2,.9,.3,1.08) both; }
.nsx-modal *, .nsx-modal *::before, .nsx-modal *::after { box-sizing: border-box; }
@keyframes nsx-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes nsx-pop { from { opacity: 0; transform: translateY(10px) scale(.97); } to { opacity: 1; transform: none; } }
@keyframes nsx-slide { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }

.nsx-head { display: flex; align-items: center; gap: 14px; padding: 18px 22px; border-bottom: 1px solid var(--nsx-line); }
.nsx-logo { width: 42px; height: 42px; flex: none; border-radius: 50%; object-fit: contain; display: block;
  box-shadow: 0 0 0 1px rgba(255,255,255,.2), 0 6px 20px rgba(0,0,0,.7), 0 0 24px rgba(255,255,255,.09); }
.nsx-titles { flex: 1; min-width: 0; }
.nsx-h1 { font-size: 16px; font-weight: 700; letter-spacing: .01em; }
.nsx-sub { color: var(--nsx-muted); font-size: 12px; margin-top: 1px; }
.nsx-pills { display: flex; gap: 6px; }
.nsx-pill { border: 1px solid var(--nsx-line); background: rgba(255,255,255,.04); color: inherit; padding: 5px 12px; border-radius: 999px; font-size: 12px; cursor: pointer; }
.nsx-pill.is-active { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.3); }
.nsx-close { width: 32px; height: 32px; display: grid; place-items: center; border: 0; border-radius: 9px; background: rgba(255,255,255,.05);
  color: #c9ccd6; font-size: 15px; cursor: pointer; transition: background .15s, color .15s; }
.nsx-close:hover { background: rgba(237,66,69,.22); color: #fff; }

.nsx-body { flex: 1; min-height: 0; display: flex; }
.nsx { flex: 1; min-width: 0; display: flex; }
.nsx-side { width: 230px; flex: none; display: flex; flex-direction: column; gap: 10px; padding: 16px 12px; border-right: 1px solid var(--nsx-line); background: rgba(255,255,255,.022); }
.nsx-search { width: 100%; padding: 9px 12px; color: inherit; font: inherit; font-size: 13px; background: rgba(255,255,255,.05);
  border: 1px solid var(--nsx-line); border-radius: 10px; outline: none; transition: border-color .15s, box-shadow .15s; }
.nsx-search::placeholder { color: var(--nsx-muted); }
.nsx-search:focus, .nsx-input:focus { border-color: var(--nsx-accent); box-shadow: 0 0 0 3px rgba(255,255,255,0.125); }
.nsx-nav { display: flex; flex-direction: column; gap: 3px; overflow: auto; }
.nsx-tab { position: relative; display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; text-align: left;
  padding: 9px 12px; border: 0; border-radius: 9px; background: transparent; color: #aeb3c2; font: inherit; font-size: 13.5px; font-weight: 500; cursor: pointer;
  transition: background .15s, color .15s; }
.nsx-tab:hover { background: rgba(255,255,255,.05); color: #fff; }
.nsx-tab.is-active { background: rgba(255,255,255,0.1); color: #fff; }
.nsx-tab.is-active::before { content: ""; position: absolute; left: -12px; top: 9px; bottom: 9px; width: 3px; border-radius: 0 3px 3px 0; background: var(--nsx-accent); }
.nsx-count { font-size: 11px; font-weight: 600; color: var(--nsx-muted); background: rgba(255,255,255,.06); padding: 1px 7px; border-radius: 999px; }
.nsx-tab.is-active .nsx-count { color: #fff; background: rgba(255,255,255,0.225); }

.nsx-content { flex: 1; min-width: 0; overflow: auto; padding: 8px 26px 26px; scrollbar-gutter: stable; }
.nsx-section { animation: nsx-slide .22s ease both; }
.nsx-sec-head { display: flex; align-items: baseline; gap: 10px; padding: 18px 0 8px; position: sticky; top: 0; z-index: 1;
  background: linear-gradient(#050506 70%, transparent); }
.nsx-sec-head h2 { margin: 0; font-size: 12px; font-weight: 700; letter-spacing: .09em; text-transform: uppercase; color: var(--nsx-muted); }
.nsx-rows { border: 1px solid var(--nsx-line); border-radius: 14px; background: rgba(255,255,255,.022); overflow: hidden; }
.nsx-row { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 14px 18px; transition: background .15s; }
.nsx-row + .nsx-row { border-top: 1px solid var(--nsx-line); }
.nsx-row:hover { background: rgba(255,255,255,.03); }
.nsx-row.is-toggle { cursor: pointer; }
.nsx-label { flex: 1; min-width: 0; }
.nsx-name { font-weight: 600; font-size: 14px; color: #f1f2f6; }
.nsx-note { color: var(--nsx-muted); font-size: 12.5px; margin-top: 3px; line-height: 1.4; }

.nsx-switch { position: relative; width: 44px; height: 25px; flex: none; }
.nsx-switch input { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: pointer; z-index: 1; }
.nsx-knob { position: absolute; inset: 0; border-radius: 999px; background: rgba(255,255,255,.13); transition: background .22s; }
.nsx-knob::after { content: ""; position: absolute; top: 3px; left: 3px; width: 19px; height: 19px; border-radius: 50%; background: #fff;
  box-shadow: 0 2px 6px rgba(0,0,0,.45); transition: transform .24s cubic-bezier(.3,.9,.3,1.25); }
.nsx-switch input:checked + .nsx-knob { background: var(--nsx-accent); box-shadow: 0 0 12px rgba(255,255,255,.22); }
.nsx-switch input:checked + .nsx-knob::after { transform: translateX(19px); background: #050506; }
.nsx-switch input:focus-visible + .nsx-knob { outline: 2px solid var(--nsx-accent); outline-offset: 2px; }

.nsx-input { width: 280px; max-width: 48%; padding: 8px 11px; color: inherit; font: inherit; font-size: 13px; background: rgba(0,0,0,.28);
  border: 1px solid var(--nsx-line); border-radius: 9px; outline: none; transition: border-color .15s, box-shadow .15s; }
select.nsx-input { cursor: pointer; }
select.nsx-input option { background: #0d0d10; }
.nsx-filectl { display: flex; gap: 6px; width: 360px; max-width: 58%; }
.nsx-filectl .nsx-input { flex: 1; min-width: 0; width: auto; max-width: none; }
.nsx-btn { flex: none; padding: 8px 14px; color: #fff; font: inherit; font-size: 13px; font-weight: 600; cursor: pointer;
  background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.325);
  border-radius: 9px; transition: background .15s, transform .1s; }
.nsx-btn:hover { background: rgba(255,255,255,0.25); }
.nsx-btn:active { transform: scale(.97); }
.nsx-btn.is-ghost { background: rgba(255,255,255,.05); border-color: var(--nsx-line); color: #c9ccd6; padding: 8px 11px; }
.nsx-btn.is-ghost:hover { background: rgba(237,66,69,.22); color: #fff; }
.nsx-colorctl { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; max-width: 58%; }
.nsx-color { width: 38px; height: 34px; padding: 2px; cursor: pointer; border-radius: 8px; border: 1px solid var(--nsx-line); background: rgba(0,0,0,.28); }
.nsx-colorctl .nsx-hex { width: 96px; max-width: none; font-family: monospace; }
.nsx-dot { flex: none; width: 20px; height: 20px; padding: 0; cursor: pointer; border-radius: 50%; border: 2px solid rgba(255,255,255,.2); transition: transform .12s, border-color .12s; }
.nsx-dot:hover { transform: scale(1.18); border-color: #fff; }
.nsx-empty { text-align: center; color: var(--nsx-muted); padding: 60px 0; }

.nsx-foot { display: flex; justify-content: space-between; padding: 10px 22px; border-top: 1px solid var(--nsx-line); color: var(--nsx-muted); font-size: 12px; background: rgba(255,255,255,.022); }
.nsx-foot kbd { font: inherit; font-size: 11px; padding: 1px 6px; border-radius: 5px; background: rgba(255,255,255,.08); border: 1px solid var(--nsx-line); }
.nsx-content::-webkit-scrollbar, .nsx-nav::-webkit-scrollbar { width: 8px; }
.nsx-content::-webkit-scrollbar-thumb, .nsx-nav::-webkit-scrollbar-thumb { background: rgba(255,255,255,.16); border-radius: 8px; }
.nsx-content::-webkit-scrollbar-thumb:hover, .nsx-nav::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,.3); }
`;

  const buildSettingsPanel = ({ settings = [], onChange = () => {} } = {}) => {
    DOM.addStyle("settings", SETTINGS_CSS);

    const groups = [];
    const loose = settings.filter((i) => i.type !== "category");
    if (loose.length) groups.push({ id: null, name: "General", items: loose });
    for (const c of settings) if (c.type === "category") groups.push({ id: c.id, name: c.name || c.id, items: c.settings || [] });

    const search = el("input", { class: "nsx-search", type: "text", placeholder: "Search settings" });
    const nav = el("nav", { class: "nsx-nav" });
    const content = el("div", { class: "nsx-content" });
    const empty = el("div", { class: "nsx-empty", text: "No settings match your search." });
    empty.style.display = "none";
    const root = el("div", { class: "nsx" },
      el("aside", { class: "nsx-side" }, search, nav),
      content
    );

    let active = groups[0];

    const makeRow = (group, item) => {
      const fire = (value) => {
        try { onChange(group.id, item.id, value); }
        catch (err) { console.error("[NitroAPI] settings onChange failed:", item.id, err); }
      };
      const label = el("div", { class: "nsx-label" }, el("div", { class: "nsx-name", text: item.name || item.id }));
      if (item.note) label.append(el("div", { class: "nsx-note", text: item.note }));

      const row = el("div", { class: "nsx-row" }, label);
      let control;
      if (item.type === "switch") {
        const input = el("input", { type: "checkbox", checked: !!item.value, onchange: (e) => {
          item.value = e.target.checked; updateCount(group); fire(e.target.checked);
        } });
        control = el("label", { class: "nsx-switch" }, input, el("span", { class: "nsx-knob" }));
        row.classList.add("is-toggle");
        label.addEventListener("click", () => input.click());
      } else if (item.type === "number") {
        control = el("input", { type: "number", class: "nsx-input", value: item.value ?? "",
          onchange: (e) => { const n = Number(e.target.value); fire(Number.isFinite(n) ? n : item.value); } });
      } else if (item.type === "text") {
        control = el("input", { type: "text", class: "nsx-input", value: item.value ?? "", spellcheck: false,
          onchange: (e) => fire(e.target.value) });
      } else if (item.type === "file") {
        const key = item.fileKey || item.id;
        const shown = (v) => (typeof v === "string" && v.startsWith("local:")
          ? "File: " + (v.split(":").slice(2).join(":") || "chosen file") : (v || ""));
        const text = el("input", { type: "text", class: "nsx-input", value: shown(item.value), spellcheck: false,
          placeholder: "Paste a URL, or browse for a file",
          onchange: (e) => { const v = e.target.value.trim(); if (v.startsWith("File: ")) return; item.value = v; fire(v); } });
        const picker = el("input", { type: "file", accept: item.accept || "image/*" });
        picker.style.display = "none";
        picker.addEventListener("change", async () => {
          const f = picker.files && picker.files[0];
          picker.value = "";
          if (!f) return;
          if (f.size > 25 * 1024 * 1024) return UI.showToast("That file is over 25 MB. Pick a smaller one.", { type: "error" });
          try {
            await Files.save(key, f);
            const v = `local:${key}:${f.name}`;
            item.value = v; text.value = shown(v); fire(v);
          } catch (err) {
            console.error("[NitroAPI] couldn't save file:", err);
            UI.showToast("Couldn't save that file.", { type: "error" });
          }
        });
        const browse = el("button", { class: "nsx-btn", text: "Browse\u2026", onclick: () => picker.click() });
        const clear = el("button", { class: "nsx-btn is-ghost", text: "\u2715", title: "Clear",
          onclick: () => { item.value = ""; text.value = ""; fire(""); } });
        control = el("div", { class: "nsx-filectl" }, text, browse, clear, picker);
      } else if (item.type === "color") {
        const HEX = /^#[0-9a-f]{6}$/i;
        const norm = (v) => {
          let s = String(v || "").trim().toLowerCase();
          if (/^#?[0-9a-f]{3}$/.test(s)) s = "#" + s.replace("#", "").replace(/./g, "$&$&");
          else if (/^[0-9a-f]{6}$/.test(s)) s = "#" + s;
          return HEX.test(s) ? s : null;
        };
        const first = norm(item.value) || "#ffffff";
        const swatch = el("input", { type: "color", class: "nsx-color", value: first, title: "Pick a color" });
        const hex = el("input", { type: "text", class: "nsx-input nsx-hex", value: first, maxLength: 7, spellcheck: false, placeholder: "#rrggbb" });
        const set = (v) => { item.value = v; swatch.value = v; hex.value = v; fire(v); };
        let t = null;
        swatch.addEventListener("input", () => {
          hex.value = swatch.value; clearTimeout(t);
          t = setTimeout(() => { item.value = swatch.value; fire(swatch.value); }, 100);
        });
        swatch.addEventListener("change", () => { clearTimeout(t); set(swatch.value); });
        hex.addEventListener("change", () => {
          const v = norm(hex.value);
          if (v) set(v);
          else { hex.value = item.value || first; UI.showToast("Use a hex color like #ff8800", { type: "error" }); }
        });
        control = el("div", { class: "nsx-colorctl" });
        for (const c of item.colors || []) {
          const v = norm(c);
          if (!v) continue;
          const dot = el("button", { class: "nsx-dot", title: v, onclick: () => set(v) });
          dot.style.background = v;
          control.append(dot);
        }
        control.append(swatch, hex);
      } else if (item.type === "dropdown") {
        control = el("select", { class: "nsx-input", onchange: (e) => fire(e.target.value) });
        for (const o of item.options || []) {
          const opt = el("option", { value: o.value, text: o.label });
          opt.selected = o.value === item.value;
          control.append(opt);
        }
      } else if (item.type === "button") {
        control = el("button", { class: "nsx-btn", text: item.label || "Run", onclick: () => {
          try { item.onClick?.(); } catch (err) { console.error("[NitroAPI] settings button failed:", item.id, err); }
        } });
      } else {
        return null;
      }
      row.append(control);
      return { node: row, text: `${item.name || ""} ${item.note || ""} ${group.name}`.toLowerCase() };
    };

    const updateCount = (g) => {
      const sw = g.items.filter((i) => i.type === "switch");
      g.counter.textContent = `${sw.filter((i) => i.value).length}/${sw.length}`;
      g.counter.style.display = sw.length ? "" : "none";
    };

    for (const g of groups) {
      g.counter = el("span", { class: "nsx-count" });
      g.tab = el("button", { class: "nsx-tab", onclick: () => { search.value = ""; active = g; render(); } },
        el("span", { text: g.name }), g.counter);
      nav.append(g.tab);

      const list = el("div", { class: "nsx-rows" });
      g.rows = g.items.map((it) => makeRow(g, it)).filter(Boolean);
      for (const r of g.rows) list.append(r.node);
      g.section = el("section", { class: "nsx-section" }, el("div", { class: "nsx-sec-head" }, el("h2", { text: g.name })), list);
      content.append(g.section);
      updateCount(g);
    }
    content.append(empty);

    const render = () => {
      const q = search.value.trim().toLowerCase();
      let any = false;
      for (const g of groups) {
        let shown = 0;
        for (const r of g.rows) {
          const ok = !q || r.text.includes(q);
          r.node.style.display = ok ? "" : "none";
          if (ok) shown++;
        }
        const showSection = q ? shown > 0 : g === active;
        g.section.style.display = showSection ? "" : "none";
        g.tab.classList.toggle("is-active", !q && g === active);
        if (showSection) any = true;
      }
      empty.style.display = any ? "none" : "";
      content.scrollTop = 0;
    };
    search.addEventListener("input", render);
    render();
    return root;
  };

  const UI = {
    showToast(message, options = {}) {
      const toast = document.createElement("div");
      toast.className = "ns-toast";
      toast.style.borderLeftColor = COLORS[options.type] || COLORS.info;
      toast.textContent = message;
      document.body.append(toast);
      setTimeout(() => toast.remove(), options.timeout || 3000);
    },
    buildSettingsPanel
  };

  window.BdApi = { __nitro: true, Webpack, Patcher, Data, DOM, UI, Files };

  const instances = [];
  window.NitroLoader = {
    instances,
    register(PluginClass, filename) {
      try { PluginClass.early?.(); }
      catch (err) { console.error("[NitroAPI] early hook failed:", filename, err); }
      let tries = 0;
      const attempt = () => {
        let ready = false;
        try { ready = !!Webpack.getStore("UserStore")?.getCurrentUser?.(); } catch {}
        if (!ready) {
          if (++tries > 4000) return console.error("[NitroAPI] gave up waiting for Discord:", filename);
          return setTimeout(attempt, 150);
        }
        try {
          const plugin = new PluginClass();
          plugin.start();
          instances.push(plugin);
          console.log("[NitroAPI] started", filename);
        } catch (err) {
          console.error("[NitroAPI] plugin failed:", filename, err);
        }
      };
      attempt();
    },
    stopAll() {
      while (instances.length) { try { instances.pop().stop(); } catch {} }
    },
    openSettings() { openSettingsModal(); },
    closeSettings() { closeSettingsModal(); }
  };

  let settingsOverlay = null;
  let settingsKeyHandler = null;
  const PANE_LABELS = { NitroShield: "General" };

  function closeSettingsModal() {
    settingsOverlay?.remove();
    settingsOverlay = null;
    if (settingsKeyHandler) document.removeEventListener("keydown", settingsKeyHandler, true);
    settingsKeyHandler = null;
  }

  function openSettingsModal() {
    closeSettingsModal();
    DOM.addStyle("settings", SETTINGS_CSS);

    const panes = [];
    for (const inst of instances) {
      if (typeof inst.getSettingsPanel !== "function") continue;
      let content;
      try { content = inst.getSettingsPanel(); }
      catch (err) { console.error("[NitroAPI] getSettingsPanel failed:", err); continue; }
      if (!(content instanceof Node)) continue;
      const raw = inst.constructor?.displayName || inst.constructor?.name || "Plugin";
      panes.push({ name: PANE_LABELS[raw] || raw, content });
    }
    panes.sort((a, b) => (b.name === "General") - (a.name === "General"));

    const body = el("div", { class: "nsx-body" });
    const logo = el("img", { class: "nsx-logo", src: LOGO_URL, alt: "" });
    const sub = el("div", { class: "nsx-sub" });
    const pills = el("div", { class: "nsx-pills" });

    const show = (pane) => {
      body.textContent = "";
      sub.textContent = "Settings";
      if (pane) body.append(pane.content);
      else body.append(el("div", { class: "nsx-empty", style: "flex:1", text: "No running plugin has settings. Log in first, then try again." }));
      pills.querySelectorAll(".nsx-pill").forEach((b) => b.classList.toggle("is-active", b.textContent === pane?.name));
    };
    if (panes.length > 1) for (const p of panes) pills.append(el("button", { class: "nsx-pill", text: p.name, onclick: () => show(p) }));

    const head = el("div", { class: "nsx-head" },
      logo,
      el("div", { class: "nsx-titles" }, el("div", { class: "nsx-h1", text: "OpsexCord" }), sub),
      pills,
      el("button", { class: "nsx-close", text: "\u2715", title: "Close (Esc)", onclick: closeSettingsModal })
    );
    const foot = el("div", { class: "nsx-foot" },
      el("span", { text: "Changes save automatically" }),
      (() => { const s = el("span", {}); s.append("Press ", el("kbd", { text: "Esc" }), " to close \u00b7 ", el("kbd", { text: "Ctrl+Alt+S" }), " to toggle"); return s; })()
    );

    const modal = el("div", { class: "nsx-modal" }, head, body, foot);
    show(panes[0]);

    settingsOverlay = el("div", { class: "nsx-overlay", onmousedown: (e) => { if (e.target === settingsOverlay) closeSettingsModal(); } }, modal);
    document.body.append(settingsOverlay);

    settingsKeyHandler = (e) => { if (e.key === "Escape") { e.stopPropagation(); closeSettingsModal(); } };
    document.addEventListener("keydown", settingsKeyHandler, true);
  }

  document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.altKey && e.key.toLowerCase() === "s") {
      e.preventDefault();
      settingsOverlay ? closeSettingsModal() : openSettingsModal();
    }
  }, true);

  console.log("[NitroAPI] ready");
})();