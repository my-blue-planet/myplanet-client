import {Component, children, createSignal, JSX, on, onMount, Show, untrack, createEffect} from 'solid-js';
import {Layout} from "./Layout";
import {TaskControllerSolid, TaskControllerSolidProps} from "./TaskControllerSolid";
import SceneManager, {Command} from "./SceneManager";
import {IRunConfig} from "3e8-run-python-skulpt";
import {ISceneState} from "./MyplanetTask";
import {
  CanvasProxy,
  ChannelName,
  ChannelRecord,
  Collection,
  DisplayObj,
  ICanvasProxy,
  Overlay,
  Scene
} from './DisplayObjects';
import {Part} from "solid-js/store";
import {countryList} from "3e8-countryhelpers";
import { log } from 'console';

interface ResultControlProps {
  sceneState: ISceneState,
  children?: JSX.Element
  //sceneManager: SceneManager
}

type IPixelviewer = {
  ownChannels: Partial<Record<ChannelName,number>>
  overlayChannels: Partial<Record<ChannelName,number>>[]
  x: number,
  y: number,
  longLat: [number, number]
  style: string
}

type EventSelect = Event & {currentTarget: HTMLSelectElement}


const MyplanetTaskResultControl: Component<ResultControlProps> = (props: ResultControlProps) => {

  class CanvasHolder {
    obj: Collection | Scene | Overlay
    cps: ICanvasProxy[]
    constructor(obj: Collection | Scene | Overlay, canvasproxies: ICanvasProxy[]) {
      this.obj = obj
      this.cps = canvasproxies.filter(cp => cp.scene === obj || this.obj instanceof Collection && cp.isCollectionPart() && cp.scene.collectionId === this.obj.collectionId)
    }
    getReadySize() {
      return new Set(this.cps.map(cp=>cp.scene)).size
    }
    getId() {
      return this.obj instanceof Collection ? `c-${this.obj.collectionId}` : `s-${this.obj.sceneId}`
    }
    getFrames(): Scene[] {
      return this.obj instanceof Collection ? this.obj.scenes : []
    }
    getNames() {
      return [...new Set(this.cps.map(cp=>cp.name))]
    }
    getViewSelector(setNames: (fn: (prev: {})=>any)=>void) {
      const switchView = (e: EventSelect) => setNames((oldNames)=>({...oldNames, [this.getId()]: e.currentTarget.value}))
      return <select onChange={switchView}>
        {this.getNames().map((n, i)=><option value={n} selected={activeNames()[this.getId()] === n}>{n}</option>)}
      </select>
    }
    static isCollection(canvasHolder: CanvasHolder) {
      return canvasHolder.obj instanceof Collection
    }
    static isOverlayOf(canvasHolder: CanvasHolder) {
      return (testObj: CanvasHolder) => {
        if(!(testObj.obj instanceof Overlay)) return false
        return (canvasHolder.obj instanceof Scene && testObj.obj.baseScene.sceneId === canvasHolder.obj.sceneId
          || canvasHolder.obj instanceof Collection && canvasHolder.obj.collectionId === testObj.obj.collectionId)
      }
    }
  }

  const resultStatic = children(() => props.children);

  const collections = () => props.sceneState.collections
  const canvasproxies = () => props.sceneState.canvaslist
  const forceFrame = () => props.sceneState.forceFrame
  const forceChannel = () => props.sceneState.forceChannel
  const mainScenes = () => props.sceneState.scenes.filter(s=>s.collectionId === undefined && !(s instanceof Overlay))
  const overlays = () => props.sceneState.scenes.filter((s): s is Overlay => s instanceof Overlay)
  const canvasHolders = ()=>[...collections(), ...mainScenes(), ...overlays()].map(obj=>new CanvasHolder(obj, canvasproxies()))

  const [pixelviewer, setPixelviewer] = createSignal<IPixelviewer | null>(null)
  const [existingIds, setExistingIds] = createSignal<Set<string>>(new Set<string>())
  const [activeScenes, setActiveScenes] = createSignal<number[]>([])
  const [activeNames, setActiveNames] = createSignal<Record<string,string>>({})
  const [activeFrames, setActiveFrames] = createSignal<Record<string, number>>({})
  const [hiddenOverlays, setHiddenOverlays] = createSignal<string[]>([])

  const updateCanvasHolders = () => {
    canvasHolders().forEach((c, i)=>{     
      if(CanvasHolder.isCollection(c)) {
        const size = c.getReadySize()
        if(size < c.getFrames().length) {
          setActiveNames((prev)=>({...prev, [c.getId()]: c.getNames()[0]}))
          switchActiveFrame(c, size - 1)
        }
      }
      if(!existingIds().has(c.getId())) {
        setExistingIds((prev)=>prev.add(c.getId()))
        if(!(c.obj instanceof Collection)) {
          const sceneId = c.obj.sceneId
          setActiveScenes((prev)=>prev.filter(id=>id!==sceneId).concat([sceneId]))
        }
      }
      setActiveNames((prev)=>{
        if(!c.getNames().includes(prev[c.getId()])) {
          return {...prev, [c.getId()]: c.getNames()[0]}
        }
        return prev
      })
    })
  }
  createEffect(on(canvasHolders, updateCanvasHolders))

  createEffect(on(forceFrame, ()=>{
    for(let [collectionId, sceneId] of Object.entries(forceFrame())) {
      const coll = canvasHolders().find(ch=>ch.obj instanceof Collection && ch.obj.collectionId === Number(collectionId))!
      switchActiveFrame(coll, coll.getFrames().findIndex(s=>s.sceneId === sceneId))
      delete forceFrame()[Number(collectionId)]
    }
  }))

  const switchActiveFrame = (ch: CanvasHolder, i: number) => {
    setActiveFrames((prevActive)=> {
      return {...prevActive, [ch.getId()]: i}
    })
    const frameIds = ch.getFrames().map(s=>s.sceneId)
    setActiveScenes((prev)=>prev.filter(sceneId=>!frameIds.includes(sceneId)).concat([frameIds[i]]))
  }

  createEffect(on(forceChannel, ()=>{
    for(let [sceneId, channelname] of Object.entries(forceChannel())) {
      const sceneCH = canvasHolders().find(ch=>ch.obj instanceof Scene && ch.obj.sceneId === Number(sceneId))!
      setActiveNames((oldNames)=>({...oldNames, [sceneCH.getId()]: channelname}))
      delete forceChannel()[Number(sceneId)]
    }
  }))

  function showPixels(e: MouseEvent) {
    const el = e.currentTarget as HTMLDivElement
    const {clientX, clientY} = e
    let activeCanvies = canvasproxies().filter(c=>c.active).filter(cp=>cp.containsPoint(clientX, clientY))
    if(!activeCanvies.length) {
      hidePixels()
      return
    }
    let {W, H, scene, channelDependencies, canvas: {offsetWidth, offsetLeft, offsetTop, offsetHeight}} = activeCanvies[0]
    if(!scene) return
    let scale = offsetWidth / W;
    let x = Math.floor(e.offsetX/scale);
    let y = Math.floor(e.offsetY/scale);
    let p = W*y+x;
    let px = e.offsetX + offsetLeft; //relative to wrapper
    let py = e.offsetY + offsetTop;
    let longLat = scene.getLongLat(x, y)
    let w = el.offsetWidth;
    let h = el.offsetHeight;
    const getData = (c: ICanvasProxy) => {
      const keys = c.channelDependencies.map(c=>c.name)
      const values = c.channelDependencies.map(c=>c.view[p])
      let d = [...keys.map((k, i)=>[k, values[i]])]
      const ownChannels = {...Object.fromEntries(d)} as Record<ChannelName, number>
      const get = (cn: ChannelName, p: number) => ownChannels?.[cn] || 0
      const [r, g, b, a] = [get("r", p), get("g", p), get("b", p), get("a", p)]
      return {ownChannels, r, g, b, a}
    }
    const {ownChannels, r, g, b, a} = getData(activeCanvies[0])
    const overlayChannels = activeCanvies.slice(1).map(o=>getData(o).ownChannels)
    const pv = {
      x, y, longLat, ownChannels, overlayChannels,
      style: `${px < w/2 ? "left" : "right"}: ${px < w/2 ? px + 10 : w-px+10}px; ${py < h/2 ? "top" : "bottom"}: ${py < h/2 ? py+10 : h-py+10}px;
      background-color: rgba(${r}, ${g}, ${b}); color: ${(r+g+b)/3 > 128 ? "#000" : "#fff"}`
    }
    setPixelviewer(pv)
  }

  function hidePixels() {
    setPixelviewer(null)
  }

  const displayOverlay = (ch: CanvasHolder) => {
    const id = ch.getId()
    const isHidden = hiddenOverlays().includes(id)
    //console.log({id, isHidden, ho: hiddenOverlays()});
    const toggle = () => {
      setHiddenOverlays((prev)=>isHidden ? prev.filter(x=>x!==id) : prev.concat([id]))
    }
    return <span class={`showOverlay${isHidden ? " hiddenOverlay" : ""}`} onClick={toggle}>
      👁️ {ch.obj.label || "Overlay"}
    </span>
  }

  const markActiveCanvas = () => {
    
    canvasHolders().forEach(ch=>{
      ch.cps.forEach(cp=>{
        const sceneIsActive = activeScenes().includes(cp.scene.sceneId)
        const nameIsActive = activeNames()[ch.getId()] === cp.name
        const isHiddenOverlay = hiddenOverlays().includes(ch.getId())
        cp.setActive(sceneIsActive && nameIsActive && !isHiddenOverlay)
      })
    })
  }
  createEffect(on([activeScenes, activeFrames, activeNames, resultStatic, canvasHolders, hiddenOverlays], markActiveCanvas))

  return <>
    <div class="myplanet_result">
      <div class="resultcontrol">
        {canvasHolders().filter(CanvasHolder.isCollection).map(ch=>
          <div class="sceneDescriptor">
            <span class="label">{ch.obj.label}</span>
            {ch.getViewSelector(setActiveNames)}
            {activeFrames()[ch.getId()] || 0}/{ch.getFrames().length-1}
            <select onChange={(e: EventSelect)=>switchActiveFrame(ch, +e.currentTarget.value)}>
              {ch.getFrames().map((s, i)=><option value={i} selected={activeFrames()[ch.getId()] === i}>{s.label}</option>)}
            </select>
          {canvasHolders().filter(CanvasHolder.isOverlayOf(ch)).map(displayOverlay)}
        </div>)}
        {canvasHolders().filter(ch=>!(ch.obj instanceof Overlay || ch.obj instanceof Collection)).map(ch=>
          <div class="sceneDescriptor">
            <span class="label">{ch.obj.label}</span>
            {ch.getViewSelector(setActiveNames)}
            {canvasHolders().filter(CanvasHolder.isOverlayOf(ch)).map(displayOverlay)}
          </div>)}
      </div>
      <div class="canvas_wrapper" onMouseMove={showPixels} onMouseLeave={hidePixels}>
        {resultStatic()}
        <Show when={pixelviewer()}>
          <div class="pixelviewer" style={pixelviewer()!.style}>
            <div>x: {pixelviewer()!.x} | y: {pixelviewer()!.y}</div>
            <div>{pixelviewer()!.longLat[1].toFixed(2)}°N {pixelviewer()!.longLat[0].toFixed(2)}°E</div>
            {Object.entries(pixelviewer()!.ownChannels).map(
              ([cn, v])=>{
                if(v===undefined) return <div>{""+cn}: ---</div>
                let displayValue = String(v)
                if(cn === "country") displayValue = `${countryList[v]} (${v}) `
                if(cn === "pop") displayValue = `${v.toFixed(2)} 👪/km²`
                if(cn === "night") displayValue = `${Math.round(v)} μW/m²`
                if(cn === "elevation") displayValue = `${Math.round(v)} m`
                if(cn === "nox") displayValue = `${v.toPrecision(3)} units`
                return <div>{""+cn}: {displayValue}</div>
              })}
            {pixelviewer()!.overlayChannels.map((c, i)=><div>Overlay<br/>
              {Object.entries(c).map(([cn, v])=><span>{cn}: {v} </span>)}
            </div>)}
          </div>
        </Show>
      </div>
    </div>
    <style jsx>{`

        .canvas_wrapper {
          position: relative;
          background-size: contain;
          background-repeat: no-repeat;
          overflow-y: auto;
        }
        .canvas_wrapper :global(canvas) {
          width: 100%; display: none; cursor: crosshair;
        }
        .canvas_wrapper :global(canvas.active) {
          display: block;
        }
        .canvas_wrapper :global(canvas.overlay) {
          position: absolute;
          top: 0
        }
        .canvas_wrapper :global(canvas.pixelated) {
          image-rendering: pixelated;
          image-rendering: -moz-crisp-edges;
          -ms-interpolation-mode: nearest-neighbor;
        }
        .pixelviewer {position: absolute; font-size: 0.8em; padding: 0.3em;}
        
        select {
          margin: 0.2em;
          padding: 0.2em;
        }
        select>option {
          padding: 0.2em;
        }
        
        .sceneDescriptor {
          background-color: var(--taskheader-background);
          height: var(--hcolumnheader);
          display: flex;
          align-items: center;
          padding: 0.1em 0.5em;
        }
        .label {text-transform: capitalize; font-weight: bold; margin-right: 0.5em}
        
        .showOverlay {cursor: pointer;}
        .showOverlay.hiddenOverlay {opacity: 0.5; filter: grayscale()}
      `}
    </style>
  </>
}

export default MyplanetTaskResultControl;

/*const channelAliases: Record<string, string[]> = {
	r: ["r", "R", "red", "rot", "🟥"],
	g: ["g", "G", "green", "gruen", "🟩", "grün"],
	b: ["b", "B", "blue", "blau", "🟦"],
	a: ["a", "A", "alpha", "alpha", "🖌"],
	elevation: ["h", "H", "elevation", "hoehe", "🏔", "höhe"],
	country: ["c", "C", "country", "land", "🚩"],
	pop: ["p", "P", "pop", "bev", "👪"],
	nox: ["n", "N",  "nox", "NOx", "💨"],
	night: ["l", "L", "night", "nacht", "🌇", "light", "nightlight", "licht"],
}*/