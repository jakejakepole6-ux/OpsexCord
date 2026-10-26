// @name OpsexCord
// @author @geofeed on discord
"use strict";
const { app, ipcMain, shell } = require("electron");
const fs = require("fs");
const path = require("path");

module.exports = function initRecorder({ fromDiscord }) {
  const dir = () => path.join(app.getPath("documents"), "OpsexCord Recordings");
  const stamp = () => new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
  let cur = null;

  ipcMain.handle("rec:begin", (e, o) => {
    if (!fromDiscord(e)) return { ok: false, error: "Rejected." };
    if (cur) return { ok: false, error: "Already recording." };
    const kind = o && o.kind === "screen" ? "screen" : "voice";
    try {
      fs.mkdirSync(dir(), { recursive: true });
      const file = path.join(dir(), `${kind}-${stamp()}.webm`);
      const stream = fs.createWriteStream(file);
      stream.on("error", () => {});
      cur = { stream, file, bytes: 0 };
      return { ok: true, path: file };
    } catch (err) {
      return { ok: false, error: String((err && err.message) || err) };
    }
  });

  ipcMain.on("rec:chunk", (e, buf) => {
    if (!fromDiscord(e) || !cur) return;
    let b;
    try { b = Buffer.from(buf); } catch { return; }
    if (b.length === 0 || b.length > 32 * 1024 * 1024) return;
    cur.bytes += b.length;
    cur.stream.write(b);
  });

  ipcMain.handle("rec:end", (e) => new Promise((resolve) => {
    if (!fromDiscord(e) || !cur) return resolve({ ok: false });
    const c = cur;
    cur = null;
    c.stream.end(() => resolve({ ok: true, path: c.file, bytes: c.bytes }));
  }));

  ipcMain.handle("rec:open", (e) => {
    if (!fromDiscord(e)) return false;
    try { fs.mkdirSync(dir(), { recursive: true }); shell.openPath(dir()); return true; } catch { return false; }
  });

  app.on("before-quit", () => { if (cur) { try { cur.stream.end(); } catch {} cur = null; } });
};