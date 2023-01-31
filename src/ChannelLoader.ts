import {getCountryIndex, countryList} from "3e8-countryhelpers"
import {Mercator} from "./Mercator";
import {
	ByteChannel,
	ChannelName,
	ChannelRecord,
	Collection,
	FloatChannel,
	IChannel,
	ICutBounds,
	Scene
} from "./DisplayObjects";
import {uploadScene} from "./uploadScene";

export type TImageDescriptor = {id: string, timestamp: number, clouds?: number}

export type loadParams = {type: "vis" | "timelapsevis", year: number}
	| {type: "loadImage", id: string}
	| {type: "country" | "pop" | "nox" | "night"}
	| {type: "elevation", elevationMin?: number, elevationMax?: number}

export function getLoadChannel(type: TloadChannelName, params: Partial<LoadChannel> = {}): LoadChannel {
	return {name: type, selected: params.selected || true, ...{year: 2021}, ...params}
}

export type LoadChannel = {
	name: TloadChannelName
	selected: boolean
	year?: number
	manualRange?: boolean
	min?: number
	max?: number
}

export type TloadChannelName = "vis" | "elevation" | "country" | "pop" | "nox" | "night" //| "listImages"
export const loadChannelNames: TloadChannelName[] = ["vis", "elevation", "country", "pop", "nox", "night"]
export const loadChannels = loadChannelNames.map(lc=>getLoadChannel(lc))

export interface ChannelLoaderState {
	long: number,
	lat: number,
	zoomLevel: number,
	loadChannels: LoadChannel[]
	size: 256 | 512 | 768 | 1024 | 1280,
	cut: ICutBounds
}

const dev = false
const rootUrl = dev ?  `http://localhost:11300` : `https://myplanet.3e8.ch`

export class ChannelLoader {

	async cachedFetch(long: number, lat: number, zoomLevel: number, params: loadParams) {
		const {tileX, tileY} = Mercator.positionToTileXY([long, lat], zoomLevel)
		const key = `earthEngineLinks-${tileX}-${tileY}-${zoomLevel}-${JSON.stringify(params)}`
		if(localStorage[key]) {
			return JSON.parse(localStorage[key])
		}
		else {
			let fetchUrl = `${rootUrl}/${params.type}?long=${long}&lat=${lat}&zoomLevel=${zoomLevel}`
			if(params.type === "vis" || params.type === "timelapsevis") fetchUrl += `&year=${params.year}`
			if(params.type === "loadImage") fetchUrl += `&id=${params.id}`
			if(params.type === "elevation") fetchUrl += params.elevationMin !== undefined ? `&min=${params.elevationMin}` : ""
			if(params.type === "elevation") fetchUrl += params.elevationMax !== undefined ? `&max=${params.elevationMax}` : ""
			const data = await fetch(fetchUrl).then(r=>r.json())
			localStorage[key] = JSON.stringify(data)
			return data
		}
	}

	// async cachedFetchOld(long: number, lat: number, zoomLevel: number, params: loadParams) {
	// 	const {tileX, tileY} = Mercator.positionToTileXY([long, lat], zoomLevel)
	// 	const key = `earthEngineLinks-${tileX}-${tileY}-${zoomLevel}-${JSON.stringify(params)}`
	// 	if(localStorage[key]) {
	// 		return JSON.parse(localStorage[key])
	// 	}
	// 	else {
	// 		let fetchUrl = `${rootUrl}/${params.type}?long=${long}&lat=${lat}&zoomLevel=${zoomLevel}`
	// 		if(params.type === "vis" || params.type === "timelapsevis") fetchUrl += `&year=${params.year}`
	// 		if(params.type === "loadImage") fetchUrl += `&id=${params.id}`
	// 		const data = await fetch(fetchUrl).then(r=>r.json())
	// 		localStorage[key] = JSON.stringify(data)
	// 		return data
	// 	}
	// }

	async loadVis(long: number, lat: number, zoomLevel: number, year: number) {
		const {url} = await this.cachedFetch(long, lat, zoomLevel, {type: "vis", year})
		return this.getChannelsFromLink(url)
	}

