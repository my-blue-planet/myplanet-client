import {
	Scene,
	Channel,
	IChannel,
	ChannelName,
	compositeToImageData,
	ByteChannel,
	Overlay, CanvasProxy, ICanvasProxy, Collection,
} from "./DisplayObjects";
import {IRunSubscriber} from "3e8-run-python-skulpt";

function htmlToElement(html: string) {
	var template = document.createElement('template');
	template.innerHTML = html.trim();
	return template.content.firstChild;
}

// @ts-ignore
// window.saveImg = function(e, el) {
//   let downloadLink = document.createElement('a');
//   downloadLink.setAttribute('download', `ice_${("0"+el.dataset.id).slice(-2)}.png`);
//   let dataURL = el.toDataURL('image/png');
//   let url = dataURL.replace(/^data:image\/png/,'data:application/octet-stream');
//   downloadLink.setAttribute('href', url);
//   downloadLink.click();
// }

interface SceneManagerProps {
	maxWidth?: number
	pixelated?: boolean
}

// interface IDim {
// 	W: number
// 	H: number
// }
//
// interface CanvasAccess {
// 	canvas: HTMLCanvasElement
// 	ctx: CanvasRenderingContext2D
// }
//
// export interface CanvasProxy extends CanvasAccess, IDim {
// 	channelDependencies: IChannel[]
// 	render(): ImageData
// 	name: string
// 	sceneId: number
// }

// export interface IRenderChannel extends IChannel {
// 	dirty: boolean
// 	sceneId: number
// }

type Color = [r: number, g: number, b: number, a?: number]
export type Command = "open" | "create" /*| "getCountry"  | "putPixelChannel" | "putPixelsChannel"*/


export default class SceneManager {
	wrapper: HTMLDivElement
	maxWidth: number
	pixelated: boolean
	drawAnimFrame?: number
	listener: ()=>void
	subscribers: IRunSubscriber
	dirtymarkers: Uint8Array
	scenes!: Scene[]
	collections!: Collection[]
	canvaslist!: ICanvasProxy[]
	channels!: IChannel[]
	nextSceneId!: number
	nextCollectionId!: number
	forceFrame!: Record<number, number>
	forceChannel!: Record<number, string>

