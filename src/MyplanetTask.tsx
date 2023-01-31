import {Component, createEffect, createMemo, createSignal, on, onMount, Show, untrack} from 'solid-js';
import {Layout} from "./Layout";
import {TaskControllerSolid, TaskControllerSolidProps} from "./TaskControllerSolid";
import SceneManager, {Command} from "./SceneManager";
import {IRunConfig, IRunSubscriber} from "3e8-run-python-skulpt";
// @ts-ignore
import {MyplanetTaskConfig} from "../myplanettasks/MyplanetTaskConfig";
import MyplanetTaskResult from "./MyplanetTaskResult";
import {threading, myplanet, mercatorWorker} from "./skulpthelpers/libraries.json"
import {myplanet as myplanetJS} from "./myplanet_js/libraries.json";
import {TMode} from "3e8-editor";
import MyplanetTaskResultControl from "./MyplanetTaskResultControl";
import {Collection, ICanvasProxy, IChannel, Scene} from "./DisplayObjects";
import {Documentation} from "./Documentation";

type Tprops = MyplanetTaskConfig & {mode: "js" | "python"}

export interface ISceneState {
  forceFrame: Record<number, number>;
  forceChannel: Record<number, string>;
  channels: IChannel[]
  canvaslist: ICanvasProxy[]
  scenes: Scene[]
  collections: Collection[]
}

