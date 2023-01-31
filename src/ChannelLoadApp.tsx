import {Component, createEffect, createSignal, JSXElement, onMount, Show} from 'solid-js';
import {
  ChannelLoader,
  LoadChannel,
  TImageDescriptor,
  TloadChannelName,
  ChannelLoaderState,
  loadChannels
} from "./ChannelLoader"
import {Collection, DisplayObj, ICanvasProxy, ICutBounds, Scene} from "./DisplayObjects";
import {uploadScene} from "./uploadScene";

const channelDescription: Record<TloadChannelName, string> = {
  "vis": "Visual bands (red, green, blue)",
  "elevation": "Elevation",
  "country": "Country",
  "pop": "Population density",
  "nox": "NOx pollution (slow)",
  "night": "Night lights",
}

const zerocut = {top: 0, left: 0, right: 0, bottom: 0}

function clearLocalStorageIfTooOld() {
  if(!localStorage.channelloadtime || Date.now() - localStorage.channelloadtime > 7200000) {
    const keys = Object.keys(localStorage).filter(k=>k.startsWith("earthEngineLink"))
    keys.forEach(k=>localStorage.removeItem(k))
    localStorage.channelloadtime = Date.now()
  }
}
clearLocalStorageIfTooOld()

const $ = document.querySelector.bind(document)
const getVal = (name: keyof ChannelLoaderState | `${TloadChannelName}-${"min"|"max"|"year"}` | `cut-${string}`) => ($(`[name=${name}]`)! as HTMLInputElement).value
const isChecked = (name: TloadChannelName | `${TloadChannelName}-manualrange`) => ($(`[value=${String(name)}]`)! as HTMLInputElement).checked

const europeChannels = loadChannels.map(lc=>({...lc, ...lc.name === "elevation" && {manualRange: true, min: 0, max: 5120}}))
const latinChannels = loadChannels.map(lc=>({...lc, ...lc.name === "elevation" && {manualRange: true, min: 0, max: 6400}}))
const worldChannels = loadChannels.map(lc=>({...lc, ...lc.name === "elevation" && {manualRange: true, min: 0, max: 30*256}}))
const koreaChannels = loadChannels.map(lc=>({...lc, ...lc.name === "elevation" && {manualRange: true, min: 0, max: 2560}}))
const bernChannels = loadChannels.filter(c=>["vis", "elevation"].includes(c.name)).map(lc=>({...lc, ...lc.name === "elevation" && {manualRange: true, min: 400, max: 656}}))
const createMultichannelTemplate = (long: number, lat: number, zoomLevel: number, size: 256 | 512 | 768 | 1024 | 1280, loadChannels: LoadChannel[], cut =  zerocut): ChannelLoaderState => ({
  long, lat, zoomLevel, size, loadChannels, cut
})
const createTimelapseTemplate = (long: number, lat: number, zoomLevel: number): ChannelLoaderState => {
  return createMultichannelTemplate(long, lat, zoomLevel, 256, [...loadChannels])
}

//himalaya 86.9 28 12 1024 4000-9120 {top: 256, left: 256, bottom: 256, right: 256}

const multibandPresets: Record<string, ChannelLoaderState> = {
  aletsch: createMultichannelTemplate(7.95, 46.55, 12, 1280, europeChannels, {top: 100, left: 256, bottom: 0, right: 0}),
  centralEurope: createMultichannelTemplate(0, 45, 4, 768, europeChannels, {top: 166, left: 128, bottom: 90, right: 0}),
  switzerland: createMultichannelTemplate(7.6, 47, 7, 512, europeChannels, {top: 142, left: 27, bottom: 90, right: 65}),
  bern: createMultichannelTemplate(7.44, 46.965, 14, 1280, bernChannels, {top: 568, left: 442, bottom: 200, right: 298}),
  korea: createMultichannelTemplate(128, 38, 6, 768, koreaChannels, {top: 100, left: 256, bottom: 92, right: 128}),
  southAmerica: createMultichannelTemplate(-62, -21, 3, 768, latinChannels, {top: 160, left: 256, bottom: 96, right: 192}),
  usa: createMultichannelTemplate(-92, +40, 3, 512, europeChannels, {top: 186, left: 50, bottom: 146, right: 106}),
  africa: createMultichannelTemplate(18, +13, 3, 768, europeChannels, {top: 280, left: 150, bottom: 38, right: 168}),
  world60to60: createMultichannelTemplate(0, 0, 2, 1024, worldChannels, {top: 298, left: 0, bottom: 298, right: 0})
}