	constructor(result: HTMLDivElement, listener: ()=>void, subscribers: IRunSubscriber, props: SceneManagerProps = {}) {
		if(!result) console.warn("no result!")
		this.wrapper = result
		this.maxWidth = props.maxWidth || Infinity
		this.pixelated = props.pixelated || false
		this.listener = listener
		this.subscribers = subscribers
		this.dirtymarkers = new Uint8Array(new SharedArrayBuffer(4096))
		this.reset()
	}
	reset() {
		this.wrapper.innerHTML = "";
		this.scenes = []
		this.collections = []
		this.canvaslist = []
		this.channels = []
		this.nextSceneId = 0
		this.nextCollectionId = 0
		this.forceFrame = {}
		this.forceChannel = {}
		this.cancelAnimFrame()
		this.draw()
		this.listener()
	}
	async autoLoadScene(templateCode: string) {
		this.reset()
		let m = templateCode.match(/(?:Image|Scene|Collection|Channel|load)\(["'](.*?\.json)["']\)/)
		let url = m && m[1] || ""
		if(url) {
			let sceneFound = await this.openScene(url, null)
			if(!sceneFound) {
				await this.openCollection(url, null)
			}
		}
	}
	show(details: {show: any}) {
		let {command, value, readysignal} = details.show;
		if(command === "addOverlay") {
			this.addOverlay(value, readysignal);
		}
		if(command === "addCollectionOverlay") {
			this.addCollectionOverlay(value, readysignal);
		}
		else if(command === "open") {
			this.openScene(value, readysignal)
		}
		else if(command === "openCollection") {
			this.openCollection(value, readysignal)
		}
		else if(command === "forceFrame") {
			this.addForceFrame(value, readysignal)
		}
		else if(command === "forceChannel") {
			this.addForceChannel(value, readysignal)
		}
	}
	getDownloadSource(url: string) {
		if (url.startsWith("http")) return "https://web.3e8.ch/corsproxy/?url=" + encodeURIComponent(url)
		else if (url.match(/.json$/)) return "/scenes/" + url;
		else return "/img/image/" + url
	}
	async openScene(url: string, readysignal: any) {
		const scene = await this.getScene(url, !!readysignal)
		if(!scene) return null
		this.initScene(scene, readysignal)
		return true
	}
	warnFileNotFound(url: string) {
		document.querySelector(".output")!.innerHTML += `<div class="error">File is not valid: ${url.split("/").at(-1)}</div>`
	}
	async getScene(url: string, warnIfNotExists = false) {
		const data = await this.fetchSceneOrCollection(url, warnIfNotExists)
		if(!data || "scenes" in data) return null
		const scene = Scene.fromSerialized(data, this.nextSceneId++)
		scene.label = url.match(/(\w+)\.json/)?.[1] || ""
		return scene
	}
	setupScene(scene: Scene) {
		if(this.channels.length === 0) this.subscribers?.addSharedArrayBuffer("dirtymarkers", this.dirtymarkers)
		this.scenes.push(scene)
		for(let newCanvas of scene.initCanvies()) {
			this.canvaslist.push(newCanvas)
			this.wrapper.appendChild(newCanvas.canvas)
		}
		for(let channel of Object.values(scene.channels)) {
			this.channels.push(channel)
			this.subscribers?.addSharedArrayBuffer(channel.channelkey, channel.view)
		}
	}
	initScene(scene: Scene, readysignal?: any) {
		this.setupScene(scene)
		this.listener()
		if (readysignal) {
			const {W, H, sceneId, worldCoords, zoomLevel} = scene
			this.subscribers.sendReadySignal(readysignal, {sceneId, W, H, worldCoords, zoomLevel, channels: Object.keys(scene.channels)});
		}
	}
	async fetchSceneOrCollection(url: string, warnIfnotExists = false) {
		const src = this.getDownloadSource(url);
		try {
			return await fetch(src).then(r=>r.json())
		}
		catch(e) {
			if(warnIfnotExists) {this.warnFileNotFound(url)}
			return null
		}
	}
	addOverlay([sceneId, label]: [sceneId: number, label: string], readysignal: any) {
		const baseScene = this.scenes.filter(s=>s.sceneId === sceneId).slice(-1)[0]!
		const overlay = new Overlay(baseScene, this.nextSceneId++)
		overlay.label = label
		this.initScene(overlay, readysignal)
	}
	addCollectionOverlay([collectionId, label]: [collectionId: number, label: string], readysignal: any) {
		const baseCollection = this.collections.filter(c=>c.collectionId === collectionId).slice(-1)[0]!
		const overlay = new Overlay(baseCollection.scenes[0], this.nextSceneId++)
		overlay.collectionId = collectionId
		overlay.label = label
		return this.initScene(overlay, readysignal)
	}
	async openCollection(url: string, readysignal: any) {
		const collection = await this.getCollection(url, true)
		if(!collection) return null
		return await this.initCollection(collection, readysignal)
	}
	async getCollection(url: string, warnIfNotExists = false) {
		const data = await this.fetchSceneOrCollection(url, warnIfNotExists)
		if(!data) return null
		const collection = Collection.fromSerialized(data, this.nextCollectionId++, this)
		collection.label = url.match(/(\w+)\.json/)?.[1] || ""
		this.collections.push(collection)
		return collection
	}
	async initCollection(collection: Collection, readysignal: any) {
		for(let s of collection.scenes) {
			this.setupScene(s)
			s.collectionId = collection.collectionId
			this.listener()
			await new Promise(r=>setTimeout(r, 0))
		}
		this.listener()
		if (readysignal) {
			const {W, H,  worldCoords, zoomLevel, scenes, collectionId} = collection
			const channels = scenes.map(s=>Object.keys(s.channels))
			const payload = {collectionId, W, H, worldCoords, zoomLevel, sceneIds: scenes.map(s=>s.sceneId), channels, labels: collection.getLabels()}
			this.subscribers.sendReadySignal(readysignal, payload);
		}
	}
	addForceFrame([collId, sceneId]: [collectionId: number, sceneId: number], readysignal: any) {
		this.forceFrame[collId] = sceneId
		this.listener()
		if (readysignal) {
			this.subscribers.sendReadySignal(readysignal, {});
		}
	}
	addForceChannel([sceneId, channelname]: [sceneId: number, channelname: string], readysignal: any) {
		this.forceChannel[sceneId] = channelname
		this.listener()
		if (readysignal) {
			this.subscribers.sendReadySignal(readysignal, {});
		}
	}
	markDirtyChannels() {
		this.channels.forEach((channel, index)=>{
			channel.dirty = this.dirtymarkers[index] === 1
			this.dirtymarkers[index] = 0
		})
	}
	renderCanvasesIfDirty() {
		this.canvaslist.forEach((c, i)=>{
			//console.log(c, i, c.channelDependencies);
			if(c.channelDependencies.some(c=>c.dirty)) {
				c.render()
			}
		})
	}
	draw(timestep = 0) {
		this.markDirtyChannels()
		this.renderCanvasesIfDirty()
		this.requestDraw(timestep + 1)
	}
	requestDraw(timestep = 0) {
		this.cancelAnimFrame()
		this.drawAnimFrame = requestAnimationFrame(_=>this.draw(timestep))
	}
	cancelAnimFrame() {
		cancelAnimationFrame(this.drawAnimFrame || 0);
	}
}