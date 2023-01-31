import {Colorscale, Tscale} from "./Colorscales";
import {unzlibSync, zlibSync} from "fflate";
import type SceneManager from "./SceneManager";
import {Mercator} from "./Mercator";

export interface IDisplayObjSized {
	get W(): number
	get H(): number
}

interface IDisplayObjLoc {
	get worldCoords(): [number, number]
	get zoomLevel(): number
}

interface IDisplayObj extends IDisplayObjSized, IDisplayObjLoc {}

interface ICollection extends IDisplayObj {
	scenes: IScene[]
}

interface IScene extends IDisplayObj {
	channels: ChannelRecord
	sceneId: number
	combineVisiblesToImgdata(): ImageData
}

export type ChannelName = "r" | "g" | "b" | "a" | "country" | "elevation" | "pop" | "night" | "nox"
//type Scene = Partial<Record<ChannelName, Channel<1|4>>>

export type ChannelRecord = Partial<Record<ChannelName, IChannel>>
export interface ICutBounds {top: number, left: number, bottom: number, right: number}

const uint8ToBase64 = (arr: Uint8Array): string => window.btoa(Array(arr.length).fill('').map((_, i) => String.fromCharCode(arr[i])).join(''));
const base64ToUint8 = (str: string): Uint8Array => Uint8Array.from(window.atob(str), (c) => c.charCodeAt(0));

export abstract class DisplayObj implements IDisplayObj {
	_worldCoords: [number, number]
	_W: number
	_H: number
	_zoomLevel: number
	protected constructor(worldCoords?: [number, number], W?: number, H?: number, zoomLevel?: number) {
		this._worldCoords = worldCoords || [0,0]
		this._W = W || 0
		this._H = H || 0
		this._zoomLevel = zoomLevel || 0
	}
	get W() {return this._W}
	get H() {return this._H}
	get worldCoords() {return this._worldCoords};
	get zoomLevel() {return this._zoomLevel}
	getLongLat(px: number, py: number) {
		return Mercator.worldPixelToPosition([this._worldCoords[0] + px, this._worldCoords[1] + py], this._zoomLevel)
	}
}

export function compositeToImageData(r: IChannel, g: IChannel, b: IChannel, a?: IChannel) {
	const {W, H} = r!
	// @ts-ignore
	const cvs = new OffscreenCanvas(W, H) as HTMLCanvasElement
	const ctx = cvs.getContext("2d")!
	const idata = ctx.getImageData(0,0,W,H)
	for(let i = 0; i < W*H; i++) {
		idata.data[i*4] = r!.view[i]
		idata.data[i*4+1] = g!.view[i]
		idata.data[i*4+2] = b!.view[i]
		idata.data[i*4+3] = a ? a.view[i] : 255
	}
	return idata
}

export class Scene extends DisplayObj implements IScene {
	channels: ChannelRecord
	sceneId: number
	collectionId?: number
	label: string
	static sceneIds = 0
	constructor(worldCoords: [number, number], W: number, H: number, zoomLevel: number, sceneId: number, label = "") {
		super(worldCoords, W, H, zoomLevel)
		this.sceneId = sceneId
		this.label = label
		this.channels = {}
	}
	addChannel(channel: IChannel) {
		channel.scene = this
		this.channels[channel.name] = channel
	}
	hasRGB() {
		return this.channels.r && this.channels.g && this.channels.b
	}
	combineVisiblesToImgdata() {
		const {r, g, b} = this.channels
		return compositeToImageData(r!, g!, b!)
	}
	serialize() {
		const data: any = {
			worldCoords: this.worldCoords,
			W: this.W,
			H: this.H,
			zoomLevel: this.zoomLevel,
			channels: {}
		}
		Object.keys(this.channels).forEach((c)=>data.channels[c as ChannelName] = this.channels[c as ChannelName]!.serialize())
		if(this.label) data.label = this.label
		return data
	}
	static fromSerialized(serialized: any, sceneId: number) {
		const {worldCoords, W, H, zoomLevel, channels, label = ""} = serialized
		const scene = new Scene(worldCoords, W, H, zoomLevel, sceneId, label)
		Object.values(channels).forEach((c)=> {
			const channel = Channel.deserialize(c)
			if(channel.name === "elevation") channel.smoothen(2*Math.round(0.005*zoomLevel**3)+1)
			scene.addChannel(channel)
		})
		return scene
	}
	createComposite(compositeName: string, channelNames: [ChannelName, ChannelName, ChannelName] | [ChannelName, ChannelName, ChannelName, ChannelName]) {
		const [r, g, b, a=null] = channelNames.map(cn=>this.channels[cn])
		if(r && g && b) {
			return new CanvasProxy(this, a ? [r, g, b, a] : [r, g, b], compositeName)
		}
		throw new Error("channels not found")
	}
	renderVIS() {
		return this.createComposite("VIS", ["r", "g", "b", "a"])
	}
	initCanvies(): ICanvasProxy[] {
		return (this.hasRGB() ? [this.renderVIS()] : []).concat(this.renderChannels())
	}
	renderChannels() {
		return Object.values(this.channels).map((channel)=>{
			return new CanvasProxy(this, [channel])
		})
	}
	cut(cutBounds: ICutBounds) {
		const {top, left, bottom, right} = cutBounds
		const xleft = this.worldCoords[0] + left
		const ytop = this.worldCoords[1] + top
		const channels = Object.values(this.channels).map((channel)=>channel.cut(cutBounds))
		const {W, H} = channels[0]
		const copy = new Scene([xleft, ytop], W, H, this.zoomLevel, 100000+this.sceneId)
		channels.forEach(c=>copy.addChannel(c))
		return copy
	}
}

