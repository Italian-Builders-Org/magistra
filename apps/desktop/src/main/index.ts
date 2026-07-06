import { app, BrowserWindow, protocol, net, shell } from 'electron'
import { join, normalize, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

// In sviluppo electron-vite espone l'URL del dev server (con HMR) in questa
// variabile; in produzione non è impostata e il renderer è servito da `app://`.
const rendererDevUrl = process.env['ELECTRON_RENDERER_URL']
const isDev = !!rendererDevUrl

// Lo schema `app://` va dichiarato come privilegiato PRIMA che l'app sia pronta:
// è standard (URL assoluti/relativi risolti come sul web), sicuro (contesto
// come HTTPS) e supporta `fetch`. È il canale con cui il renderer viene
// caricato in locale, senza aprire alcuna porta.
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true }
  }
])

function createWindow(): void {
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true
    }
  })

  window.on('ready-to-show', () => window.show())

  // I link esterni si aprono nel browser di sistema, mai in una finestra
  // dell'app.
  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev) {
    window.loadURL(rendererDevUrl)
  } else {
    window.loadURL('app://local/index.html')
  }
}

// Serve il bundle statico del renderer via `app://`, con una guardia contro il
// path traversal fuori dalla cartella del renderer.
function registerAppProtocol(): void {
  const rendererRoot = join(__dirname, '../renderer')

  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url)
    const relativePath = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.slice(1))
    const filePath = normalize(join(rendererRoot, relativePath))

    if (filePath !== rendererRoot && !filePath.startsWith(rendererRoot + sep)) {
      return new Response('Not found', { status: 404 })
    }

    return net.fetch(pathToFileURL(filePath).toString())
  })
}

app.whenReady().then(() => {
  if (!isDev) {
    registerAppProtocol()
  }

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
