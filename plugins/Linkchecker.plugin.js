/**
 * @name OpsexCord
 * @author @geofeed on discord
 */

const NAME = "LinkChecker";

const h = (tag, attrs, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v == null) continue;
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k === "value") e.value = v;
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat()) {
    if (c == null || c === false) continue;
    e.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return e;
};

const CSS = `
.lc-overlay { position: fixed; inset: 0; z-index: 100002; display: none; align-items: center; justify-content: center;
  background: rgba(4,5,9,.62); backdrop-filter: blur(10px) saturate(130%); }
.lc-overlay.open { display: flex; animation: lc-fade .18s ease both; }
.lc-modal { --lc-line: rgba(255,255,255,.08); --lc-muted: #7e7e87;
  width: min(540px, 94vw); max-height: 90vh; display: flex; flex-direction: column; overflow: hidden;
  border-radius: 18px; color: #f4f4f5; font: 14px/1.45 "gg sans","Segoe UI",system-ui,sans-serif;
  background: radial-gradient(520px 200px at 50% -22%, rgba(255,255,255,.07), transparent 70%), #050506;
  border: 1px solid rgba(255,255,255,.11);
  box-shadow: 0 40px 90px rgba(0,0,0,.85), 0 0 0 1px #000, 0 0 50px rgba(255,255,255,.035);
  animation: lc-pop .26s cubic-bezier(.2,.9,.3,1.08) both; }
.lc-modal *, .lc-modal *::before, .lc-modal *::after { box-sizing: border-box; }
.lc-modal button { font: inherit; color: inherit; cursor: pointer; border: 0; background: none; }
@keyframes lc-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes lc-pop { from { opacity: 0; transform: translateY(10px) scale(.97); } to { opacity: 1; transform: none; } }

.lc-head { display: flex; align-items: center; gap: 12px; padding: 14px 18px; border-bottom: 1px solid var(--lc-line); }
.lc-logo { width: 36px; height: 36px; flex: none; border-radius: 50%; display: grid; place-items: center; font-size: 16px;
  background: rgba(255,255,255,.06); box-shadow: 0 0 0 1px rgba(255,255,255,.2), 0 6px 20px rgba(0,0,0,.7), 0 0 24px rgba(255,255,255,.09); }
.lc-titles { flex: 1; min-width: 0; }
.lc-h1 { font-size: 16px; font-weight: 600; letter-spacing: .01em; }
.lc-h1 b { font-weight: 800; letter-spacing: .03em; }
.lc-sub { color: var(--lc-muted); font-size: 12px; margin-top: 1px; }
.lc-x { width: 30px; height: 30px; display: grid; place-items: center; border-radius: 9px; background: rgba(255,255,255,.05);
  color: #c9ccd6; font-size: 14px; transition: background .15s, color .15s; }
.lc-x:hover { background: rgba(237,66,69,.22); color: #fff; }

.lc-body { flex: 1; min-height: 0; overflow: auto; padding: 16px 18px 18px; display: flex; flex-direction: column; gap: 12px; scrollbar-gutter: stable; }
.lc-body::-webkit-scrollbar { width: 8px; }
.lc-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,.16); border-radius: 8px; }
.lc-body::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,.3); }

.lc-row { display: flex; gap: 8px; }
.lc-input { flex: 1; min-width: 0; height: 40px; padding: 0 16px; border-radius: 999px; outline: none; color: #f4f4f5; font: inherit; font-size: 13.5px;
  background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.13); transition: border-color .15s, box-shadow .15s, background .15s; }
.lc-input::placeholder { color: var(--lc-muted); }
.lc-input:focus { border-color: #f4f4f5; background: rgba(255,255,255,.06); box-shadow: 0 0 0 3px rgba(255,255,255,.12); }
.lc-btn { flex: none; height: 40px; padding: 0 20px; border-radius: 999px; color: #fff; font-weight: 600; font-size: 13.5px; letter-spacing: .02em;
  background: rgba(255,255,255,.14) !important; border: 1px solid rgba(255,255,255,.33) !important; transition: background .15s, transform .1s, border-color .15s; }
.lc-btn:hover { background: rgba(255,255,255,.22) !important; border-color: rgba(255,255,255,.5) !important; }
.lc-btn:active { transform: scale(.97); }
.lc-btn.warn { background: rgba(237,66,69,.22) !important; border-color: rgba(237,66,69,.6) !important; }
.lc-btn.warn:hover { background: rgba(237,66,69,.34) !important; }
.lc-btn.ghost { background: none !important; border-color: rgba(255,255,255,.16) !important; color: #b5b5bd; font-weight: 500; }
.lc-btn.ghost:hover { background: rgba(255,255,255,.06) !important; color: #fff; }

.lc-empty, .lc-small { color: var(--lc-muted); font-size: 12px; }
.lc-empty { text-align: center; padding: 10px 0 4px; font-size: 12.5px; }
.lc-pill { align-self: center; padding: 8px 20px; border-radius: 999px; font-weight: 700; font-size: 15px; letter-spacing: .02em; border: 1px solid; }
.lc-pill.ok { color: #3ddc84; background: rgba(61,220,132,.1); border-color: rgba(61,220,132,.4); }
.lc-pill.caution { color: #ffb02e; background: rgba(255,176,46,.1); border-color: rgba(255,176,46,.45); }
.lc-pill.danger { color: #ff5d63; background: rgba(255,93,99,.12); border-color: rgba(255,93,99,.5); }
.lc-urlbox { padding: 10px 14px; border-radius: 12px; background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.1);
  color: #d6d6dc; font-size: 12.5px; word-break: break-all; max-height: 84px; overflow: auto; user-select: text; }
.lc-domain { text-align: center; color: #9a9aa3; font-size: 13px; }
.lc-domain b { color: #fff; font-size: 15px; }
.lc-finds { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.lc-finds li { display: flex; gap: 10px; align-items: flex-start; padding: 9px 12px; border-radius: 12px; background: rgba(255,255,255,.035); font-size: 13px; }
.lc-ic { flex: none; width: 20px; height: 20px; border-radius: 50%; display: grid; place-items: center; font-size: 12px; font-weight: 800; margin-top: 1px; }
.lc-finds li.bad .lc-ic { background: #ff5d63; color: #000; }
.lc-finds li.warn .lc-ic { background: #ffb02e; color: #000; }
.lc-finds li.info .lc-ic { background: rgba(255,255,255,.18); color: #fff; }
.lc-finds li.good .lc-ic { background: #3ddc84; color: #000; }
.lc-card { padding: 14px; border-radius: 14px; background: rgba(255,255,255,.035); border: 1px solid rgba(255,255,255,.08); display: flex; flex-direction: column; gap: 10px; }
.lc-card h2 { margin: 0; font-size: 11px; letter-spacing: .09em; text-transform: uppercase; color: #8e9099; font-weight: 700; }
.lc-pv { display: flex; flex-direction: column; gap: 10px; }
.lc-chain { font-size: 12px; color: #b5b5bd; word-break: break-all; display: flex; flex-direction: column; gap: 4px; }
.lc-ptitle { font-weight: 700; font-size: 15px; word-break: break-word; }
.lc-pdesc { color: #b5b5bd; font-size: 13px; word-break: break-word; }
.lc-shot { width: 100%; border-radius: 10px; border: 1px solid rgba(255,255,255,.12); display: block; background: #fff; }
.lc-err { color: #ff7b80; font-size: 13px; }
.lc-actions { display: flex; gap: 8px; flex-wrap: wrap; justify-content: center; margin-top: 2px; }
.lc-hide { display: none !important; }

.opsec-lc-item:hover { background: rgba(255,255,255,.1) !important; color: #fff !important; }
.opsec-lc-item { cursor: pointer; }
body.ns-blur .lc-modal .lc-urlbox, body.ns-blur .lc-modal .lc-domain { filter: blur(7px); transition: filter .15s; }
body.ns-blur .lc-modal .lc-urlbox:hover, body.ns-blur .lc-modal .lc-domain:hover { filter: none; }
`;

