'use strict';
// Auto-update from the GitHub Releases page (electron-updater). Only the installed
// version updates itself; the portable zip can't replace its own files.
//
// Updates are downloaded in the background and installed when you click "Restart to
// update" in the info panel, or automatically the next time LostLite closes.
const { app } = require('electron');

let autoUpdater = null;
let log = null;
let onStatus = () => {};

function init(opts) {
  log = opts.log;
  onStatus = opts.onStatus;
  if (!app.isPackaged) return;
  if (process.platform === 'win32' && !isInstalled()) {
    onStatus({ state: 'portable' });
    return;
  }
  try {
    ({ autoUpdater } = require('electron-updater'));
  } catch (e) {
    log.warn(`Updater unavailable: ${e.message}`);
    return;
  }
  autoUpdater.logger = { info: (m) => log.info(`Updater: ${m}`), warn: (m) => log.warn(`Updater: ${m}`), error: (m) => log.warn(`Updater: ${m}`), debug: () => {} };
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => onStatus({ state: 'checking' }));
  autoUpdater.on('update-not-available', () => onStatus({ state: 'current' }));
  autoUpdater.on('update-available', (i) => onStatus({ state: 'downloading', version: i.version, percent: 0 }));
  autoUpdater.on('download-progress', (p) => onStatus({ state: 'downloading', percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (i) => onStatus({ state: 'ready', version: i.version }));
  autoUpdater.on('error', (e) => onStatus({ state: 'error', message: String((e && e.message) || e).split('\n')[0] }));
  const check = () => autoUpdater.checkForUpdates().catch(() => {});
  check();
  setInterval(check, 60 * 60 * 1000);
}

/** The NSIS installer puts an uninstaller next to the exe; the portable zip has none. */
function isInstalled() {
  const fs = require('fs');
  const path = require('path');
  return fs.readdirSync(path.dirname(process.execPath)).some((f) => /^Uninstall .*\.exe$/i.test(f));
}

function install() {
  if (autoUpdater) autoUpdater.quitAndInstall(false, true);
}

module.exports = { init, install };