class DummyScene extends Scene {
	constructor() {super([0,0], 0,0,0,-1,"dummy")}
}

export class Overlay extends Scene {
	baseScene: Scene
	constructor(scene: Scene, overlayId: number) {
		super(scene.worldCoords, scene.W, scene.H, scene.zoomLevel, overlayId);
		this.baseScene = scene
		this.initChannels()
	}
	initChannels() {
		for(let cn of ["r", "g", "b", "a"] as ChannelName[]) {
			const {W, H} = this.baseScene
			const channel = new ByteChannel(cn, W, H, new Array(W*H).fill(0))
			this.addChannel(channel)
		}
	}
}

export class Collection extends DisplayObj implements ICollection {
	scenes: Scene[]
	collectionId: number
	label: string
	constructor(worldCoords: [number, number], W: number, H: number, zoomLevel: number, collectionId: number) {
		super(worldCoords, W, H, zoomLevel)
		this.collectionId = collectionId
		this.label = ""
		this.scenes = []
	}
	addScene(scene: Scene) {
		this.scenes.push(scene)
	}
	serialize() {
		const data: any = {
			worldCoords: this.worldCoords,
			W: this.W,
			H: this.H,
			zoomLevel: this.zoomLevel,
			scenes: this.scenes.map(scene=>scene.serialize())
		}
		return data
	}
	static fromSerialized(serialized: any, collectionId: number, scm: SceneManager) {
		const {worldCoords, W, H, zoomLevel, scenes} = serialized
		const collection = new Collection(worldCoords, W, H, zoomLevel, collectionId)
		collection.scenes	= scenes.map((s: any, i: number)=>Scene.fromSerialized(s, scm.nextSceneId++))
		return collection
	}
	getLabels() {return this.scenes.map(s=>s.label)}
}

export interface IChannel extends IDisplayObj {
	name: ChannelName
	bytes: number
	view: Uint8Array | Float32Array
	dirty: boolean
	get channelkey(): string
	toImageData(scale?: Tscale, min?: number, max?: number): ImageData
	serialize(): Object
	addAtBottomOf(other?: IChannel): IChannel
	addAtRightOf(other?: IChannel): IChannel
	smoothen(n: number): void
	cut(cutBounds: ICutBounds): IChannel
	scene: Scene
}

