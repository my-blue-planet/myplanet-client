import {Component, createSignal, Index, onMount, Suspense} from 'solid-js';
import MyplanetTaskLoader from "./MyplanetTaskLoader";

const tasks = [
  "Schneemangel",
  //"Himalaya",
  "Vulkan",
  "Bern",
  "Lateinamerika",
  "Reliefkarte",
  "Meeresufer",
  "Korea",
  "Aletsch",
  "Abholzung",
  "Aralsee",
  "Nachthimmel",
  "Feuerland",
  "Weiteres",
  // "testScene",
  // "testOverlay",
  // "testCollection",
]

const scenes = [
  // "africa",
  // "centralEurope",
  // "hillshading",
  // "usa",
  // "korea",
  // "switzerland",
  // "southAmerica",
  // "worldWithoutPolar1024",
  // "timelapse-madagskar",
  // "timelapse-irrigation",
  // "timelapse-aral",
  // "timelapse-amazonas",
]

type TLang = "python" | "js"

const App: Component = () => {
  const [activeTask, setActiveTask] = createSignal(sessionStorage.myplanettask || tasks[0])
  const [mode, setMode] = createSignal<TLang>(sessionStorage.myplanetmode || "js")

  const switchTask = (name: string) => {
    sessionStorage.myplanettask = name
    setActiveTask(name)
  }

  const switchMode = (mode: TLang) => {
    sessionStorage.myplanetmode = mode
    setMode(mode)
  }

  return <div>
    <header>
      <img class="logo" src="/img/myplanet1.png"/>
      <h1>MyPlanet </h1>
      <select onChange={(e)=>switchTask(e.currentTarget.value)}>
        <Index each={tasks}>{(task)=><option value={task()} selected={activeTask()===task()}>{task()}</option>}</Index>
        {/*<optgroup label="Playgrounds">
          <Index each={scenes}>{(s)=><option value={`playground-${s()}`} selected={activeTask()===`playground-${s()}`}>{s()}</option>}</Index>
        </optgroup>*/}
      </select>
      <select onChange={(e)=>switchMode(e.currentTarget.value as TLang)}>
        <Index each={["python", "js"] as TLang[]}>{(m)=><option value={m()} selected={mode()===m()}>{m()}</option>}</Index>
      </select>
    </header>
    <MyplanetTaskLoader taskname={activeTask()} mode={mode()}/>
  </div>
}

export default App;


