// @ts-ignore
SimpleImage = createLib()

declare var show: (payload: any)=>void
declare var waitFor: (signal: string) => { payload: any } | false
declare var writeShared: (name: string, index: number, value: number) => number
declare var readShared: (name: string, index: number) => number

// @ts-ignore
function createLib() {



	let id = 0
	let images = []

	const getCountry = async (long: number, lat: number) => {
		const signal = 'getcountry'+Date.now()
		show({'command': "getCountry", 'value': [long, lat], 'readysignal': signal, 'id': 0})
		return await asyncWaitFor(signal)
	}

	const asyncWaitFor = async (signal: string) => {
		let answer = waitFor(signal)
		while(!answer) {
			await new Promise(r=>setTimeout(r, 200))
			answer = waitFor(signal)
		}
		return answer.payload
	}

	class Base {

	}

	class Image {
		id: number
		W!: number
		H!: number
		channels!: string[]
		channelkeys!: string[]

		constructor() {
			images.push(this)
			this.id = id++
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

		static async load(src: string) {
			const im = new Image()
			const payload = await im.runCommandAsync('open', src)
			im.afterOpening(payload)
			return im
		}

		static async create(W: number, H: number, color: [number, number, number] = [200,200,240]) {
			const im = new Image()
			const payload = await im.runCommandAsync('create', [W, H, color])
			im.afterOpening(payload)
			return im
		}

		// static async createSync(W: number, H: number, color: [number, number, number] = [200,200,240]) {
		// 	const im = new Image()
		// 	const payload = im.runCommand('create', [W, H, color])
		// 	im.afterOpening(payload)
		// 	return im
		// }

		private afterOpening(payload: {W: number, H: number, channels: string[]}) {
			this.W = payload['W']
			this.H = payload['H']
			this.channels = payload['channels']
			this.channelkeys = payload['channels'].map(c=>`${this.id}_${c}`)
		}

		getId() {return this.id}

		async imageWaitFor(signal: string) {
			return asyncWaitFor(signal)
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

		async runCommandAsync(command: string, value: unknown) {
			const signal = 'image'+command+Date.now()
			show({'command': command, 'value': value, 'readysignal': signal, 'id': this.id})
			return await this.imageWaitFor(signal)
		}

		// runCommandImmediate(command: string, value: unknown) {
		// 	const signal = false
		// 	show({'command': command, 'value': value, 'readysignal': signal, 'id': this.id})
		// }

		private writePos(channel: string, pos: number, val: number) {
			if(Math.random()< 0.0002) console.log(`${this.getId()}_${channel}`);
			return writeShared(`${this.getId()}_${channel}`, pos, val)
		}

		private readPos(channel: string, pos: number,) {
			return readShared(`${this.getId()}_${channel}`, pos)
		}

		getWidth() {return this.W}
		getHeight() {return this.H}
		getDimensions() {return [this.W, this.H]}

		getPixel(x: number, y: number) {
			return new Pixel(this, x, y)
		}

		getPixels() {
			let x = 0;
			let y = 0;
			let img = this
			return {
				[Symbol.iterator]() {return this;},
				next() {
					if(y < img.H) {
						const p = new Pixel(img, x, y)
						x = (x+1) % img.W
						if(x===0) y++
						return { value: p, done: false };
					} else {
						return { done: true };
					}
				}
			}
		}

		setChannelAt(channel: string, x: number, y: number, val: number) {
			const pos = x + y * this.getWidth()
			return this.writePos(channel, pos, val)
		}

		setColorAt(x: number, y: number, color: number[]) {
			const pos = x + y * this.getWidth()
			for(let i = 0; i < color.length; i++) {
				this.writePos(this.channels[i], pos, color[i])
			}
		}


		getChannelAt(channel: string, x: number, y: number) {
			const pos = x + y * this.getWidth()
			return this.readPos(channel, pos)
		}


		getColorAt(x: number, y: number) {
			const pos = x + y * this.getWidth()
			return this.channelkeys.map(k=>readShared(k, pos))
		}

	}

	class Series {

	}

	class Channel {
		constructor() {}
	}

	class Pixel {
		img: Image
		x: number
		y: number
		p: number

		constructor(img: Image, x: number, y: number) {
			this.img = img
			this.x = x
			this.y = y
			this.p = x + y * img.getWidth()
		}

		setChannel(channel: string, value: number) {
			return this.img.setChannelAt(channel, this.x, this.y, value)
		}

		getChannel(channel: string) {
			return this.img.getChannelAt(channel, this.x, this.y)
		}

		toString() {
			return `Pixel(${this.x}, ${this.y}): {}`
		}


	}

	return {Image, Channel, Series, getCountry}
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