	async loadTimelapseFrame(long: number, lat: number, zoomLevel: number, year: number) {
		const {url} = await this.cachedFetch(long, lat, zoomLevel, {type: "timelapsevis", year})
		return this.getChannelsFromLink(url)
	}

	async loadStandardChannel(long: number, lat: number, zoomLevel: number, loadChannel: "nox" | "night") {
		const {url} = await this.cachedFetch(long, lat, zoomLevel, {type: loadChannel})
		const channels = await this.getChannelsFromLink(url)
		return {[loadChannel]: new ByteChannel(loadChannel, 256, 256, [...channels.r.view])}
	}

	async loadElevation(long: number, lat: number, zoomLevel: number,  elevationRange: boolean, elevationMin?: number, elevationMax?: number) {
		const {url, min, max} = await this.cachedFetch(long, lat, zoomLevel, {type: "elevation", ...elevationRange && {elevationMin, elevationMax}})
		const channels = await this.getChannelsFromLink(url)
		const elevationData = []
		const delta = (max - min) / 256
		const step = 0.25  // = 2**14 / 256**2
		for(let [i, v] of channels.r.view.entries()) {
			if(v !== channels.g.view[i] || v !== channels.b.view[i]) {
				console.warn(`needs error correction: `, v, channels.g.view[i], channels.b.view[i])
			}
			elevationData.push(min + v * delta)
		}
		return {elevation: new FloatChannel("elevation", 256, 256, elevationData)}
	}

	async loadFloatChannel(long: number, lat: number, zoomLevel: number, type: "pop" | "night") {
		const {url} = await this.cachedFetch(long, lat, zoomLevel, {type})
		const channels = await this.getChannelsFromLink(url)
		const data = []
		for(let [i, v] of channels.r.view.entries()) {
			if(v !== channels.g.view[i] || v !== channels.b.view[i]) {
				console.warn(`needs error correction: `, v, channels.g.view[i], channels.b.view[i])
			}
			const n = type === "pop"
				? 1/512 * Math.exp(20 * v / 256)
				: (1/512 * Math.exp(12 * v / 256 + 5) * 2 * Math.PI * 10000 / 1000)  // 2 PI for sr, 10000 for cm2, /1000 for nano to micro
			data.push(n)
		}
		return {[type]: new FloatChannel(type, 256, 256, data)}
	}

	// async loadPopDensity(long: number, lat: number, zoomLevel: number) {
	// 	const {url} = await this.cachedFetch(long, lat, zoomLevel, {type: "pop"})
	// 	const channels = await this.getChannelsFromLink(url)
	// 	const popData = []
	// 	for(let [i, v] of channels.r.view.entries()) {
	// 		if(v !== channels.g.view[i] || v !== channels.b.view[i]) {
	// 			console.warn(`needs error correction: `, v, channels.g.view[i], channels.b.view[i])
	// 		}
	// 		popData.push(0.01 * Math.exp(20 * v / 256))
	// 	}
	// 	return {pop: new FloatChannel("pop", 256, 256, popData)}
	// }

	// async loadNightLights(long: number, lat: number, zoomLevel: number) {
	// 	const {url} = await this.cachedFetch(long, lat, zoomLevel, {type: "night"})
	// 	const channels = await this.getChannelsFromLink(url)
	// 	const data = []
	// 	for(let [i, v] of channels.r.view.entries()) {
	// 		if(v !== channels.g.view[i] || v !== channels.b.view[i]) {
	// 			console.warn(`needs error correction: `, v, channels.g.view[i], channels.b.view[i])
	// 		}
	// 		data.push(0.01 * Math.exp(20 * v / 256))
	// 	}
	// 	return {pop: new FloatChannel("pop", 256, 256, data)}
	// }

	async loadCountry(long: number, lat: number, zoomLevel: number) {
		const {tileX, tileY} = Mercator.positionToTileXY([long, lat], zoomLevel, 256)
		const [lx, ly] = Mercator.tileXYToWorldPixel(tileX, tileY, 256)
		//const [x, y] = Mercator.positionToWorldPixel([long, lat], zoomLevel, 256)
		const countryData = []
		for(let y = ly; y < ly + 256; y+=1) {
			for(let x = lx; x < lx + 256; x+=1) {
					const [long, lat] = Mercator.worldPixelToPosition([x, y], zoomLevel, 256)
					countryData.push(getCountryIndex(long, lat))
			}
			await new Promise((r)=>setTimeout(r, 0))
		}
		return {country: new ByteChannel("country", 256, 256, countryData)}
	}

