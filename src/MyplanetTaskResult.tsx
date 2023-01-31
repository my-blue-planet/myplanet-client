import {Component} from 'solid-js';

interface MyplanetTaskResultProps {
  ref: HTMLDivElement
}

const MyplanetTaskResult: Component<MyplanetTaskResultProps> = (props: MyplanetTaskResultProps) => {
  return <div class="myplanet_result_static" ref={props.ref}/>
}

export default MyplanetTaskResult;


