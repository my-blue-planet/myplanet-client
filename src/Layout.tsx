import {Component, createSignal, onMount, JSX, onCleanup} from 'solid-js';

interface LayoutProps {
  left: JSX.Element
  right: JSX.Element
  resizeHandler?: (newWidth: number)=>void
}

export const Layout: Component<LayoutProps> = (props: LayoutProps) => {

  let layoutwrapperEl: HTMLDivElement

  const [isResizing, setResizing] = createSignal<boolean>(false)
  const [wleft, setWleft] = createSignal<number>(window.innerWidth/2)

  const onWindowResize = (e: Event)=>setWleft(window.innerWidth/2)
  onMount(()=>window.addEventListener("resize", onWindowResize))
  onCleanup(()=>window.removeEventListener("resize", onWindowResize))

  const stopResizing = () => setResizing(false)

  const resize = (e: PointerEvent) => {
    if(isResizing()) {
      if(e.pointerType==="mouse" && e.buttons!==1) {
        stopResizing()
      }
      var clientRect = layoutwrapperEl.getBoundingClientRect();
      let w = e.clientX - clientRect.left - 5;
      w = Math.min(w, clientRect.width - 10);
      w = Math.max(w, 100);
      setWleft(w)
      if(props.resizeHandler) props.resizeHandler(w)
      //resizeKids();
    }
  }

  return <><div
    class="layoutwrapper" ref={layoutwrapperEl!}
    style={{"--wleft": `${wleft()}px`, "--gtcsplitter": `var(--wleft) 1em 1fr`}}
    onPointerMove={resize}
    onPointerUp={stopResizing} onPointerLeave={stopResizing}
  >
    <div class="leftcolumn">
      {props.left}
    </div>
    <div class="splitbar" draggable={false} onPointerDown={()=>setResizing(true)}></div>
    <div class={"rightcolumn" + " " + (isResizing() ? "ignorePointerEvents" : "")}>
      {props.right}
    </div>
  </div>
  <style jsx>{`
    .layoutwrapper {
      --gtcsplitter: 1fr 1em 1fr;
      display: grid;
      width: 100%;
      grid-template-columns: var(--gtcsplitter);
      --hmain: calc(100vh - 50px);
      --hcolumnheader: 40px;
      height: var(--hmain);
      background-color: #1b2028;
    }

    :global(.myplanet_result_static) {
      height: calc(var(--hmain) - var(--hcolumnheader));
    }


    :global(.eddy) {
      --framecolor: #1b2028;
    }
    :global(.solution.wrap) {
      right: 0;
      left: unset;
      width: 80%;
      padding: 0.2em;
    }

    @media screen
    and (max-device-width: 500px)
    and (orientation: portrait) {
      .layoutwrapper {
        grid-template-columns: 1fr;
        grid-template-rows: 1fr 1fr;
        --hmain: auto;
        --wleft: 100% !important;
      }

      :global(.eddy) {
        height: auto;
      }

      .splitbar {
        display: none;
      }
    }

    .leftcolumn {
      display: grid;
      height: var(--hmain);
      width: var(--wleft);
    }

    .splitbar {
      cursor: col-resize;
      user-select: none;
      -moz-user-select: none;
      -webkit-user-select: none;
      -ms-user-select: none;
      background-color: #2c3e50;
      background-image: url(/img/menu/resize-handle.png);
      background-repeat: no-repeat;
      background-position: center;
      /*border-right: 1px solid #d4d4d4;*/
      /*border-left: 1px solid #d4d4d4;*/
      height: var(--hmain);
      z-index: 10;
    }

    .rightcolumn {
      height: var(--hmain);
    }

    .ignorePointerEvents {
      pointer-events: none;
    }
  `}</style>
  </>
};

