'use strict';
// Remembered login password, encrypted with the operating system's user-account
// encryption (Windows DPAPI via Electron's safeStorage). It is only ever written to disk
// encrypted, in its own file, never in the settings/profile files. If the system can't
// encrypt, nothing is stored.
const fs = require('fs');
const path = require('path');
const { safeStorage } = require('electron');

class Secrets {
  constructor(dataDir, log) {
    this.file = path.join(dataDir, 'login-password.bin');
    this.log = log;
  }

  available() {
    try {
      return safeStorage.isEncryptionAvailable();
    } catch {
      return false;
    }
  }

  getPassword() {
    if (!this.available()) return '';
    try {
      return safeStorage.decryptString(fs.readFileSync(this.file));
    } catch {
      return '';
    }
  }

  setPassword(pass) {
    if (!pass) return this.clear();
    if (!this.available()) {
      this.log.warn('Password not remembered: system encryption is not available');
      return false;
    }
    fs.writeFileSync(this.file, safeStorage.encryptString(String(pass)));
    return true;
  }

  clear() {
    try {
      fs.unlinkSync(this.file);
    } catch { /* nothing stored */ }
    return true;
  }
}

module.exports = { Secrets };