const timelapsePresets: Record<string, ChannelLoaderState> = {
  amazonas: createTimelapseTemplate(-62, -10, 9),
  aralsee: createTimelapseTemplate(59, 45, 5),
  irrigation: createTimelapseTemplate(38.3, 30, 10),
}

const initState = {
  ...createMultichannelTemplate(7.06, 47.6, 13, 256, [...loadChannels], zerocut),
  ...JSON.parse(localStorage.channelLoaderState || "{}")
}

//   // const data = await cl.listImages(7.99,46.56,10)

const ChannelLoadApp: Component = () => {

  let canvas: HTMLCanvasElement
  let output: HTMLDivElement

  const [target, setTarget] = createSignal<"timelapse" | "multichannel">(localStorage.channelloadertarget || "multichannel")
  const [data, setData] = createSignal<string>("")
  const [scene, setScene] = createSignal<Scene|null>(null)
  //const [imageList, setImageList] = createSignal<TImageDescriptor[]>([])
  const [collection, setCollection] = createSignal<Collection|null>(null)
  const [timelapseFrame, setTimelapseFrame] = createSignal<string>("")
  const [ready, setReady] = createSignal<boolean|Record<string, number>>(false)
  const [uploadLabel, setUploadLabel] = createSignal<string>("")
  const [uploadResultName, setUploadResultName] = createSignal<string>("")

  const [state, setState] = createSignal<ChannelLoaderState>(initState)

  function update() {
    const nextState: Partial<ChannelLoaderState> = {
      long: +getVal("long"),
      lat: +getVal("lat"),
      zoomLevel: +getVal("zoomLevel"),
      size: target() === "multichannel" ? +getVal("size") as 256 | 512 | 768 | 1024 | 1280 : 256
    }
    loadState(nextState)
  }

  function updateCut() {
    loadState({cut: {top: +getVal("cut-top"), left: +getVal("cut-left"), bottom: +getVal("cut-bottom"), right: +getVal("cut-right")}})
  }

  function updateChannel(name: TloadChannelName) {
    const loadChannels = state().loadChannels.map(lc => {
      if(lc.name === name) {
        lc.selected = isChecked(lc.name)
        if($(`[name=${name}-manualrange]`)) lc.manualRange = isChecked(`${name}-manualrange`)
        if($(`[name=${name}-year]`)) lc.year = +getVal(`${name}-year`)
        if($(`[name=${name}-min]`)) lc.min = +getVal(`${name}-min`)
        if($(`[name=${name}-max]`)) lc.max = +getVal(`${name}-max`)
        return {...lc}
      }
      return lc
    })
    loadState({loadChannels})
  }

  const loadPreset = (name: string, preset: Partial<ChannelLoaderState>) => {
    setUploadLabel(name)
    setReady(false)
    setUploadResultName("")
    loadState(preset)
  }

  const loadState = (partialState: Partial<ChannelLoaderState>) => {
    const nextState = {...state(), ...partialState}
    localStorage.channelLoaderState = JSON.stringify(nextState)
    setState(nextState)
  }

  const cl = new ChannelLoader()

  const load = async () => {
    let readyState: Record<string, number> = {}
    for(let cname of state().loadChannels.map(c=>c.name)) {
      readyState[cname] = 0
    }
    setReady(readyState)
    for await (let scene of cl.load(state())) {
      output.innerHTML = ""
      scene.initCanvies().forEach((cp: ICanvasProxy)=>{
        output.appendChild(cp.canvas)
      })
      const readyChannels = Object.fromEntries(Object.keys(scene.channels).map(cn=>[cn, 1]));
      if(readyChannels["b"] === 1) readyChannels["vis"] = 1
      setReady((prev)=>({...(typeof prev === "boolean" ? {} : prev), ...readyChannels}))
      setScene(scene)
      setData(JSON.stringify(scene.serialize(), null, 2))
    }
    await cut()
    setReady(true)
  }

  const loadTimelapse = async () => {
    let readyState = 0
    setReady({"timelapse": readyState})
    output.innerHTML = `<div><select></select><div class="result"></div></div>`
    const select = output.querySelector("select")!
    const result = output.querySelector(".result")!
    const setActiveFrame = (label: string) => {
      setTimelapseFrame(label)
      const activeScene = collection()?.scenes.find(s=>s.label === timelapseFrame())
      result.innerHTML = ""
      activeScene?.initCanvies().forEach((cp: ICanvasProxy)=>{
        result.appendChild(cp.canvas)
      })
    }
    select.addEventListener("change", e=>{
      setActiveFrame(select.value)
    })
    for await (let coll of cl.loadTimelapse(state())) {
      setCollection(coll)
      readyState += 1/40
      setReady({"timelapse": readyState})
      setActiveFrame(coll.scenes[coll.scenes.length - 1].label)
      //const scenes = collection.scenes
      const options = coll.getLabels().map(l=>`<option ${l===timelapseFrame()?"selected":""} value="${l}">${l}</option>`).join("")
      select.innerHTML = options
      // const activeScene = scenes.find(s=>s.label === timelapseFrame())
      // setTimelapse(<>{labels} {activeScene && activeScene.initCanvies().map((cp: ICanvasProxy)=>{
      //   return cp.canvas
      // })}</>)
      //setData(JSON.stringify(collection.serialize(), null, 2))
    }
    if(collection()) setData(JSON.stringify(collection()!.serialize(), null, 2))
    setReady(true)
  }

  const cut = async () => {
    const copy = scene()!.cut(state().cut)
    setData(JSON.stringify(copy.serialize(), null, 2))
    output.innerHTML = ""
    copy.initCanvies().forEach((cp: ICanvasProxy)=>{
      output.appendChild(cp.canvas)
    })
  }

  // const loadImage = async (id: string) => {
  //   // const cl = new ChannelLoader()
  //   // const data = await cl.loadImage(id, 7.99,46.56,10)
  //   // combineVisibles(data.r as Uint8Array, data.g as Uint8Array, data.b as Uint8Array)
  // }

  const clickMap = (e: MouseEvent) => {
    setState((prev)=>({...prev, long: e.offsetX - 180, lat: - e.offsetY + 90}))
  }

  const cutInput = (side: "top"|"bottom"|"left"|"right") => <label>
    <input type="number" name={`cut-${side}`} value={state().cut[side]} onChange={updateCut}/>
  </label>

  const chooseTarget = (t: "timelapse" | "multichannel") => {
    localStorage.channelloadertarget = t
    setTarget(t)
  }

  const download = () => {
    const blob = new Blob([data()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Scene-${new Date().toISOString().slice(0,18)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  const upload = async () => {
    setUploadResultName("")
    const r = await cl.uploadScene(uploadLabel(), data())
    console.log(r);
    if(r.ok) setUploadResultName(r.name)
  }

  const loading = () => typeof ready() !== "boolean"

  return <><div class="channelloaderapp">
    <div style="display: flex; align-items: center;">
      <img class="logo" src="/img/myplanet1.png"/>
      <h3>MyPlanet - Prepare Data</h3>
    </div>
    <div class="choosetarget">
      <button disabled={loading()} class={"multichannel " + (target() === "multichannel" ? "active" : "")} onClick={()=>chooseTarget("multichannel")}>Scene</button>
      <button disabled={loading()} class={"timelapse " + (target() === "timelapse" ? "active" : "")} onClick={()=>chooseTarget("timelapse")}>Collection</button>
    </div>
    <div class="containtarget">
      <div>
        <h4>Location</h4>
        <div class="threecol">
          <div>
            <div>
              <label class="topcaption">
                <span>Longitude</span>
                <input disabled={loading()} onChange={update} name="long" type="number" value={state().long}/>
              </label>
            </div>
            <div>
              <label class="topcaption">
                <span>Latitude</span>
                <input disabled={loading()} onChange={update} name="lat" type="number" value={state().lat}/>
              </label>
            </div>
            <div>
              <label class="topcaption">
                <span>Zoom Level</span>
                <input disabled={loading()} onChange={update} name="zoomLevel" type="number" min="0" max="14" step="1" value={state().zoomLevel}/>
              </label>
            </div>
            {target()==="multichannel" && <div>
              <label class="topcaption">
                <span>Image Size</span>
                <input disabled={loading()} onChange={update} name="size" type="range" min="256" max="1280" step="256" value={state().size}/>
              </label>
            </div>}
          </div>
          <div style="margin: 0 1em;">
            <img onClick={clickMap} src="/img/earthmap.jpg" width="360" height="180"/>
          </div>
          <div>
            {target() === "multichannel" && Object.entries(multibandPresets).map(([name, preset])=><button class="locationchooser" disabled={loading()}  onClick={()=>loadPreset(name, preset)}>{name}</button>)}
            {target() === "timelapse" && Object.entries(timelapsePresets).map(([name, preset])=><button class="locationchooser" disabled={loading()}  onClick={()=>loadPreset(name, preset)}>{name}</button>)}
          </div>
        </div>
      </div>
      {target() === "multichannel" && <div class="channelchoosers">
        <h4>Channels</h4>
        {state().loadChannels.map(lc=><div class="channelchooser">
           <label><input disabled={loading()}  onChange={()=>updateChannel(lc.name)} type="checkbox" name={lc.name} value={lc.name} checked={lc.selected}/>
            {loading() && (ready() as Record<string, number>)[lc.name] === 0 && <span class="waiting">⌛</span>}
            {loading() && (ready() as Record<string, number>)[lc.name] === 1 && <span class="waiting">✔️</span>}
            {loading() && (ready() as Record<string, number>)[lc.name] === undefined && <span class="waiting"></span>}
            <span class="emoji hourglass"/>
            {channelDescription[lc.name]}</label>
            {lc.selected && ["elevation"].includes(lc.name) && <>
              <label><input type="checkbox" name={`${lc.name}-manualrange`} disabled={loading()} onChange={()=>updateChannel(lc.name)} value={`${lc.name}-manualrange`} checked={lc.manualRange}/> Set Range </label>
              {lc.manualRange && <>
                <label>Min: <input type="number" disabled={loading()} onChange={()=>updateChannel(lc.name)} name={`${lc.name}-min`} value={lc.min}/></label>
                <label>Max: <input type="number" disabled={loading()} onChange={()=>updateChannel(lc.name)} name={`${lc.name}-max`} value={lc.max}/></label>
              </>}
            </>}
            {/*year disabled: lc.selected && ["vis"].includes(lc.name) && <><label>Year: <input onChange={()=>updateChannel(lc.name)} name={`${lc.name}-year`} type="number" value={lc.year}/></label></>*/}
          </div>)
        }
      </div>}
      {target() === "multichannel" && <button class="mainbutton" onClick={load} disabled={loading()}>Load</button>}
      {target() === "timelapse" && <button class="mainbutton" onClick={loadTimelapse} disabled={loading()}>Load timelapse</button>}
      <div class="preview">
        <div ref={output!}></div>
        {/*<div style="max-height: 8em; overflow-y: auto;">
          {imageList().map(l=><div onClick={()=>loadImage(l.id)}>{new Date(l.timestamp).toLocaleString()} {l.clouds ? `☁ ${Math.round(l.clouds)} %` :""}</div>)}
        </div>*/}
      </div>
      {ready() === true && target() === "multichannel" && <details><summary>✂ Crop</summary>
        <table><tbody>
        <tr><td></td><td>{cutInput("top")}</td><td></td></tr>
        <tr><td>{cutInput("left")}</td><td></td><td>{cutInput("right")}</td></tr>
        <tr><td></td><td>{cutInput("bottom")}</td><td></td></tr>
        </tbody>
        </table>
        <button onClick={cut}>Crop</button>
      </details>}
      {/*ready() === true && <div>
        <button class="mainbutton" onClick={download}>Download</button>
      </div>*/}
      {ready() === true && <div>
        {!uploadResultName() && <>
          <button class="mainbutton" onClick={upload}>Upload to server</button>
          <input class="label" onChange={(e)=>setUploadLabel(e.currentTarget.value)} value={uploadLabel()} placeholder="label"/>
          </>
        }
        {uploadResultName() && <span>available: <dfn>{uploadResultName()}</dfn></span>}
      </div>}
    </div>

  </div>
  <style jsx>{`
    *, *:before, *:after {
      -webkit-box-sizing: border-box;
      -moz-box-sizing: border-box;
      box-sizing: border-box;
    }

    button, input[type="checkbox"] {
      cursor: pointer
    }

    input[type=number] {
      display: inline-block;
      width: 4em;
      height: 1.5em;
      padding-top: 0.2em;
      font-size: 0.8em;
      vertical-align: baseline;
    }

    label {
      display: inline-block;
      width: 7em;
    }
    
    .channelchooser {
      margin: 0.2em 0;
      padding: 0.2em 0;
      display: flex;
      background-color: #0003;
    }
    
    .channelchooser label:first-child {
      width: 18em;
      cursor: pointer;
    }

    .channelloaderapp {
      background-color: #111;
      color: #ddd;
      padding: 1em;
      min-height: 100vh;
    }
    
    .threecol {
      display: flex;
    }

    .choosetarget {
      display: flex;
    }

    .choosetarget button {
      padding: 0.8em;
      color: #ddd;
      background-color: rgba(44, 62, 80, 0.7);
      border: none;
      margin-right: 0.2em;
    }
    
    .choosetarget button:hover {
      color: #fff;
    }

    .choosetarget button.active {
      background-color: rgba(44, 62, 80, 1);
    }

    .containtarget {
      background-color: #2c3e50;
      color: #ddd;
      padding: 1em;
    }
    
    .waiting {
      display: inline-block;
      width: 1.5em;
    }
    h4 {margin: 0.3em 0;}
    label.topcaption {
      width: 6em;
      background-color: #0003;
      padding: 0.15em 0.4em;
      margin-bottom: 0.3em;
    }
    label.topcaption span {
      font-size: 0.7em;
      font-weight: bold;
      display: block;
      margin-bottom: -0.2em;
    }
    label.topcaption input {
      width: 95%;
    }
    
    .locationchooser {
      display: inline-block;
      width: 7.5em;
      margin: 0 0.2em 0.2em 0.2em;
      
    }
    
    .channelchoosers {
      margin-bottom: 1em;
    }
    
    :global(.preview canvas) {
      max-width: 512px;
      max-height: 512px;
      cursor: pointer;
      margin: 0 0.5em 0.5em 0;
    }
    
    button {
      background-color: #0003;
      color: #ddd;
      padding: 0.4em;
      border: none;
    }
    
    button:hover {
      color: #fff;
    }
    
    .mainbutton {margin: 1em 1em 1em 0;}
   
  `}
  </style>

  </>
}
export default ChannelLoadApp;