'use strict';
// ConfigManager with profiles, after RuneLite's: every setting is "group.key" -> value,
// stored per profile. One profile is active at a time; switching swaps the whole set.
//
// <user data>/profiles/profiles.json   { active: id, list: [{ id, name }] }
// <user data>/profiles/<id>.json       the settings of that profile
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class ConfigManager {
  constructor(dataDir) {
    this.dir = path.join(dataDir, 'profiles');
    this.index = path.join(this.dir, 'profiles.json');
    this.listeners = new Set();
    this.profileListeners = new Set();
    fs.mkdirSync(this.dir, { recursive: true });
    this.meta = this.readJson(this.index, null);
    if (!this.meta || !Array.isArray(this.meta.list) || !this.meta.list.length) {
      // First run, or upgrading from 0.2.0's single settings.json
      const legacy = this.readJson(path.join(dataDir, 'settings.json'), {});
      const id = this.newId();
      this.meta = { active: id, list: [{ id, name: 'Default' }] };
      this.writeJson(this.profileFile(id), legacy);
      this.writeJson(this.index, this.meta);
    }
    if (!this.meta.list.some((p) => p.id === this.meta.active)) this.meta.active = this.meta.list[0].id;
    this.values = this.readJson(this.profileFile(this.meta.active), {});
  }

  newId() {
    return crypto.randomBytes(6).toString('hex');
  }

  profileFile(id) {
    return path.join(this.dir, `${id}.json`);
  }

  readJson(file, fallback) {
    try {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
      return fallback;
    }
  }

  writeJson(file, data) {
    fs.writeFileSync(file + '.tmp', JSON.stringify(data, null, 2));
    fs.renameSync(file + '.tmp', file);
  }

  // ---- values

  get(group, key, fallback) {
    const v = this.values[`${group}.${key}`];
    return v === undefined ? fallback : v;
  }

  set(group, key, value) {
    const k = `${group}.${key}`;
    if (this.values[k] === value) return;
    if (value === undefined || value === null) delete this.values[k];
    else this.values[k] = value;
    this.scheduleSave();
    for (const l of this.listeners) l({ group, key, value: this.values[k] });
  }

  unset(group, key) {
    this.set(group, key, undefined);
  }

  all() {
    return { ...this.values };
  }

  onChange(fn) {
    this.listeners.add(fn);
  }

  onProfileSwitch(fn) {
    this.profileListeners.add(fn);
  }

  scheduleSave() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.save(), 300);
  }

  save() {
    clearTimeout(this.timer);
    this.writeJson(this.profileFile(this.meta.active), this.values);
    this.writeJson(this.index, this.meta);
  }

  // ---- profiles

  profiles() {
    return { active: this.meta.active, list: this.meta.list.map((p) => ({ ...p })) };
  }

  createProfile(name, copyFrom) {
    const id = this.newId();
    const values = copyFrom ? this.readJson(this.profileFile(copyFrom), {}) : {};
    if (copyFrom === this.meta.active) Object.assign(values, this.values);
    this.writeJson(this.profileFile(id), values);
    this.meta.list.push({ id, name: this.uniqueName(name) });
    this.writeJson(this.index, this.meta);
    return id;
  }

  renameProfile(id, name) {
    const p = this.meta.list.find((x) => x.id === id);
    if (!p || !name || !name.trim()) return;
    p.name = this.uniqueName(name.trim(), id);
    this.writeJson(this.index, this.meta);
  }

  deleteProfile(id) {
    if (id === this.meta.active || this.meta.list.length <= 1) return false;
    this.meta.list = this.meta.list.filter((p) => p.id !== id);
    try { fs.unlinkSync(this.profileFile(id)); } catch { /* already gone */ }
    this.writeJson(this.index, this.meta);
    return true;
  }

  switchProfile(id) {
    if (id === this.meta.active || !this.meta.list.some((p) => p.id === id)) return;
    this.save();
    const before = this.values;
    this.meta.active = id;
    this.values = this.readJson(this.profileFile(id), {});
    this.writeJson(this.index, this.meta);
    for (const l of this.profileListeners) l(id);
    // Tell listeners about every key whose value changed.
    const keys = new Set([...Object.keys(before), ...Object.keys(this.values)]);
    for (const k of keys) {
      if (before[k] === this.values[k]) continue;
      const i = k.indexOf('.');
      for (const l of this.listeners) l({ group: k.slice(0, i), key: k.slice(i + 1), value: this.values[k] });
    }
  }

  uniqueName(name, exceptId) {
    let n = name;
    let i = 2;
    while (this.meta.list.some((p) => p.name === n && p.id !== exceptId)) n = `${name} (${i++})`;
    return n;
  }
}

module.exports = { ConfigManager };