const ICON = { bad: "\u2715", warn: "!", info: "i", good: "\u2713" };
const LABEL = { ok: "No red flags found", caution: "Looks suspicious", danger: "Likely dangerous" };
const isWeb = (u) => /^https?:\/\//i.test(u || "");

module.exports = class LinkChecker {
  start() {
    this.api = window.OPSEC && window.OPSEC.link;
    if (!this.api) {
      BdApi.UI.showToast("LinkChecker: bridge missing. Add the preload.js and main.js changes, then restart.", { type: "error", timeout: 6000 });
      return;
    }
    this.S = { url: "", findings: [], level: "ok", rep: "off", preview: null };
    this.armed = false;
    this.armTimer = null;
    this.shownUrl = null;
    BdApi.DOM.addStyle(NAME, CSS);
    this.build();

    this.api.onView((d) => {
      if (!d || !d.view) return;
      if (d.view.url !== this.S.url) this.armed = false;
      this.S = d.view;
      if (d.show) this.openUI();
      if (this.overlay.classList.contains("open")) this.render();
    });
    this.api.ready();

    this.ctxH = (e) => this.onContext(e);
    document.addEventListener("contextmenu", this.ctxH, true);
    this.escH = (e) => {
      if (e.key === "Escape" && this.overlay.classList.contains("open")) { e.stopPropagation(); e.preventDefault(); this.closeUI(); }
    };
    document.addEventListener("keydown", this.escH, true);
  }

  stop() {
    if (this.ctxH) document.removeEventListener("contextmenu", this.ctxH, true);
    if (this.escH) document.removeEventListener("keydown", this.escH, true);
    this.obs?.disconnect();
    clearTimeout(this.armTimer);
    this.overlay?.remove();
    BdApi.DOM.removeStyle(NAME);
  }

  build() {
    const stop = (e) => { e.stopPropagation(); if (e.key === "Enter") this.submit(); };
    this.input = h("input", { class: "lc-input", type: "text", placeholder: "paste a link to check", spellcheck: "false", autocomplete: "off", onkeydown: stop });
    this.emptyEl = h("div", { class: "lc-empty" }, "Paste a link above and press Enter, or right-click any link in chat and choose Link checker.");
    this.pill = h("div", { class: "lc-pill" });
    this.urlbox = h("div", { class: "lc-urlbox" });
    this.domain = h("div", { class: "lc-domain" });
    this.finds = h("ul", { class: "lc-finds" });
    this.rep = h("div", { class: "lc-small", style: "text-align:center" });
    this.pv = h("div", { class: "lc-pv" });
    this.openBtn = h("button", { class: "lc-btn", onclick: () => this.open() }, "open in browser");
    this.resEl = h("div", { class: "lc-hide", style: "display:contents" },
      this.pill, this.urlbox, this.domain, this.finds, this.rep,
      h("div", { class: "lc-card" }, h("h2", null, "Preview"), this.pv),
      h("div", { class: "lc-small", style: "text-align:center" }, "A clean result means no red flags were found. It is not a guarantee that a link is safe."),
      h("div", { class: "lc-actions" },
        this.openBtn,
        h("button", { class: "lc-btn ghost", onclick: () => this.api.copy() }, "copy link"),
        h("button", { class: "lc-btn ghost", onclick: () => this.closeUI() }, "close")));

    const modal = h("div", { class: "lc-modal" },
      h("div", { class: "lc-head" },
        h("div", { class: "lc-logo" }, "\uD83D\uDD0E"),
        h("div", { class: "lc-titles" }, h("div", { class: "lc-h1" }, "link ", h("b", null, "check")), h("div", { class: "lc-sub" }, "Safety check before you open a link")),
        h("button", { class: "lc-x", title: "Close (Esc)", onclick: () => this.closeUI() }, "\u2715")),
      h("div", { class: "lc-body" },
        h("div", { class: "lc-row" }, this.input, h("button", { class: "lc-btn", onclick: () => this.submit() }, "check")),
        this.emptyEl, this.resEl));
    this.overlay = h("div", { class: "lc-overlay", onmousedown: (e) => { if (e.target === this.overlay) this.closeUI(); } }, modal);
    document.body.append(this.overlay);
  }

  openUI() {
    this.overlay.classList.add("open");
    if (!this.S.url) setTimeout(() => this.input.focus(), 30);
  }

  closeUI() {
    this.overlay.classList.remove("open");
    this.armed = false;
    clearTimeout(this.armTimer);
    this.shownUrl = null;
    this.S = { url: "", findings: [], level: "ok", rep: "off", preview: null };
    this.api.close();
  }

  submit() {
    const v = this.input.value.trim();
    if (v) this.api.check(v);
  }

  open() {
    if (this.S.level === "danger" && !this.armed) {
      this.armed = true; this.render();
      clearTimeout(this.armTimer);
      this.armTimer = setTimeout(() => { this.armed = false; this.render(); }, 3500);
      return;
    }
    this.api.open();
    this.closeUI();
  }

  renderPreview() {
    const S = this.S, P = S.preview, pv = this.pv;
    pv.replaceChildren();
    const loadBtn = (label) => h("button", { class: "lc-btn", onclick: () => this.api.preview(S.id) }, label);
    if (!P && S.logger) {
      pv.append(h("div", { class: "lc-err" }, "Preview disabled: this is a known IP logger, and loading it would reveal your IP."));
    } else if (!P) {
      pv.append(loadBtn("load preview"), h("div", { class: "lc-small" }, "This contacts the site from your own IP address. It follows redirects, reads the title, and takes a screenshot with JavaScript turned off."));
    } else if (P === "loading") {
      pv.append(h("div", { class: "lc-small" }, "Loading\u2026 following redirects and taking a screenshot (up to ~25 seconds)."));
    } else {
      if (P.error) pv.append(h("div", { class: "lc-err" }, P.error));
      if (P.chain && P.chain.length) {
        pv.append(h("div", { class: "lc-chain" }, P.chain.map((c, i) => h("div", null, (i === 0 ? "" : "\u21B3 ") + c.status + "  " + c.url))));
      }
      if (P.title) pv.append(h("div", { class: "lc-ptitle" }, P.title));
      if (P.siteName) pv.append(h("div", { class: "lc-small" }, P.siteName));
      if (P.description) pv.append(h("div", { class: "lc-pdesc" }, P.description));
      if (P.image && /^data:image\//.test(P.image)) pv.append(h("img", { class: "lc-shot", src: P.image, alt: "page screenshot" }));
      if (P.note) pv.append(h("div", { class: "lc-small" }, P.note));
      if (P.image) pv.append(h("div", { class: "lc-small" }, "Screenshot taken with JavaScript off, so some pages look empty or unstyled."));
      if (P.error) pv.append(loadBtn("try again"));
    }
  }

  render() {
    const S = this.S, empty = !S.url;
    this.emptyEl.classList.toggle("lc-hide", !empty);
    this.resEl.classList.toggle("lc-hide", empty);
    if (this.shownUrl !== S.url) { this.input.value = S.url; this.shownUrl = S.url; }
    if (empty) return;
    this.pill.className = "lc-pill " + S.level;
    this.pill.textContent = LABEL[S.level] || "";
    this.urlbox.textContent = S.url;
    this.domain.replaceChildren(h("span", null, "real domain: "), h("b", null, S.domain || S.host || ""));
    if (S.unicodeHost && S.unicodeHost !== S.host) this.domain.append(h("span", null, "  (displays as " + S.unicodeHost + ")"));
    this.finds.replaceChildren(...S.findings.map((f) => h("li", { class: f.level }, h("span", { class: "lc-ic" }, ICON[f.level] || "i"), h("span", null, f.text))));
    this.rep.textContent = S.rep === "checking" ? "Running online checks\u2026" : "";
    this.openBtn.textContent = this.armed ? "click again to open" : (S.level === "danger" ? "open anyway" : "open in browser");
    this.openBtn.className = "lc-btn" + (S.level === "danger" ? " warn" : "");
    this.renderPreview();
  }

  linksFor(target) {
    const el = target && target.closest ? target : null;
    if (!el) return [];
    const clean = (a) => { try { const u = new URL(a.href); return isWeb(u.href) ? u.href : ""; } catch { return ""; } };
    const direct = el.closest("a[href]");
    if (direct) { const u = clean(direct); return u ? [u] : []; }
    const msg = el.closest('[id^="chat-messages-"], [class*="message_"]');
    if (!msg) return [];
    const urls = [];
    for (const a of msg.querySelectorAll('[id^="message-content-"] a[href], [class*="embed"] a[href], [class*="messageContent"] a[href]')) {
      const u = clean(a);
      if (u && !urls.includes(u)) urls.push(u);
      if (urls.length >= 4) break;
    }
    return urls;
  }

  onContext(e) {
    this.obs?.disconnect();
    const urls = this.linksFor(e.target);
    if (!urls.length) return;
    let done = false;
    const tryAdd = () => {
      if (done) return;
      const menu = [...document.querySelectorAll('[role="menu"]')].find((m) => m.isConnected && !m.querySelector(".opsec-lc-item"));
      if (menu && this.addItems(menu, urls)) { done = true; this.obs?.disconnect(); }
    };
    this.obs = new MutationObserver(tryAdd);
    this.obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => this.obs?.disconnect(), 600);
  }

  label(url, multi) {
    if (!multi) return "Link checker";
    try { return "Link checker: " + new URL(url).hostname.replace(/^www\./, ""); } catch { return "Link checker"; }
  }

  closeDiscordMenu() {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", code: "Escape", keyCode: 27, bubbles: true }));
    setTimeout(() => { if (document.querySelector('[role="menu"]')) document.body.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })); }, 30);
  }

  addItems(menu, urls) {
    const items = [...menu.querySelectorAll('[role="menuitem"]')];
    if (!items.length) return false;
    const anchor = items.find((i) => /copy (message )?link|open link/i.test(i.textContent)) || items[items.length - 1];
    let after = anchor;
    urls.forEach((url) => {
      const item = anchor.cloneNode(true);
      item.removeAttribute("id");
      item.className = [...anchor.classList].filter((c) => !/focused|disabled|danger|colorDanger/i.test(c)).join(" ") + " opsec-lc-item";
      item.removeAttribute("aria-disabled");
      item.setAttribute("tabindex", "-1");
      const label = item.querySelector('[class*="label"]');
      const iconBox = item.querySelector('[class*="iconContainer"]');
      if (label) {
        for (const ch of [...item.children]) if (ch !== label && ch !== iconBox && !ch.contains(label) && !(iconBox && ch.contains(iconBox))) ch.remove();
        label.textContent = this.label(url, urls.length > 1);
      } else {
        item.textContent = this.label(url, urls.length > 1);
      }
      if (iconBox) {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 24 24"); svg.setAttribute("width", "18"); svg.setAttribute("height", "18");
        svg.setAttribute("fill", "none"); svg.setAttribute("stroke", "currentColor"); svg.setAttribute("stroke-width", "2");
        svg.setAttribute("stroke-linecap", "round"); svg.setAttribute("stroke-linejoin", "round");
        svg.innerHTML = '<path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/>';
        iconBox.replaceChildren(svg);
      }
      item.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation();
        this.closeDiscordMenu();
        this.api.check(url);
      }, true);
      after.after(item);
      after = item;
    });
    return true;
  }
};