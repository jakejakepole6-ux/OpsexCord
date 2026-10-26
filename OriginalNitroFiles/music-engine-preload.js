// @name OpsexCord
// @author @geofeed on discord
"use strict";
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("MEng", {
  token: () => ipcRenderer.invoke("meng:token"),
  event: (name, data) => ipcRenderer.send("meng:event", name, data)
});