	async listImages(long: number, lat: number, zoomLevel: number) {
		const r = await fetch(`${rootUrl}/listImages?long=${long}&lat=${lat}&zoomLevel=${zoomLevel}`)
		const d = await r.json() as TImageDescriptor[]
		return d
	}

	async loadImage(long: number, lat: number, zoomLevel: number, id: string) {
		const {url} = await this.cachedFetch(long, lat, zoomLevel, {type: "loadImage", id})
		return this.getChannelsFromLink(url)
	}

	async getChannelsFromLink(link: string) {
		const img = await this.fetchImg(link)
		// @ts-ignore
		const cvs = new OffscreenCanvas(256, 256) as HTMLCanvasElement
		const ctx = cvs.getContext("2d")!
		ctx.drawImage(img, 0, 0)
		return this.extractChannelsFromCtx(ctx)
	}

	async fetchImg(url: string): Promise<HTMLImageElement> {
		return new Promise((resolve, reject)=>{
			var img = new Image();
			img.setAttribute('crossOrigin', '')
			img.onload = () => resolve(img)
			img.onerror = reject
			img.src = url
		});
	}

	extractChannelsFromCtx(ctx: CanvasRenderingContext2D) {
		const W = ctx.canvas.width
		const H = ctx.canvas.height
		const imageData = ctx.getImageData(0,0,W,H)
		const data = Array.from(imageData.data)
		return {
			r: new ByteChannel("r", W, H, data.filter((el, pos)=> pos % 4 === 0)),
			g: new ByteChannel("g", W, H, data.filter((el, pos)=> pos % 4 === 1)),
			b: new ByteChannel("b", W, H, data.filter((el, pos)=> pos % 4 === 2)),
		}
	}

	async loadByType(channel: TloadChannelName, state: ChannelLoaderState, timelapseyear?: number) {
		const {long, lat, zoomLevel} = state
		const lc = state.loadChannels.find(l=>l.name === channel)!
		if(channel === "vis") return this.loadVis(long, lat, zoomLevel, lc.year || 2021)
		else if(channel === "elevation") return this.loadElevation(long, lat, zoomLevel, !!lc.manualRange, lc.min, lc.max)
		//else if(channel === "loadImage") return this.loadImage(pos[0], pos[1], zoomLevel, params.id)
		else if(channel === "country") return this.loadCountry(long, lat, zoomLevel)
		else if(channel === "pop") return this.loadFloatChannel(long, lat, zoomLevel, "pop")
		else if(channel === "night") return this.loadFloatChannel(long, lat, zoomLevel, "night")
		else if(["nox"].includes(channel)) return this.loadStandardChannel(long, lat, zoomLevel, channel)
		throw new Error("channel not found")
	}

	sceneToImageData(scene: Scene, params: loadParams) {
		const t = params.type
		if(t === "vis" || t === "loadImage") return scene.combineVisiblesToImgdata()
		else if(t === "elevation") return scene.channels.elevation!.toImageData("inferno")
		else return scene.channels.country!.toImageData("inferno")
	}

	findPositions(long: number, lat: number, zoomLevel: number, size = 256) {
		const D = 256
		const wTiles = size / D
		const hTiles = size / D
		const W = wTiles * D
		const H = hTiles * D
		const pos = [long, lat]
		const {tileX, tileY} = Mercator.positionToTileXY(pos, zoomLevel)
		const centerOfTile = Mercator.getCenterCoordsOfTile(tileX, tileY, zoomLevel)
		const startX = pos[0] > centerOfTile[0] ? Math.ceil(-0.5 * (wTiles - 1)) : Math.floor(-0.5 * (wTiles - 1))
		const startY = pos[1] > centerOfTile[1] ? Math.floor(-0.5 * (hTiles - 1)) : Math.ceil(-0.5 * (hTiles - 1))
		const [left, top] = Mercator.tileXYToWorldPixel(tileX + startX, tileY + startY)
		return {startX, startY, wTiles, hTiles, left, top, W, H, tileX, tileY}
	}

