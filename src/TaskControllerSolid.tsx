import {ITaskControllerConfig, TaskController} from "3e8-taskcontroller";
import "3e8-taskcontroller/style.css"
import {IRunConfig} from "3e8-run-python-skulpt";
import {createEffect, onCleanup, onMount} from "solid-js";
import {TMode} from "3e8-editor";

export interface TaskControllerSolidProps {
	runConfig: Partial<IRunConfig>
	template: string
	taskname: string
	solution?: string
	beforeCode?: string
	afterCode?: string
	mode?: TMode
	width?: number
}

export const TaskControllerSolid = (props: TaskControllerSolidProps) => {
	let tc: TaskController
	let tcref: HTMLDivElement

	createEffect(()=>{
		const taskConfig: ITaskControllerConfig = {
			mode: props.mode || "python",
			taskname: props.taskname,
			template: props.template,
			element: tcref,
			solution: props.solution || "",
			runConfig: props.runConfig,
			beforeCode: props.beforeCode,
			afterCode: props.afterCode
		}
		if(tc) tc.quit()
		tc = new TaskController(taskConfig)
	})

	createEffect(()=>props.width && tc.resize())

	return <div ref={tcref!}>Eddy</div>
}