

https://github.com/user-attachments/assets/7810a8b6-274b-48ab-bb93-b27f12e43e48



https://github.com/user-attachments/assets/2bba2a8c-ffe3-42ea-a20a-cf56a5011b5f



\# OpsexCord



A Discord desktop client with privacy features, built on Electron. Author: @geofeed on discord



\## Download



Get the installer from the \[latest release](https://github.com/jakejakepole6-ux/OpsexCord/releases/latest) and run `OpsexCord-Setup-1.0.0.exe`.



Windows may show "Windows protected your PC" because the installer is not code-signed. Click \*\*More info\*\*, then \*\*Run anyway\*\*.



The full source code is in this repository, so you can read exactly what the app does before installing it.



\## Hotkeys



| Keys | Action |

|------|--------|

| Ctrl+Alt+K | Open the Control Center (all settings) |

| Ctrl+Alt+B | Toggle blur mode |

| Ctrl+Alt+P | Panic (hide, mute and blur) |

| Ctrl+Alt+L | PIN lock manager |

| Ctrl+Alt+C | Check the link on your clipboard |

| Ctrl+Alt+M | Music player |

| Ctrl+Alt+R | Recorder (open / stop recording) |

| Ctrl+Alt+E | Ambience effects on / off |

| Ctrl+Alt+T | Ambience Tetris |



You can change every hotkey in the Control Center.



\## Build from source



You need Node.js and Git installed.



```

git clone https://github.com/jakejakepole6-ux/OpsexCord.git

cd OpsexCord

npm install

npm start

```



To build the installer:



```

npm run dist

```



The installer is created in the `dist` folder.



\## Folders



| Folder | Contents |

|--------|----------|

| `OriginalNitroFiles` | The app itself (main process, preload scripts, music and recorder) |

| `plugins` | Plugins that load automatically (NitroShield, Ambience, Music, Recorder, Linkchecker) |

| `public` | The theme and the scripts injected into Discord |

