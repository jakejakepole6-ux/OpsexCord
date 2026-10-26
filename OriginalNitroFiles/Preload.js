// @name OpsexCord
// @author @geofeed on discord

const { contextBridge, ipcRenderer } = require("electron");

let panicHandler = null;
ipcRenderer.on("opsec:panic", () => { try { panicHandler && panicHandler(); } catch {} });

contextBridge.exposeInMainWorld("OPSEC", {
  setConfig: (cfg) => ipcRenderer.invoke("opsec:config", cfg),
  setState: (state) => ipcRenderer.send("opsec:state", state),
  getMemory: () => ipcRenderer.invoke("opsec:memory"),
  panic: () => ipcRenderer.send("opsec:panic"),
  reload: () => ipcRenderer.send("opsec:reload"),
  onPanic: (cb) => { panicHandler = typeof cb === "function" ? cb : null; },
  music: {
    call: (name, args) => ipcRenderer.invoke("music:call", name, args),
    onState: (cb) => { ipcRenderer.on("music:state", (e, st) => { try { cb(st); } catch {} }); }
  },
  link: {
    ready: () => ipcRenderer.send("link:ready"),
    check: (url) => ipcRenderer.send("link:check", String(url || "")),
    preview: (id) => ipcRenderer.send("link:preview", Number(id)),
    open: () => ipcRenderer.send("link:open"),
    copy: () => ipcRenderer.send("link:copy"),
    close: () => ipcRenderer.send("link:close"),
    onView: (cb) => { ipcRenderer.on("link:view", (e, d) => { try { cb(d); } catch {} }); }
  },
  rec: {
    begin: (o) => ipcRenderer.invoke("rec:begin", o),
    write: (buf) => ipcRenderer.send("rec:chunk", buf),
    end: () => ipcRenderer.invoke("rec:end"),
    open: () => ipcRenderer.invoke("rec:open")
  }
});