type Tbytes = 1 | 4
export abstract class Channel<T extends Tbytes> implements IChannel {
	W: number
	H: number
	name: ChannelName
	scene: Scene
	abstract bytes: T
	abstract view: T extends 1 ? Uint8Array : Float32Array
	dirty: boolean
	protected constructor(name: ChannelName, W: number, H: number) {
		this.W = W
		this.H = H
		this.name = name
		this.scene = new DummyScene()
		this.dirty = false
	}
	createView(data: number[]): T extends 1 ? Uint8Array : Float32Array {
		const sab = new SharedArrayBuffer(this.W * this.H * this.bytes)
		const view = this.bytes === 1 ? new Uint8Array(sab) : new Float32Array(sab)
		for(let i = 0; i < this.W*this.H; i++) {
			view[i] = data[i]
		}
		return view as T extends 1 ? Uint8Array : Float32Array
	}
	get worldCoords() {return this.scene.worldCoords}
	get zoomLevel() {return this.scene.zoomLevel}
	get channelkey() {return `${this.scene.sceneId}_${this.name}`}
	addAtRightOf(other?: Channel<T>): IChannel {
		const otherW = other?.W || 0
		const W = this.W + otherW
		let data: number[] = []
		for(let h = 0; h < this.H; h++) {
			for(let x = h*otherW; x < (h+1)*otherW; x++) {
				data.push(other?.view[x]!)
			}
			for(let x = h*this.W; x < (h+1)*this.W; x++) {
				data.push(this.view[x]!)
			}
			// for(let v of (other?.view || []).slice(h*otherW, (h+1)*otherW)) {
			//
			// }
			// for(let v of this.view.slice(h*this.W, (h+1)*this.W)) {
			// 	data.push(v)
			// }
		}
		return this instanceof ByteChannel ? new ByteChannel(this.name, W, this.H, data) : new FloatChannel(this.name, W, this.H, data)
	}
	addAtBottomOf(other?: Channel<T>) {
		const H = this.H + (other?.H || 0)
		let data: number[] = [...(other?.view || []), ...this.view]
		return this instanceof ByteChannel ? new ByteChannel(this.name, this.W, H, data) : new FloatChannel(this.name, this.W, H, data)
	}
	cut(cutBounds: ICutBounds) {
		let data: number[] = []
		const {top, left, bottom, right} = cutBounds
		for(let y = 0; y < this.H; y++) {
			for(let x = 0; x < this.W; x++) {
				if(x >= left && x < this.W - right && y >= top && y < this.H - bottom) {
					data.push(this.view[y*this.W + x])
				}
			}
		}
		const W = this.W - left - right
		const H = this.H - top - bottom
		return this instanceof ByteChannel ? new ByteChannel(this.name, W, H, data) : new FloatChannel(this.name, W, H, data)
	}
	toImageData(scale: Tscale = this.name, min=this.getMin(), max=this.getMax()) {
		// @ts-ignore
		const cvs = new OffscreenCanvas(this.W, this.H) as HTMLCanvasElement
		const ctx = cvs.getContext("2d")!
		const cs = new Colorscale(scale, min, max)

		const idata = ctx.getImageData(0,0,this.W,this.H)
		for(let i = 0; i < this.view.length; i++) {
			const [r, g, b] = cs.from(this.view[i])
			idata.data[i*4] = r
			idata.data[i*4+1] = g
			idata.data[i*4+2] = b
			idata.data[i*4+3] = 255
		}
		return idata
	}
	getMin() {
		let min = Infinity
		for(let i = 0; i < this.view.length; i++) {
			if(this.view[i] < min) min = this.view[i]
		}
		return min
	}
	getMax() {
		let max = -Infinity
		for(let i = 0; i < this.view.length; i++) {
			if(this.view[i] > max) max = this.view[i]
		}
		return max
	}
	serialize() {
		return {
			name: this.name,
			W: this.W,
			H: this.H,
			bytes: this.bytes,
			view: this.compressArrayBuffer(this.view)
		}
	}
	smoothen(n: number) {
		const fac = (n: number): number => (n <= 1) ? 1 : n * fac(n-1);
		const kernel = [...Array(n).keys()].map((k) => fac(n-1) / (fac(k) * fac(n-1-k)))
		const spread = Math.floor(n/2)
		let temp = new Float32Array(this.W * this.H);
		//debugger
		for(let y = 0; y < this.H; y++) {
			for(let x = 0; x < this.W; x++) {
				let v = 0
				let weights = 0
				let index = x + this.W * y
				for(let dx = -spread; dx <= spread; dx++) {
					if(x + dx >= 0 && x + dx < this.W) {
						const p = this.view[index + dx]
						v += kernel[spread + dx] * this.view[index + dx]
						weights += kernel[spread + dx]
					}
				}
				temp[index] = v / weights
			}
		}
		for(let x = 0; x < this.W; x++) {
			for(let y = 0; y < this.H; y++) {
				let v = 0
				let weights = 0
				let index = x + this.W * y
				for(let dy = -spread; dy <= spread; dy++) {
					if(y + dy >= 0 && y + dy < this.H) {
						v += kernel[spread + dy] * temp[index + dy * this.W]
						weights += kernel[spread + dy]
					}
				}
				//console.log(v, weights);
				this.view[index] = this.bytes === 1 ? Math.round(v / weights) : v / weights
			}
		}
	}
	static deserialize(serialized: any): IChannel {
		const {name, W, H, bytes, view} = serialized
		const buffer = Channel.decompressArrayBuffer(view).buffer
		const v = bytes === 1 ? new Uint8Array(buffer) : new Float32Array(buffer)
		return bytes === 1 ? new ByteChannel(name, W, H, [...v]) : new FloatChannel(name, W, H, [...v])
	}
	compressArrayBuffer(view: Uint8Array | Float32Array) {
		const view8 = new Uint8Array(view.buffer)
		const compressed = zlibSync(view8);
		return uint8ToBase64(compressed)
	}
	static decompressArrayBuffer(b64: string) {
		const compressed = base64ToUint8(b64)
		return unzlibSync(compressed)
	}
}

