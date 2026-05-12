import { app, BrowserWindow, shell } from 'electron'
import http, { type Server } from 'node:http'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

let apiServer: Server | undefined
let mainWindow: BrowserWindow | undefined

function getAppRoot(): string {
  return app.isPackaged ? app.getAppPath() : path.resolve(__dirname, '..')
}

async function startApiServer(): Promise<number> {
  const appRoot = getAppRoot()
  process.env.VIDEO_SUMMARY_DATA_DIR = path.join(app.getPath('userData'), '.data')
  process.env.VIDEO_SUMMARY_STATIC_DIR = path.join(appRoot, 'dist')

  const apiModuleUrl = pathToFileURL(path.join(__dirname, 'api', 'app.mjs')).href
  const { default: expressApp } = await import(apiModuleUrl)

  return new Promise((resolve, reject) => {
    const server = http.createServer(expressApp)
    apiServer = server

    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        reject(new Error('Unable to resolve Electron API server port'))
        return
      }
      resolve(address.port)
    })
  })
}

async function createMainWindow(): Promise<void> {
  const port = await startApiServer()

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 960,
    minHeight: 640,
    title: 'Video Summary Local',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  await mainWindow.loadURL(`http://127.0.0.1:${port}`)
}

app.whenReady().then(() => {
  void createMainWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) void createMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  apiServer?.close()
})
