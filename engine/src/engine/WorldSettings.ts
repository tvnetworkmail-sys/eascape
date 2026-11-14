import fs from 'fs';
import path from 'path';

import Environment from '#/util/Environment.js';

// EASCape: world-wide settings staff change in game, kept in data/players/<profile>/world_settings.json
// so they survive restarts (ported from 2007scape's WorldSettings2007).
// christmas: Christmas mode (staff ::christmas on|off, ClientCheatHandler), a non-authentic seasonal
// extra, off by default. Every client is told through the varp christmas_mode and draws falling snow
// and snowy ground (webclient Christmas.ts); scripts read it with map_christmas / ~christmas_active
// (the decorated trees, content/scripts/christmas).
interface Settings {
    christmas: boolean;
}

export default class WorldSettings {
    private static settings: Settings | null = null;

    private static get file(): string {
        return path.join('data', 'players', Environment.NODE_PROFILE, 'world_settings.json');
    }

    private static get(): Settings {
        if (!this.settings) {
            this.settings = { christmas: false };
            try {
                if (fs.existsSync(this.file)) {
                    const raw = JSON.parse(fs.readFileSync(this.file, 'utf8')) as Partial<Settings>;
                    this.settings.christmas = raw.christmas === true;
                }
            } catch (err) {
                console.error('world_settings.json:', err);
            }
        }
        return this.settings;
    }

    private static save(): void {
        try {
            fs.mkdirSync(path.dirname(this.file), { recursive: true });
            fs.writeFileSync(this.file, JSON.stringify(this.get(), null, 2));
        } catch (err) {
            console.error('world_settings.json:', err);
        }
    }

    static get christmas(): boolean {
        return this.get().christmas;
    }

    static set christmas(on: boolean) {
        this.get().christmas = on;
        this.save();
    }
}
