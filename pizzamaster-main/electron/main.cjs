const { app, BrowserWindow } = require('electron');

// Quirúrgico: reducir ruido de logs de Chromium/DevTools (p.ej. Autofill.enable) solo en modo DEVTOOLS
if (process.env.ELECTRON_DEVTOOLS === '1') {
  try {
    app.commandLine.appendSwitch('log-level', '3');
  } catch {}
}

const path = require('path');
const fs = require('fs');

function resolveRendererPath() {
  // Prefer bundled dist inside app.asar
  const asarPath = path.join(__dirname, '..', 'dist', 'index.html');
  if (fs.existsSync(asarPath)) return asarPath;
  // Fallback: if dist is unpacked or moved
  const alt1 = path.join(process.resourcesPath, 'app.asar', 'dist', 'index.html');
  if (fs.existsSync(alt1)) return alt1;
  const alt2 = path.join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'index.html');
  if (fs.existsSync(alt2)) return alt2;
  return asarPath;
}


function buildCsp({ isDev }) {
  const supabaseHosts = "https://*.supabase.co";
  const supabaseWss = "wss://*.supabase.co";

  const common = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "media-src 'self' data: blob:",
    "worker-src 'self' blob:",
  ];

  if (isDev) {
    return [
      ...common,
      "script-src 'self' 'unsafe-eval' 'unsafe-inline' http://localhost:* blob:",
      "script-src-elem 'self' 'unsafe-eval' 'unsafe-inline' http://localhost:* blob:",
      "connect-src 'self' http://localhost:* ws://localhost:* " + supabaseHosts + " " + supabaseWss,
    ].join('; ');
  }

  return [
    ...common,
    "script-src 'self' file: blob:",
    "connect-src 'self' " + supabaseHosts + " " + supabaseWss,
  ].join('; ');
}

function applyCsp(win, { isDev }) {
  const csp = buildCsp({ isDev });
  const filter = { urls: ['*://*/*', 'file://*/*'] };
  win.webContents.session.webRequest.onHeadersReceived(filter, (details, callback) => {
    const responseHeaders = details.responseHeaders || {};
    responseHeaders['Content-Security-Policy'] = [csp];
    callback({ responseHeaders });
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  const startUrl = process.env.ELECTRON_START_URL;
  const isDev = !!startUrl;
  applyCsp(win, { isDev });

  win.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error('[did-fail-load]', code, desc, url);
  });
  win.webContents.on('render-process-gone', (_e, details) => {
    console.error('[render-process-gone]', details);
  });

  if (process.env.ELECTRON_DEVTOOLS === '1') {
    win.webContents.openDevTools({ mode: 'detach' });
  }


  if (startUrl) win.loadURL(startUrl);
  else win.loadFile(resolveRendererPath());
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
