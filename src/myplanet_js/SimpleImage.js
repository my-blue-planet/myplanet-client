// @ts-ignore
SimpleImage = createLib();
// @ts-ignore
function createLib() {
    let id = 0;
    let images = [];
    const getCountry = async (long, lat) => {
        const signal = 'getcountry' + Date.now();
        show({ 'command': "getCountry", 'value': [long, lat], 'readysignal': signal, 'id': 0 });
        return await asyncWaitFor(signal);
    };
    const asyncWaitFor = async (signal) => {
        let answer = waitFor(signal);
        while (!answer) {
            await new Promise(r => setTimeout(r, 200));
            answer = waitFor(signal);
        }
        return answer.payload;
    };
    class Base {
    }
    class Image {
        id;
        W;
        H;
        channels;
        channelkeys;
        constructor() {
            images.push(this);
            this.id = id++;
        }
        // private open(src: string) {
        // 	const payload = this.runCommand('open', src)
        // 	// @ts-ignore
        // 	this.afterOpening(payload)
        // }
        // create(W: number, H: number, color: [number, number, number] = [200,200,240]) {
        // 	const payload = this.runCommand('create', [W, H, color])
        // 	// @ts-ignore
        // 	this.afterOpening(payload)
        // }
        static async load(src) {
            const im = new Image();
            const payload = await im.runCommandAsync('open', src);
            im.afterOpening(payload);
            return im;
        }
        static async create(W, H, color = [200, 200, 240]) {
            const im = new Image();
            const payload = await im.runCommandAsync('create', [W, H, color]);
            im.afterOpening(payload);
            return im;
        }
        // static async createSync(W: number, H: number, color: [number, number, number] = [200,200,240]) {
        // 	const im = new Image()
        // 	const payload = im.runCommand('create', [W, H, color])
        // 	im.afterOpening(payload)
        // 	return im
        // }
        afterOpening(payload) {
            this.W = payload['W'];
            this.H = payload['H'];
            this.channels = payload['channels'];
            this.channelkeys = payload['channels'].map(c => `${this.id}_${c}`);
        }
        getId() { return this.id; }
        async imageWaitFor(signal) {
            return asyncWaitFor(signal);
        }
        // imageWaitForSync(signal: string) {
        // 	let answer = waitFor(signal)
        // 	let i = 0
        // 	while(!answer) {
        // 		if(i++ % 1e6 === 0) {
        // 			console.log(i);
        // 		}
        // 		answer = waitFor(signal)
        // 	}
        // 	return answer.payload
        // }
        // runCommand(command: string, value: unknown) {
        // 	const signal = 'image'+command+Date.now()
        // 	show({'command': command, 'value': value, 'readysignal': signal, 'id': this.id})
        // 	return this.imageWaitForSync(signal)
        // }
        async runCommandAsync(command, value) {
            const signal = 'image' + command + Date.now();
            show({ 'command': command, 'value': value, 'readysignal': signal, 'id': this.id });
            return await this.imageWaitFor(signal);
        }
        // runCommandImmediate(command: string, value: unknown) {
        // 	const signal = false
        // 	show({'command': command, 'value': value, 'readysignal': signal, 'id': this.id})
        // }
        writePos(channel, pos, val) {
            if (Math.random() < 0.0002)
                console.log(`${this.getId()}_${channel}`);
            return writeShared(`${this.getId()}_${channel}`, pos, val);
        }
        readPos(channel, pos) {
            return readShared(`${this.getId()}_${channel}`, pos);
        }
        getWidth() { return this.W; }
        getHeight() { return this.H; }
        getDimensions() { return [this.W, this.H]; }
        getPixel(x, y) {
            return new Pixel(this, x, y);
        }
        getPixels() {
            let x = 0;
            let y = 0;
            let img = this;
            return {
                [Symbol.iterator]() { return this; },
                next() {
                    if (y < img.H) {
                        const p = new Pixel(img, x, y);
                        x = (x + 1) % img.W;
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
        setChannelAt(channel, x, y, val) {
            const pos = x + y * this.getWidth();
            return this.writePos(channel, pos, val);
        }
        setColorAt(x, y, color) {
            const pos = x + y * this.getWidth();
            for (let i = 0; i < color.length; i++) {
                this.writePos(this.channels[i], pos, color[i]);
            }
        }
        getChannelAt(channel, x, y) {
            const pos = x + y * this.getWidth();
            return this.readPos(channel, pos);
        }
        getColorAt(x, y) {
            const pos = x + y * this.getWidth();
            return this.channelkeys.map(k => readShared(k, pos));
        }
    }
    class Series {
    }
    class Channel {
        constructor() { }
    }
    class Pixel {
        img;
        x;
        y;
        p;
        constructor(img, x, y) {
            this.img = img;
            this.x = x;
            this.y = y;
            this.p = x + y * img.getWidth();
        }
        setChannel(channel, value) {
            return this.img.setChannelAt(channel, this.x, this.y, value);
        }
        getChannel(channel) {
            return this.img.getChannelAt(channel, this.x, this.y);
        }
        toString() {
            return `Pixel(${this.x}, ${this.y}): {}`;
        }
    }
    return { Image, Channel, Series, getCountry };
}
// def getNeighbors(self):
// neighbors = []
// x = self.x
// y = self.y
// H = self.img.getHeight()
// W = self.img.getWidth()
// if y > 0:
// neighbors.append(self.img.getPixel(x, y-1))
// if y < H-1:
// neighbors.append(self.img.getPixel(x, y+1))
// if x > 0:
// neighbors.append(self.img.getPixel(x-1, y))
// if x < W-1:
// neighbors.append(self.img.getPixel(x+1, y))
// return neighbors
//
// #alias
// def getNeighbours(self):
// return self.getNeighbors()
