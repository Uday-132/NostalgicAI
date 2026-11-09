import { ipcRenderer, contextBridge } from 'electron'

console.log('Preload script loaded')

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(channel: string, listener: (...args: any[]) => void) {
    const subscription = (_event: any, ...args: any[]) => listener(_event, ...args)
    ipcRenderer.on(channel, subscription)
    return () => {
      ipcRenderer.removeListener(channel, subscription)
    }
  },
  off(channel: string, listener: (...args: any[]) => void) {
    ipcRenderer.removeListener(channel, listener)
  },
  send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    return ipcRenderer.send(channel, ...omit)
  },
  invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return ipcRenderer.invoke(channel, ...omit)
  },

  // You can expose other APTs you need here.
  // ...
})

// Expose API for hiding the chat window
contextBridge.exposeInMainWorld('api', {
  hideChatWindow: () => {
    ipcRenderer.send('hide-chat-window')
  }
})