export class FloatChannel extends Channel<4> {
	bytes: 4
	view: Float32Array
	constructor(name: ChannelName, W: number, H: number, data: number[]) {
		super(name, W, H);
		this.bytes = 4
		this.view = this.createView(data)
	}
}

export class ByteChannel extends Channel<1> {
	bytes: 1
	view: Uint8Array
	constructor(name: ChannelName, W: number, H: number, data: number[]) {
		super(name, W, H);
		this.bytes = 1
		this.view = this.createView(data)
	}
}


interface CanvasAccess {
	canvas: HTMLCanvasElement
	get ctx(): CanvasRenderingContext2D
}

export interface ICanvasProxy extends CanvasAccess, IDisplayObjSized {
	active: boolean;
	channelDependencies: IChannel[]
	name: string
	scene: Scene
	isOverlay(): boolean
	isCollectionPart(): boolean
	setActive(active: boolean): void
	render(): void
	containsPoint(x: number, y: number): boolean
	get key(): string
}

type ChannelDependencies = [IChannel] | [IChannel, IChannel, IChannel] | [IChannel, IChannel, IChannel, IChannel]
export class CanvasProxy implements ICanvasProxy {
	channelDependencies: ChannelDependencies
	name: string
	scene: Scene
	canvas: HTMLCanvasElement
	active: boolean
	constructor(scene: Scene, channelDependencies: ChannelDependencies, name?: string, pixelated = false) {
		this.channelDependencies = channelDependencies
		this.active = false
		this.scene = scene
		this.name = name || this.firstChannel.name
		this.canvas = this.createCanvas(pixelated)
		this.ctx.imageSmoothingEnabled = false;
		this.render()
	}
	setActive(active: boolean) {
		this.active = active
		this.canvas.classList.toggle("active", active)
	}
	isOverlay(scene = this.scene): scene is Overlay {
		return this.scene instanceof Overlay
	}
	isCollectionPart(scene = this.scene) {
		return this.scene.collectionId !== undefined
	}
	createCanvas(pixelated: boolean) {
		const canvas = document.createElement("canvas")
		Object.assign(canvas.dataset, {key: this.key, sceneId: this.scene.sceneId})
		canvas.classList.add(`c_${this.key}`)
		if(pixelated) canvas.classList.add("pixelated")
		if(this.isOverlay(this.scene)) {
			canvas.classList.add("overlay")
			canvas.dataset.baseSceneId = String(this.scene.baseScene.sceneId)
		}
		canvas.width = this.W
		canvas.height = this.H
		return canvas
	}
	get W() {return this.scene.W}
	get H() {return this.scene.H}
	get ctx() {return this.canvas.getContext("2d")!}
	get key() {return `${this.scene.sceneId}_${this.name}`}
	get firstChannel() {return this.channelDependencies[0]}
	prepare() {
		const cdeps = this.channelDependencies
		return cdeps.length === 1 ? this.firstChannel.toImageData() : cdeps.length === 3 ? compositeToImageData(cdeps[0], cdeps[1], cdeps[2]) : compositeToImageData(...cdeps)
	}
	containsPoint(x: number, y: number) {
		const rect = this.canvas.getBoundingClientRect()
		return x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom
	}
	render() {
		this.ctx.putImageData(this.prepare(), 0, 0)
	}
}