	async *load(state: ChannelLoaderState) {
		const {long, lat, zoomLevel, size, loadChannels, cut} = state
		// @ts-ignore
		// const canvas = new OffscreenCanvas(W, H) as HTMLCanvasElement
		// const ctx = canvas.getContext("2d")!
		const {startX, startY, wTiles, hTiles, left, top, W, H, tileX, tileY} = this.findPositions(long, lat, zoomLevel, size)
		const scene = new Scene([left, top], W, H, zoomLevel, 0)
		for(let loadChannel of loadChannels.filter(lc=>lc.selected)) {
			let channels: ChannelRecord = {}
			for(let dx = startX; dx < startX + wTiles; dx++) {
				const col: ChannelRecord = {}
				for(let dy = startY; dy < startY + hTiles; dy++) {
					const pos = Mercator.getCenterCoordsOfTile(tileX + dx, tileY + dy, zoomLevel)
					const tiledata: ChannelRecord = await this.loadByType(loadChannel.name, {...state, long: pos[0], lat: pos[1]})
					for(let c in tiledata) {
						col[c as ChannelName] = tiledata[c as ChannelName]?.addAtBottomOf(col[c as ChannelName])
					}
				}
				for(let c in col) {
					channels[c as ChannelName] = col[c as ChannelName]?.addAtRightOf(channels[c as ChannelName])
				}
			}
			Object.values(channels).forEach(c=>scene.addChannel(c))
			yield scene
		}
		//
		//
		// const imgdata = this.sceneToImageData(scene, params)
		// ctx.putImageData(imgdata, 0, 0)
		// return {scene, imgdata: ctx.getImageData(0,0,W, H)}
	}

	async *loadTimelapse(state: ChannelLoaderState) {
		const {long, lat, zoomLevel, size, loadChannels, cut} = {...state, size: 256} //forceSmall
		const {startX, startY, wTiles, hTiles, left, top, W, H, tileX, tileY} = this.findPositions(long, lat, zoomLevel, size)
		const collection = new Collection([left, top], W, H, zoomLevel, 0)
		for(let year = 1985; year <= 2022; year++) {
			let scene = new Scene([left, top], W, H, zoomLevel, 0, String(year))
			let channels: ChannelRecord = {}
			for(let dx = startX; dx < startX + wTiles; dx++) {
				const col: ChannelRecord = {}
				for(let dy = startY; dy < startY + hTiles; dy++) {
					const pos = Mercator.getCenterCoordsOfTile(tileX + dx, tileY + dy, zoomLevel)
					const tiledata: ChannelRecord = await this.loadTimelapseFrame(pos[0], pos[1], zoomLevel, year)
					for(let c in tiledata) {
						col[c as ChannelName] = tiledata[c as ChannelName]?.addAtBottomOf(col[c as ChannelName])
					}
				}
				for(let c in col) {
					channels[c as ChannelName] = col[c as ChannelName]?.addAtRightOf(channels[c as ChannelName])
				}
			}
			Object.values(channels).forEach(c=>scene.addChannel(c))
			collection.addScene(scene)
			yield collection
		}

		//
		//
		// const imgdata = this.sceneToImageData(scene, params)
		// ctx.putImageData(imgdata, 0, 0)
		// return {scene, imgdata: ctx.getImageData(0,0,W, H)}
	}

	async check(pos: [number, number], zoomLevel: number, sat: string) {
		const {tileX, tileY} = Mercator.positionToTileXY(pos, zoomLevel)
		const [long, lat] = Mercator.getCenterCoordsOfTile(tileX, tileY, zoomLevel)
		const key = `earthEngineLinks-${tileX}-${tileY}-${zoomLevel}-check-${sat}`
		if(localStorage[key]) {
			return JSON.parse(localStorage[key])
		}
		else {
			let fetchUrl = `${rootUrl}/check?long=${long}&lat=${lat}&zoomLevel=${zoomLevel}&sat=${sat}`
			const data = await fetch(fetchUrl).then(r=>r.json())
			localStorage[key] = JSON.stringify(data)
			return data
		}
	}

	async uploadScene(label: string, data: string) {
		return uploadScene(`${rootUrl}/saveScene`, label, data)
	}
}

