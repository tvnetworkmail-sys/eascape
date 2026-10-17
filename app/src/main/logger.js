'use strict';
// Writes the client log to <user data>/logs/client.log (and the console). The file rolls
// over to client.1.log at 5 MB, so there is always this session and some history.
const fs = require('fs');
const path = require('path');

const MAX_BYTES = 5 * 1024 * 1024;

class Logger {
  constructor(dir) {
    this.dir = path.join(dir, 'logs');
    this.file = path.join(this.dir, 'client.log');
    this.recent = [];
    this.listeners = new Set();
    fs.mkdirSync(this.dir, { recursive: true });
    try {
      if (fs.statSync(this.file).size > MAX_BYTES) {
        fs.renameSync(this.file, path.join(this.dir, 'client.1.log'));
      }
    } catch { /* no log yet */ }
    this.stream = fs.createWriteStream(this.file, { flags: 'a' });
    this.write('INFO', '----- EASCape starting -----');
  }

  write(level, msg) {
    const now = new Date();
    const line = `${now.toISOString()} ${level.padEnd(5)} ${msg}`;
    this.stream.write(line + '\n');
    if (level !== 'DEBUG') {
      const short = `${now.toLocaleTimeString()} ${msg}`;
      this.recent.push(short);
      if (this.recent.length > 200) this.recent.shift();
      for (const l of this.listeners) l(short);
    }
    (level === 'ERROR' ? console.error : console.log)(line);
  }

  info(msg) { this.write('INFO', msg); }
  warn(msg) { this.write('WARN', msg); }
  error(msg) { this.write('ERROR', msg); }
  debug(msg) { this.write('DEBUG', msg); }

  onLine(fn) {
    this.listeners.add(fn);
  }
}

module.exports = { Logger };
