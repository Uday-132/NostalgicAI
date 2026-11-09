import { app, BrowserWindow, globalShortcut, clipboard, ipcMain, screen, dialog, shell } from 'electron'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { spawn } from 'child_process'
import { convertFile, getAvailableConvertOptions } from './converter'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

// Disable cache to prevent "Access is denied" errors on Windows
app.commandLine.appendSwitch('disable-http-cache')
app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')

let win: BrowserWindow | null
let chatWin: BrowserWindow | null
let loadingWin: BrowserWindow | null
let radialWin: BrowserWindow | null

function getSelectedFileInExplorer(): Promise<string> {
  return new Promise((resolve) => {
    const psScript = path.join(process.env.APP_ROOT, 'electron', 'get-selected-file.ps1')
    const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psScript])
    let output = ''
    child.stdout.on('data', (d) => { output += d.toString() })
    child.on('close', () => { resolve(output.trim()) })
    child.on('error', () => { resolve('') })
    setTimeout(() => {
      try { child.kill() } catch (e) {}
      resolve('')
    }, 1500)
  })
}

function getFileFromClipboard(): string {
  try {
    // 1. Check FileNameW buffer (standard Windows Explorer right-click -> Copy or Ctrl+C)
    const buf = clipboard.readBuffer('FileNameW')
    if (buf && buf.length > 2) {
      const decoded = buf.toString('ucs2').replace(/\0.*$/, '').trim()
      if (decoded && fs.existsSync(decoded)) {
        console.log('[Main] Found copied file from clipboard FileNameW:', decoded)
        return decoded
      }
    }

    // 2. Check plain text clipboard
    const text = clipboard.readText().replace(/^["']|["']$/g, '').trim()
    if (text && fs.existsSync(text)) {
      console.log('[Main] Found copied file from text clipboard:', text)
      return text
    }
  } catch (e) {
    console.warn('[Main] Clipboard file read error:', e)
  }
  return ''
}

function getCopiedFilePS(): Promise<string> {
  return new Promise((resolve) => {
    const psScript = path.join(process.env.APP_ROOT, 'electron', 'get-copied-file.ps1')
    const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psScript])
    let out = ''
    child.stdout.on('data', d => { out += d.toString() })
    child.on('close', () => { resolve(out.trim()) })
    child.on('error', () => { resolve('') })
    setTimeout(() => {
      try { child.kill() } catch (e) {}
      resolve('')
    }, 1500)
  })
}

async function resolveTargetFile(): Promise<string> {
  try {
    // 1. First, check fresh clipboard file (e.g. right-click -> Copy or user already copied)
    let file = getFileFromClipboard()
    if (file && fs.existsSync(file)) return file

    const copiedPS = await getCopiedFilePS()
    if (copiedPS && fs.existsSync(copiedPS)) {
      console.log('[Main] Found copied file via PowerShell:', copiedPS)
      return copiedPS
    }

    // 2. Simulate Copy (Ctrl+C) to capture clicked/selected file into clipboard
    console.log('[Main] Simulating Copy to capture clicked file...')
    await simulateCopy()
    await new Promise(r => setTimeout(r, 120))

    file = getFileFromClipboard()
    if (file && fs.existsSync(file)) return file

    const postCopyPS = await getCopiedFilePS()
    if (postCopyPS && fs.existsSync(postCopyPS)) {
      return postCopyPS
    }

    // 3. Fallback: check active Explorer window (non-desktop)
    const explorerFile = await getSelectedFileInExplorer()
    if (explorerFile && fs.existsSync(explorerFile)) {
      console.log('[Main] Found selected/focused file via Explorer COM:', explorerFile)
      return explorerFile
    }
  } catch (e) {
    console.warn('[Main] resolveTargetFile error:', e)
  }

  return ''
}

async function handleRadialTrigger(directPath?: string) {
  console.log('[Main] Handling radial conversion trigger separately at mouse position')
  const { x, y } = screen.getCursorScreenPoint()
  let filePath = directPath && directPath.trim() ? directPath.trim() : await resolveTargetFile()
  console.log('[Main] Resolved target file for radial menu:', filePath || '(none)')

  if (!radialWin || radialWin.isDestroyed()) {
    createRadialWindow()
  }

  if (radialWin) {
    const display = screen.getDisplayNearestPoint({ x, y })
    const bounds = display.workArea
    const posX = Math.max(bounds.x, Math.min(bounds.x + bounds.width - 440, Math.round(x - 220)))
    const posY = Math.max(bounds.y, Math.min(bounds.y + bounds.height - 440, Math.round(y - 220)))

    radialWin.setPosition(posX, posY)
    radialWin.show()
    radialWin.focus()
    radialWin.webContents.send('init-radial-file', filePath)
  }
}

