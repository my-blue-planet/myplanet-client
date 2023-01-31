import {Component, createEffect, createSignal, onMount, Show} from 'solid-js';
import MyplanetTask from "./MyplanetTask";
import type {MyplanetTaskConfig} from "myplanet-tasks";

interface LoaderProps {
  taskname: string
  mode: "js" | "python"
}

const MyplanetTaskLoader: Component<LoaderProps> = (props: LoaderProps) => {

  const [task, setTask] = createSignal<MyplanetTaskConfig | null>(null)

  const getTask = async(taskname: string) => {
    const isPlayground = taskname.startsWith("playground")
    const file = isPlayground ? `playgroundTemplate` : taskname
    let t = await fetch(`/myplanettasks/${file}.json`).then(r => r.json())
    if(isPlayground) {
      const tn = taskname.slice("playground-".length)
      for(let q of ["template", "templateJS"]) {
        t[q] =  t[q].replaceAll("___TEMPLATE___", tn)
        const sceneOrCollention = tn.startsWith("timelapse") ? "Collection" : "Scene"
        t[q] =  t[q].replaceAll("___SCENEORCOLLECTIONCLASS___", sceneOrCollention)
        t[q] =  t[q].replaceAll("___SCENEORCOLLECTION___", sceneOrCollention.toLowerCase())
      }
    }
    return t
  }

  createEffect(async () => {
    setTask(null)
    setTask({taskname: props.taskname, ...await getTask(props.taskname)})
  })

  return <Show when={task()} fallback={"..."}>
    <MyplanetTask {...task()!} mode={props.mode || "js"}/>
  </Show>
}
export default MyplanetTaskLoader;