const MyplanetTask: Component<Tprops> = (props: Tprops) => {

  const mode = () => props.mode === "js" ? "js" : "python"
  const isPy = () => mode() === "python"
  const templateCode = () => (isPy() ? props.template : props.templateJS) || ""

  const [sceneManager, setScM] = createSignal<SceneManager | null>(null)
  const [sceneState, setSceneState] = createSignal<ISceneState>({channels: [], canvaslist: [], scenes: [], collections: [], forceFrame: {}, forceChannel: {}})
  const [leftWidth, setLeftWidth] = createSignal<number>(0)
  const [explanationOrLibraray, setExplanationOrLibraray] = createSignal<null | "explanation" | "documentation">("explanation")

  let resultRef: HTMLDivElement

  const subscribers: IRunSubscriber = {
    sendReadySignal: (readySignal: string, payload: any)=>"will be overwritten",
    addSharedArrayBuffer: (name: string, payload: any)=>"will be overwritten",
  }

  const runConfig = (): Partial<IRunConfig> => ({
    addLib: isPy() ? {...threading, ...myplanet, ...mercatorWorker} : {myplanet: myplanetJS},
    show: async (payload: {show: any}) => sceneManager()!.show(payload),
    subscribers
  })

  const taskControllerProps = () => {
    return {
      runConfig: runConfig(),
      template: templateCode(),
      taskname: "myptask_" + props.taskname + (isPy() ? "" : "_js"),
      mode: isPy() ? "python" as TMode : "javascript" as TMode,
      solution: isPy() ? props.solution || "" : props.solutionJS || "",
      verbose: isPy(),
      beforeCode: isPy() ? "" : "", //"(async ()=>{",
      afterCode: isPy() ? "" : "", //"})().catch(e=>{console.log(44444);throw e})"//props.waitForImages ? "\nwaitForImages()\nprint('ok')" : ""
    }
  }

  //changeListener we pass to sceneManager
  const sceneListener = () => {
    const scm = sceneManager()
    if(scm!==null) {
      const {channels, canvaslist, collections, scenes, forceFrame, forceChannel} = scm
      setSceneState({channels, canvaslist, collections, scenes, forceFrame, forceChannel})
    }
  }

  createEffect(on([()=>props.title, ()=>resultRef], ()=>{
    setScM(new SceneManager(resultRef, sceneListener, subscribers, {maxWidth: 600,	pixelated: false}))
  }))

  const onRunCode = () => {
    sceneManager()!.reset()
  }

  return <><Layout
    left={
      <div class="leftcontent" on:run-code={onRunCode} on:init-done={()=>sceneManager()!.autoLoadScene(templateCode())}>
        <div class="taskheader">
          <button onClick={() => setExplanationOrLibraray((prev)=>prev === "explanation" ? null : "explanation")} title="zeige Auftrag">📝 {props.title}</button>
          <button onClick={() => setExplanationOrLibraray((prev)=>prev === "documentation" ? null : "documentation")} title="zur Dokumentation">ℹ️</button>
        </div>
        <div class="lefttask">
          <div class={"slide explanation notprint " + (explanationOrLibraray() !== "explanation" ? "hidden" : "")}>
            <button class="closebutton" onClick={()=>setExplanationOrLibraray(null)}>❌</button>
            <h3>{props.title}</h3>
            <div class="explanationHTML" innerHTML={props.explanation}></div>
            <button class="okaybutton" onClick={()=>setExplanationOrLibraray(null)}>OK</button>
          </div>
          <div class={"slide documentation " + (explanationOrLibraray() !== "documentation" ? "hidden" : "")}>
            <button class="closebutton" onClick={()=>setExplanationOrLibraray(null)}>❌</button>
            <Documentation mode={isPy() ? "python" : "javascript"}/>
            <button class="okaybutton" onClick={()=>setExplanationOrLibraray(null)}>OK</button>
          </div>
          <TaskControllerSolid {...taskControllerProps()!} width={leftWidth()}/>
        </div>
      </div>
    }
    resizeHandler={setLeftWidth}
    right={<MyplanetTaskResultControl sceneState={sceneState()}><MyplanetTaskResult ref={resultRef!}/></MyplanetTaskResultControl>}
  />
  <style jsx>{`
    .leftcontent {
      overflow-x: hidden;
    }
    
    button {
      background-color: rgba(255, 255, 255, 0.2);
      border: none;
      border-radius: 0.2em;
      font-weight: bold;
      padding: 0.2em 0.6em;
      cursor: pointer;
    }
    
    .taskheader button {
      font-size: 1.2em;
    }

    .lefttask {
      position: relative;
      height: calc(var(--hmain) - var(--hcolumnheader));
    }
    
    .taskheader {
      background-color: var(--taskheader-background);
      height: var(--hcolumnheader);
      display: flex;
      align-items: center;
      padding: 0.1em 0.5em;
      justify-content: space-between;
    }

    .slide.hidden {
      opacity: 0;
      height: 0;
      visibility: hidden;
      top: -10px;
      transition-duration: 200ms, 200ms, 0ms;
      transition-property: opacity, top, visibility;
      transition-delay: 0ms, 0ms, 200ms;
    }
    
    .slide {
      height: calc(var(--hmain) - var(--hcolumnheader));
      opacity: 1;
      visibility: visible;
      width: 100%;
      top: 0px;
      z-index: 10;
      position: absolute;
      transition-duration: 200ms, 200ms, 0ms;
      transition-property: opacity, top, visibility;
      transition-delay: 0ms, 0ms, 0ms;
      background-color: #384559;
      padding-bottom: 1.5em;
      color: white;
      overflow-y: auto;
    }
    
    .closebutton {
      position: absolute;
      top: 0.5em;
      right: 0.5em;
    }
    
    .okaybutton {
      margin: 2em auto;
      display: block;
      width: 4em;
    }

    .explanation {
      --padding: 1.5em;
      padding: var(--padding);
    }
    
    .explanation.print {
      background-color: #fff;
      color: #000;
      font-size: 1.3em;
      
    }
    .explanation.print .closebutton {display: none;}
    :global(.print .explanationHTML a) {color: #2c3e50;}
    
    :global(.explanationHTML p) {margin: 0.2em 0;}
    :global(.explanationHTML ul) {margin: 0.2em 0; list-style-type: none; padding: 0}
    :global(.explanationHTML h4) {margin: 0.5em 0 0.2em 0;}
    :global(.explanation:not(.print) .sketchinvert) {filter: invert() hue-rotate(180deg);}
    :global(.explanation .sketchinvert) {max-width: 100%;}
    :global(.explanationHTML li) {padding: 0.2em}
    :global(.explanationHTML ul>li) {text-indent: -2em; padding-left: 2em;}
    :global(.explanationHTML li *) {text-indent: 0;}
    :global(.explanationHTML ul>li::before) {
      content: "🌐";
      display: inline-block;
      width: 2em;
      text-align: center;
      text-indent: 0;
    }
    :global(.explanationHTML .tasks>li::before) {
      content: "📝";
    }
    :global(.explanationHTML dfn) {
      font-family: monospace;
      font-style: normal;
      background-color: rgba(100,100,150,0.1);
      border: 0.02em solid rgba(100,100,150,0.3);
      border-radius: 0.2em;
      padding: 0.02em 0.2em;
    }
    :global(.explanationHTML .linkbox) {display: flex; background-color: #0003; margin: 1em 0;}
    :global(.explanationHTML .linkbox a) {color: #cdf; padding: 0.8em;}

  `}
  </style></>

}

export default MyplanetTask;