function startMouseHook() {
  const psScript = path.join(process.env.APP_ROOT, 'electron', 'mouse-hook.ps1')
  try {
    const hook = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psScript])
    hook.stdout.on('data', async (data) => {
      const text = data.toString()
      const lines = text.split(/\r?\n/)
      for (const line of lines) {
        if (line.startsWith('CTRL_CLICK:')) {
          const directFile = line.replace('CTRL_CLICK:', '').trim()
          console.log('[Main] Detected Ctrl + Left Click with path:', directFile)
          await handleRadialTrigger(directFile)
          break
        } else if (line.includes('CTRL_CLICK')) {
          console.log('[Main] Detected Ctrl + Left Click!')
          await handleRadialTrigger()
          break
        }
      }
    })
    hook.on('error', (err) => console.warn('[Main] Mouse hook:', err.message))

    app.on('before-quit', () => {
      try { hook.kill() } catch (e) {}
    })
  } catch (err) {
    console.warn('[Main] Unable to start mouse hook:', err)
  }
}

function createWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  win = new BrowserWindow({
    width: 960,
    height: 640,
    minWidth: 800,
    minHeight: 560,
    x: Math.floor(width / 2 - 480),
    y: Math.floor(height / 2 - 320),
    frame: false,
    transparent: false,
    backgroundColor: '#121316',
    alwaysOnTop: true,
    resizable: true,
    hasShadow: true,
    show: true,
    icon: path.join(process.env.VITE_PUBLIC, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  win.once('ready-to-show', () => {
    win?.show()
    win?.focus()
  })

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
    win?.show()
    win?.focus()
  })

  win.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log(`[Renderer Log L${level}] ${message} (${sourceId}:${line})`)
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }

  // Hide instead of close on close event
  win.on('close', (event) => {
    if (!(app as any).isQuitting) {
      event.preventDefault()
      win?.hide()
    }
    return false
  })
}

function createChatWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  chatWin = new BrowserWindow({
    width: 400,
    height: 600,
    x: Math.floor(width / 2 - 200),
    y: Math.floor(height / 2 - 300),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false, // Fixed size
    hasShadow: true,
    show: false, // Start hidden
    icon: path.join(process.env.VITE_PUBLIC, 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // Load the chat interface
  if (VITE_DEV_SERVER_URL) {
    chatWin.loadURL(VITE_DEV_SERVER_URL + '/chat.html')
  } else {
    chatWin.loadFile(path.join(RENDERER_DIST, 'chat.html'))
  }

  // Hide instead of close on close event
  chatWin.on('close', (event) => {
    if (!(app as any).isQuitting) {
      event.preventDefault()
      chatWin?.hide()
    }
    return false
  })
}

function createLoadingWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  loadingWin = new BrowserWindow({
    width: 300,
    height: 150,
    x: Math.floor(width / 2 - 150),
    y: Math.floor(height / 2 - 75),
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    hasShadow: true,
    show: false, // Start hidden
    icon: path.join(process.env.VITE_PUBLIC, 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  // Load the loader.html file
  if (VITE_DEV_SERVER_URL) {
    loadingWin.loadURL(VITE_DEV_SERVER_URL + '/loader.html')
  } else {
    loadingWin.loadFile(path.join(RENDERER_DIST, 'loader.html'))
  }

  loadingWin.on('close', (event) => {
    if (!(app as any).isQuitting) {
      event.preventDefault()
      loadingWin?.hide()
    }
    return false
  })
}

function createRadialWindow() {
  radialWin = new BrowserWindow({
    width: 440,
    height: 440,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    radialWin.loadURL(VITE_DEV_SERVER_URL + '/radial.html')
  } else {
    radialWin.loadFile(path.join(RENDERER_DIST, 'radial.html'))
  }

  radialWin.on('close', (event) => {
    if (!(app as any).isQuitting) {
      event.preventDefault()
      radialWin?.hide()
    }
    return false
  })
}

const gotTheLock = VITE_DEV_SERVER_URL ? true : app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore()
      win.show()
      win.focus()
    }
  })

  app.whenReady().then(() => {
    createWindow()
    createChatWindow()
    createLoadingWindow()
    createRadialWindow()
    startMouseHook()

    if (!VITE_DEV_SERVER_URL) {
      app.setLoginItemSettings({
        openAtLogin: true,
        path: app.getPath('exe')
      })
    }

    let shortcutMap: Record<string, string> = {
      'enhance-prompt': 'CommandOrControl+Alt+P',
      'rewrite-code': 'CommandOrControl+Alt+D',
      'enhance-text': 'CommandOrControl+Alt+E',
      'explain-text': 'CommandOrControl+Alt+X',
      'open-chat': 'CommandOrControl+Shift+H',
      'toggle-window': 'CommandOrControl+Alt+Space',
      'convert-file': 'CommandOrControl+Alt+C'
    }

    // Add a function to check if shortcuts are registered
    const checkRegisteredShortcuts = () => {
      console.log('[Main] Checking currently registered shortcuts:')
      Object.entries(shortcutMap).forEach(([action, accelerator]) => {
        const isRegistered = globalShortcut.isRegistered(accelerator)
        console.log(`[Main] ${action} (${accelerator}): ${isRegistered ? 'REGISTERED' : 'NOT REGISTERED'}`)
      })
    }

    const handleActionShortcut = async (action: string, accelerator: string) => {
      console.log(`[Main] Shortcut triggered: ${accelerator} -> ${action}`)

      if (action === 'convert-file') {
        console.log('[Main] Handling convert-file action')
        handleRadialTrigger()
        return
      }

      if (action === 'open-chat') {
        console.log('[Main] Handling open-chat action')
        if (chatWin) {
          if (chatWin.isVisible()) chatWin.hide()
          else { chatWin.show(); chatWin.focus() }
        }
        return
      }

      if (action === 'toggle-window') {
        console.log('[Main] Handling toggle-window action')
        if (win) {
          if (win.isVisible()) {
            win.hide()
          } else {
            win.show()
            win.focus()
            const text = clipboard.readText()
            win.webContents.send('clipboard-changed', text)
          }
        }
        return
      }

      // AI Studio Actions: 'enhance-prompt', 'rewrite-code', 'enhance-text', 'explain-text'
      console.log(`[Main] Handling AI studio action: ${action}`)

      // 1. If Studio HUD window is currently focused, execute action directly on HUD input
      if (win && win.isFocused()) {
        console.log('[Main] Studio HUD window is already focused, executing action directly')
        win.webContents.send('trigger-action', action)
        return
      }

      // 2. If triggered globally from another window (Notepad, Word, Browser, etc.)
      if (loadingWin) {
        loadingWin.showInactive()
      }

      // Temporarily release shortcuts so simulated copy doesn't conflict
      globalShortcut.unregisterAll()
      clipboard.clear()

      // Give Windows OS time to process key release before simulating copy
      setTimeout(async () => {
        try {
          await simulateCopy()
          let attempts = 0
          const maxAttempts = 15

          const checkClipboard = setInterval(() => {
            attempts++
            const text = clipboard.readText()

            if (text && text.trim().length > 0) {
              clearInterval(checkClipboard)
              console.log(`[Main] Captured fresh selected text (${text.length} chars) for ${action}`)

              if (win) {
                // Keep main window hidden during in-place replacement
                win.webContents.send('trigger-action', action, text)
              }

              registerAllShortcuts()
            } else if (attempts >= maxAttempts) {
              clearInterval(checkClipboard)
              console.log('[Main] No text captured from selection')
              if (loadingWin) loadingWin.hide()
              registerAllShortcuts()
            }
          }, 80)
        } catch (err) {
          console.error('[Main] Copy simulation error:', err)
          if (loadingWin) loadingWin.hide()
          registerAllShortcuts()
        }
      }, 250)
    }

    const registerAllShortcuts = () => {
      console.log('[Main] Starting shortcut registration process')
      globalShortcut.unregisterAll()

      // Also register alternate open-chat
      try {
        globalShortcut.register('CommandOrControl+Alt+H', () => {
          if (chatWin) {
            if (chatWin.isVisible()) chatWin.hide()
            else { chatWin.show(); chatWin.focus() }
          }
        })
      } catch (e) {}

      Object.entries(shortcutMap).forEach(([action, accelerator]) => {
        if (!accelerator) return
        try {
          console.log(`[Main] Registering shortcut: ${accelerator} for action: ${action}`)
          const success = globalShortcut.register(accelerator, () => {
            handleActionShortcut(action, accelerator)
          })

          if (!success) {
            console.warn(`[Main] Primary shortcut ${accelerator} failed for ${action}. Trying fallback...`)
            // Fallback for Windows: try Control+Shift if Control+Alt failed
            const fallbacks: string[] = []
            if (accelerator.includes('+Alt+')) {
              fallbacks.push(accelerator.replace('+Alt+', '+Shift+'))
              fallbacks.push(accelerator.replace('CommandOrControl+Alt+', 'Alt+Shift+'))
            }
            for (const fb of fallbacks) {
              const fbOk = globalShortcut.register(fb, () => {
                handleActionShortcut(action, fb)
              })
              if (fbOk) {
                console.log(`[Main] Fallback shortcut ${fb} registered for ${action}`)
                break
              }
            }
          } else {
            console.log(`[Main] Successfully registered shortcut: ${accelerator}`)
          }
        } catch (err) {
          console.error(`[Main] Error registering shortcut ${accelerator}:`, err)
        }
      })
      console.log('[Main] All shortcuts registration attempt completed')
      checkRegisteredShortcuts()
    }

    registerAllShortcuts()

    // Periodically check if shortcuts are still registered (every 30 seconds)
    setInterval(() => {
      checkRegisteredShortcuts()
    }, 30000)

    // IPC Handlers
    ipcMain.handle('get-clipboard', () => {
      return clipboard.readText()
    })

    ipcMain.handle('get-shortcuts', () => {
      return shortcutMap
    })

    ipcMain.handle('update-shortcuts', (_event, newShortcuts: Record<string, string>) => {
      console.log('[Main] Updating shortcuts from UI:', newShortcuts)
      shortcutMap = { ...shortcutMap, ...newShortcuts }
      registerAllShortcuts()
      return { success: true, shortcuts: shortcutMap }
    })

    ipcMain.handle('get-convert-options', (_event, filePath: string) => {
      return getAvailableConvertOptions(filePath)
    })

    ipcMain.handle('convert-file', async (_event, { filePath, targetFormat }: { filePath: string; targetFormat: string }) => {
      return await convertFile(filePath, targetFormat)
    })

    ipcMain.handle('select-file', async () => {
      const parentWin = (radialWin && radialWin.isVisible()) ? radialWin : (win && win.isVisible() ? win : undefined)
      const res = await dialog.showOpenDialog(parentWin as any, {
        title: 'Select File to Convert or Analyze',
        properties: ['openFile'],
        filters: [
          { name: 'Supported Documents', extensions: ['ppt', 'pptx', 'pdf', 'docx', 'doc', 'txt', 'md', 'html'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })
      if (res.canceled || res.filePaths.length === 0) return null
      return res.filePaths[0]
    })

    ipcMain.handle('show-in-folder', (_event, filePath: string) => {
      if (filePath) {
        shell.showItemInFolder(filePath)
      }
    })

    ipcMain.handle('parse-document', async (_event, _filePath: string) => {
      // ... (existing parse logic)
      return ""
    })

    // Re-adding parse logic to be safe
    ipcMain.handle('parse-document-full', async (_event, filePath: string) => {
      try {
        const fs = await import('node:fs/promises')
        const buffer = await fs.readFile(filePath)
        const ext = path.extname(filePath).toLowerCase()

        if (ext === '.pdf') {
          const { createRequire } = await import('node:module')
          const require = createRequire(import.meta.url)
          const pdfModule = require('pdf-parse')
          const PDFParse = pdfModule.PDFParse || pdfModule.default || pdfModule
          const uint8Array = new Uint8Array(buffer)
          const parser = new PDFParse(uint8Array)
          const standardFontsDir = path.join(process.env.APP_ROOT, 'node_modules', 'pdfjs-dist', 'standard_fonts/')
          const data = await parser.getText({ standardFontDataUrl: standardFontsDir })
          return data.text
        } else if (ext === '.docx') {
          const mammoth = await import('mammoth')
          const result = await mammoth.extractRawText({ buffer })
          return result.value
        } else {
          return buffer.toString('utf-8')
        }
      } catch (error: any) {
        throw new Error(`Failed to parse document: ${error.message}`)
      }
    })


    ipcMain.on('hide-window', () => { win?.hide() })
    ipcMain.on('hide-loading-window', () => { loadingWin?.hide() })
    ipcMain.on('hide-chat-window', () => { chatWin?.hide() })
    ipcMain.on('hide-radial-window', () => { radialWin?.hide() })
    ipcMain.on('resize-window', (_event, { width, height }) => { win?.setSize(width, height) })

    ipcMain.on('replace-selection', (_event, text) => {
      clipboard.writeText(text)
      loadingWin?.hide()
      setTimeout(() => { simulatePaste() }, 200)
    })
  })
}

app.on('will-quit', () => {
  console.log('[Main] Application is quitting, cleaning up...')
  globalShortcut.unregisterAll();
  (app as any).isQuitting = true
})

// Add before-quit event handler for cleanup
app.on('before-quit', () => {
  console.log('[Main] Before quit event triggered, performing cleanup...')

  // Unregister all shortcuts
  globalShortcut.unregisterAll();
  console.log('[Main] All shortcuts unregistered')

  // Close all windows
  if (win) {
    win.destroy();
    console.log('[Main] Main window destroyed')
  }

  if (chatWin) {
    chatWin.destroy();
    console.log('[Main] Chat window destroyed')
  }

  if (loadingWin) {
    loadingWin.destroy();
    console.log('[Main] Loading window destroyed')
  }

  if (radialWin) {
    radialWin.destroy();
    console.log('[Main] Radial window destroyed')
  }
})

// Add a specific handler for Windows session end (e.g., shutdown/uninstall)
app.on('window-all-closed', () => {
  console.log('[Main] All windows closed')
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

function simulateCopy() {
  return new Promise<void>((resolve, reject) => {
    // 1. Try high-reliability PowerShell keybd_event script first
    let psPath = path.join(process.env.APP_ROOT, 'electron', 'send-keys.ps1')
    if (app.isPackaged) {
      psPath = psPath.replace('app.asar', 'app.asar.unpacked')
    }

    if (fs.existsSync(psPath)) {
      const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psPath, '-action', 'copy'])
      child.on('close', (code) => {
        if (code === 0) return resolve()
        fallbackVbs()
      })
      child.on('error', () => fallbackVbs())
      setTimeout(() => {
        try { child.kill() } catch (e) {}
        fallbackVbs()
      }, 1500)
      return
    }

    fallbackVbs()

    function fallbackVbs() {
      let vbsPath = path.join(process.env.VITE_PUBLIC, 'copy.vbs')
      if (app.isPackaged) {
        vbsPath = vbsPath.replace('app.asar', 'app.asar.unpacked')
      }

      const vbsChild = spawn('cscript', ['//Nologo', vbsPath])
      vbsChild.on('error', (err) => reject(err))
      vbsChild.on('close', (code) => {
        if (code === 0) resolve()
        else reject(new Error(`Copy script exited with code ${code}`))
      })
      setTimeout(() => {
        try { vbsChild.kill() } catch (e) {}
        reject(new Error('Copy simulation timed out'))
      }, 2000)
    }
  })
}

function simulatePaste() {
  let psPath = path.join(process.env.APP_ROOT, 'electron', 'send-keys.ps1')
  if (app.isPackaged) {
    psPath = psPath.replace('app.asar', 'app.asar.unpacked')
  }

  if (fs.existsSync(psPath)) {
    const child = spawn('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psPath, '-action', 'paste'])
    child.on('error', () => fallbackVbs())
    return
  }

  fallbackVbs()

  function fallbackVbs() {
    let vbsPath = path.join(process.env.VITE_PUBLIC, 'paste.vbs')
    if (app.isPackaged) {
      vbsPath = vbsPath.replace('app.asar', 'app.asar.unpacked')
    }

    const child = spawn('cscript', ['//Nologo', vbsPath])
    child.on('error', (err) => {
      console.error(`[Main] Failed to start paste script: ${err.message}`)
    })
  }
}

// Add cleanup function for uninstallation
async function cleanupOnUninstall() {
  console.log('[Main] Performing cleanup for uninstallation...')

  try {
    // Unregister all global shortcuts
    globalShortcut.unregisterAll();
    console.log('[Main] All global shortcuts unregistered')

    // Close all windows gracefully
    if (win) {
      win.destroy();
      console.log('[Main] Main window destroyed')
    }

    if (chatWin) {
      chatWin.destroy();
      console.log('[Main] Chat window destroyed')
    }

    if (loadingWin) {
      loadingWin.destroy();
      console.log('[Main] Loading window destroyed')
    }

    // Clean up any temporary files or data
    // This would typically involve removing app data directories
    console.log('[Main] Cleanup completed')
  } catch (error) {
    console.error('[Main] Error during cleanup:', error)
  }
}

// IPC handler for cleanup request
ipcMain.on('request-cleanup', async () => {
  console.log('[Main] Cleanup request received')
  await cleanupOnUninstall();
});
