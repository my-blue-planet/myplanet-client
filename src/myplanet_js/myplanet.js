const channelAliases = {
    r: ["r", "R", "red", "rot"],
    g: ["g", "G", "green", "gruen", "grün"],
    b: ["b", "B", "blue", "blau"],
    a: ["a", "A", "alpha", "alpha"],
    elevation: ["h", "H", "elevation", "hoehe", "höhe"],
    country: ["c", "C", "country", "land"],
    pop: ["p", "P", "pop", "bev"],
    nox: ["n", "N", "nox", "NOx"],
    night: ["l", "L", "night", "nacht", "light", "nightlight", "licht"],
};
// @ts-ignore
myplanet = createMyplanetLib();
class MercatorWorker {
    static EarthRadius = 6378137;
    static metersPerPixel(latitude, zoomLevel) {
        return Math.cos(latitude * Math.PI / 180) * 2 * Math.PI * this.EarthRadius / this.getMapSize(zoomLevel);
    }
    static getMapSize(zoomLevel) {
        return Math.ceil(256 * Math.pow(2, zoomLevel));
    }
    static clip(n, minValue, maxValue) {
        return Math.min(Math.max(n, minValue), maxValue);
    }
    static worldPixelToPosition(px, py, zoomLevel) {
        var mapSize = this.getMapSize(zoomLevel);
        var x = (this.clip(px, 0, mapSize - 1) / mapSize) - 0.5;
        var y = 0.5 - (this.clip(py, 0, mapSize - 1) / mapSize);
        return [
            360 * x,
            90 - 360 * Math.atan(Math.exp(-y * 2 * Math.PI)) / Math.PI //Latitude
        ];
    }
}
function createMyplanetLib() {
    const asyncWaitFor = async (signal) => {
        let answer = waitFor(signal);
        while (!answer) {
            await new Promise(r => setTimeout(r, 200));
            answer = waitFor(signal);
        }
        return answer.payload;
    };
    let globalChannelkeys = [];
    class Messenger {
        async imageWaitFor(signal) {
            return asyncWaitFor(signal);
        }
        async runCommandAsync(command, value) {
            const signal = 'image' + command + Date.now();
            show({ 'command': command, 'value': value, 'readysignal': signal });
            return await this.imageWaitFor(signal);
        }
    }
    class LocatedMessenger extends Messenger {
        zoomLevel;
        worldCoords;
        W;
        H;
        getPosition(px, py) {
            return MercatorWorker.worldPixelToPosition(this.worldCoords[0] + px, this.worldCoords[1] + py, this.zoomLevel);
        }
        metersPerPixel(px, py) {
            return MercatorWorker.metersPerPixel(this.getPosition(px, py)[1], this.zoomLevel);
        }
    }
    class Scene extends LocatedMessenger {
        sceneId;
        channels;
        channelkeys;
        label;
        collectionId;
        didWarn;
        static async load(src) {
            const scene = new Scene();
            const payload = await scene.runCommandAsync('open', src);
            scene.afterOpening(payload);
            return scene;
        }
        static fromCollectionFrame(config) {
            const scene = new Scene();
            scene.afterOpening(config);
            return scene;
        }
        afterOpening(payload) {
            this.W = payload['W'];
            this.H = payload['H'];
            this.zoomLevel = payload['zoomLevel'];
            this.worldCoords = payload['worldCoords'];
            this.label = payload["label"] || "";
            this.sceneId = payload['sceneId'];
            this.channels = payload['channels'];
            this.channelkeys = payload['channels'].map(c => `${this.getId()}_${c}`);
            globalChannelkeys = globalChannelkeys.concat(this.channelkeys);
        }
        writePos(channel, pos, val) {
            const channelkey = `${this.getId()}_${channel}`;
            if (this.warnIfNotExists(channelkey))
                return;
            writeShared(channelkey, pos, val);
            //if read first performance is about the same
            return writeShared("dirtymarkers", globalChannelkeys.indexOf(channelkey), 1);
        }
        readPos(channel, pos) {
            const channelkey = `${this.getId()}_${channel}`;
            if (this.warnIfNotExists(channelkey))
                return;
            return readShared(channelkey, pos);
        }
        warnIfNotExists(channelkey) {
            const missingChannel = !globalChannelkeys.includes(channelkey);
            if (!this.didWarn && missingChannel) {
                this.didWarn = true;
                warn(`This scene does not include channel: ${channelkey.split("_")[1]}`);
            }
            return missingChannel;
        }
        async addOverlay(label = "") {
            const overlay = new Overlay();
            const payload = await overlay.runCommandAsync('addOverlay', [this.getId(), label]);
            overlay.afterOpening(payload);
            return overlay;
        }
        forceChannel(channelname) {
            return this.runCommandAsync('forceChannel', [this.getId(), channelname]);
        }
        contains(x, y) {
            return x >= 0 && x < this.W && y >= 0 && y < this.H;
        }
        getId() { return this.sceneId; }
        getWidth() { return this.W; }
        getHeight() { return this.H; }
        getDimensions() { return [this.W, this.H]; }
        getPixel(x, y) {
            return new Pixel(this, x, y);
        }
        getPixels() {
            let x = 0;
            let y = 0;
            let scene = this;
            return {
                [Symbol.iterator]() { return this; },
                next() {
                    if (y < scene.H) {
                        const p = new Pixel(scene, x, y);
                        x = (x + 1) % scene.W;
                        if (x === 0)
                            y++;
                        return { value: p, done: false };
                    }
                    else {
                        return { done: true };
                    }
                }
            };
        }
        get pixels() {
            return this.getPixels();
        }
        getPixelSize() {
            return this.metersPerPixel(this.worldCoords[0] + 0.5 * this.W, this.worldCoords[1] + 0.5 * this.H);
        }
        setChannelAt(channel, x, y, val) {
            const pos = x + y * this.getWidth();
            return this.writePos(channel, pos, val);
        }
        getChannelAt(channel, x, y) {
            const pos = x + y * this.getWidth();
            return this.readPos(channel, pos);
        }
    }
    class Overlay extends Scene {
        setChannelAt(channel, x, y, val) {
            const pos = x + y * this.getWidth();
            if (this.readPos("a", pos) === 0)
                this.writePos("a", pos, 255);
            return this.writePos(channel, pos, val);
        }
        setColorAt(x, y, color) {
            const pos = x + y * this.getWidth();
            if (this.readPos("a", pos) === 0)
                this.writePos("a", pos, 255);
            for (let i = 0; i < color.length; i++) {
                this.writePos(this.channels[i], pos, color[i]);
            }
        }
        addMarker(x, y) {
            const R = Math.round(Math.min(this.W, this.H) / 80);
            for (let dx = -2 * R; dx <= 2 * R; dx++) {
                for (let dy = -2 * R; dy <= 2 * R; dy++) {
                    if (this.contains(x + dx, y + dy)) {
                        const r = (dx ** 2 + dy ** 2) ** 0.5;
                        const dr = Math.abs(R - r);
                        if (dr < 0.3 * R) {
                            this.setChannelAt("r", x + dx, y + dy, 255);
                            this.setChannelAt("a", x + dx, y + dy, dr < 0.2 * R ? 255 : 255 - Math.round(255 * (dr - 0.2 * R) / (0.1 * R)));
                        }
                    }
                }
            }
        }
    }
    class Collection extends LocatedMessenger {
        collectionId;
        scenes;
        afterOpening(payload) {
            this.W = payload['W'];
            this.H = payload['H'];
            this.zoomLevel = payload['zoomLevel'];
            this.worldCoords = payload['worldCoords'];
            this.collectionId = payload['collectionId'];
            let sceneIds = payload["sceneIds"];
            this.scenes = sceneIds.map((sceneId, index) => {
                const scene = Scene.fromCollectionFrame({
                    "W": payload["W"],
                    "H": payload["H"],
                    "worldCoords": payload['worldCoords'],
                    "zoomLevel": payload['zoomLevel'],
                    sceneId,
                    "channels": payload["channels"][index],
                    "label": payload["labels"][index]
                });
                scene.collectionId = this.collectionId;
                return scene;
            });
        }
        static async load(src) {
            const collection = new Collection();
            const payload = await collection.runCommandAsync('openCollection', src);
            collection.afterOpening(payload);
            return collection;
        }
        async addOverlay(label = "") {
            const overlay = new Overlay();
            const payload = await overlay.runCommandAsync('addCollectionOverlay', [this.getId(), label]);
            overlay.afterOpening(payload);
            overlay.collectionId = this.getId();
            return overlay;
        }
        forceFrame(sceneOrLabel) {
            const scene = sceneOrLabel instanceof Scene ? sceneOrLabel : this.scenes.find(s => s.label === sceneOrLabel);
            this.runCommandAsync('forceFrame', [this.getId(), this.scenes.indexOf(scene)]);
        }
        getId() { return this.collectionId; }
        getScenes() { return this.scenes; }
    }
    class Pixel {
        scene;
        x;
        y;
        p;
        constructor(scene, x, y) {
            this.scene = scene;
            this.x = x;
            this.y = y;
            this.p = x + y * scene.getWidth();
        }
        setChannel(channel, value) {
            return this.scene.setChannelAt(channel, this.x, this.y, value);
        }
        getChannel(channel) {
            return this.scene.getChannelAt(channel, this.x, this.y);
        }
        getSizeInMeters() {
            return this.scene.metersPerPixel(this.x, this.y);
        }
        get size() {
            return this.getSizeInMeters();
        }
        getAreaInKm2() {
            return 0.000001 * this.size * this.size;
        }
        get people() {
            return (this.getChannel("pop") || 0) * this.getAreaInKm2();
        }
        getBrightness() {
            return (this.getChannel("r") + this.getChannel("g") + this.getChannel("b")) / 3;
        }
        get brightness() {
            return this.getBrightness();
        }
        toString() {
            const obj = Object.fromEntries(this.scene.channels.map(c => [c, this.scene.getChannelAt(c, this.x, this.y)]));
            return `Pixel(${this.x}, ${this.y}): ${JSON.stringify(obj)}`;
        }
        getNeighbours(includeDiagonal = false) {
            const addPixelIfExists = (list, x, y) => {
                if (this.scene.contains(x, y))
                    list.push(this.scene.getPixel(x, y));
            };
            const neighbours = [];
            let x = this.x;
            let y = this.y;
            addPixelIfExists(neighbours, x, y - 1);
            addPixelIfExists(neighbours, x, y + 1);
            addPixelIfExists(neighbours, x - 1, y);
            addPixelIfExists(neighbours, x + 1, y);
            if (includeDiagonal) {
                addPixelIfExists(neighbours, x - 1, y - 1);
                addPixelIfExists(neighbours, x - 1, y + 1);
                addPixelIfExists(neighbours, x + 1, y - 1);
                addPixelIfExists(neighbours, x + 1, y + 1);
            }
            return neighbours;
        }
        getNeighbors(includeDiagonal = false) {
            return this.getNeighbours(includeDiagonal);
        }
    }
    for (let channelAlias of Object.entries(channelAliases)) {
        const [name, aliases] = channelAlias;
        for (let alias of [...new Set(aliases)]) {
            Object.defineProperty(Pixel.prototype, alias, {
                get() { return this.getChannel(name); },
                set(val) { return this.setChannel(name, val); }
            });
        }
    }
    return { Scene, Pixel, Collection };
}
