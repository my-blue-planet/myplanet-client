import {Component, createEffect, createSignal, JSXElement, onCleanup, onMount} from "solid-js";
import {Editor} from "3e8-editor";

interface DocumentationProps {
	mode: "python" | "javascript"
}

export const Documentation: Component<DocumentationProps> = (props) => {

	// const Code: Component<{code: string, mode: "python" | "javascript"}> = ({code}) => {
	// 	let element: HTMLDivElement
	// 	createEffect(()=>{
	// 		new Editor({
	// 			element,
	// 			mode,
	// 			readOnly: true,
	// 			showGutter: false,
	// 			code,
	// 			theme: "monokai",
	// 			minLines: 0
	// 		})
	// 	})
	// 	return <div class="documentation-editor" ref={element!}></div>
	// }

	const objectPart = (objvar: string, objmember: string) => {
		return <span class="objpart">
			<span class="objvar">{objvar}.</span><span class="objmember">{objmember}</span>
		</span>
	}

	interface IMember {obj: string, name: string, aliases?: string[], description: JSXElement}
	const renderMember = ({obj, name, description, aliases}: IMember) => {
		return <div class={`member ${obj}`}>
			<div class="membertitle">{objectPart(obj, name)}</div>
			<div class="caption">
				<span class="description">{description}</span>{" "}
				{aliases && <span class="aliases">
					{aliases.length === 1 && <span>alias:&nbsp;{objectPart(obj, aliases[0])}</span>}
					{aliases.length > 1 && <span>aliases:&nbsp;{aliases.map(a=>objectPart(obj, a))}</span>}
				</span>}
			</div>
		</div>
	}

	return <>
		<div class="container">
			<h1>MyPlanet Library</h1>
			<div class="classbox">
				<h3>Laden der Geodaten</h3>
				{props.mode === "javascript" && <>
					<div class="code">
						<span class="keyword">let</span>&nbsp;{"{"}Scene{"}"}&nbsp;<span class="keyword">=</span>&nbsp;<span class="objmember">myplanet</span>
						<span class="comment">// laden der Bibliothek</span>
					</div>
					<div class="code"><span class="keyword">let</span>&nbsp;scene&nbsp;<span class="keyword">=&nbsp;await</span>&nbsp;Scene.<span class="objmember">load</span>(<span class="codestring">"switzerland.json"</span>)</div>
				</>}
				{props.mode === "python" && <>
					<div class="code">
						<span class="keyword">from</span>&nbsp;<span class="objmember">myplanet</span>&nbsp;<span class="keyword">import</span>&nbsp;Scene
						<span class="comment"># laden der Bibliothek</span>
					</div>
					<div class="code">scene&nbsp;<span class="keyword">=&nbsp;</span>Scene.<span class="objmember">load</span>(<span class="codestring">"switzerland.json"</span>)</div>
				</>}
			</div>

			<div class="classbox">
				<h3>class <dfn>Scene</dfn></h3>
				{renderMember({obj: "scene", name: "getWidth()", description: "liefert die Breite in Pixel", aliases: ["W"]})}
				{renderMember({obj: "scene", name: "getHeight()", description: "liefert die Höhe in Pixel", aliases: ["H"]})}
				{renderMember({obj: "scene", name: "getDimensions()", description: "gibt Breite und Höhe an"})}
				{renderMember({obj: "scene", name: "contains(x, y)", description: "prüft, ob die Pixel-Koordinaten (x, y) im Bild sind."})}
				{renderMember({obj: "scene", name: "getPixel(x, y)", description: "liefert das Pixel-Object an der Stelle (x, y)"})}
				{renderMember({obj: "scene", name: "getPixels()", description: "liefert der Reihe nach alle Pixel", aliases: ["pixels"]})}
				{renderMember({obj: "scene", name: "getPixelSize()", description: "liefert die Seitenlänge eines Pixels (in der Bildmitte) in Metern"})}
				{renderMember({obj: "scene", name: "addOverlay(label)", description: <>fügt ein Overlay hinzu{props.mode === "javascript" && " (asynchron)"}</>})}
			</div>

			<div class="classbox">
				<h3>class <dfn>Pixel</dfn></h3>
				<div class="explanation">Folgende Kanäle können gelesen und geschrieben werden (falls sie in der <dfn>Scene</dfn> vorhanden sind):</div>
				{renderMember({obj: "pixel", name: "r", description: "Roter Bereich des sichtbaren Spektrums", aliases: ["R", "red", "rot"]})}
				{renderMember({obj: "pixel", name: "g", description: "Grüner Bereich des sichtbaren Spektrums", aliases: ["G", "green", "gruen"]})}
				{renderMember({obj: "pixel", name: "b", description: "Roter Bereich des sichtbaren Spektrums", aliases: ["B", "blue", "blau"]})}
				{renderMember({obj: "pixel", name: "a", description: "Deckkraft (Alpha-Kanal, existiert nur in Overlays)", aliases: ["A", "alpha"]})}
				{renderMember({obj: "pixel", name: "elevation", description: "Höhe über Meer (in Meter)", aliases: ["H", "h", "hoehe"]})}
				{renderMember({obj: "pixel", name: "country", description: "Nr. des Landes (s.Karte)", aliases: ["c", "land"]})}
				{renderMember({obj: "pixel", name: "pop", description: "Bevölkerungdichte", aliases: ["p"]})}
				{renderMember({obj: "pixel", name: "nox", description: "Stickoxidbelastung (NOx)", aliases: ["NOx", "NOX"]})}
				{renderMember({obj: "pixel", name: "night", description: "Nächtliche Lichtemission in μW/m²", aliases: ["nightlights", "l", "L"]})}
				<div class="explanation">Folgende Eigenschaften können nur gelesen werden:</div>
				{renderMember({obj: "pixel", name: "x", description: "x-Koordinate des Pixels innerhalb des Bildes (in Pixel)"})}
				{renderMember({obj: "pixel", name: "y", description: "y-Koordinate des Pixels innerhalb des Bildes (in Pixel)"})}
				{renderMember({obj: "pixel", name: "size", description: "Seitenlänge des Pixels in Metern", aliases: ["getSizeInMeters()"]})}
			</div>

			<div class="classbox">
				<h3>class <dfn>Overlay</dfn></h3>
				<div class="explanation">Dies ist eine Unterklasse von <dfn>Scene</dfn>, hat aber nur die Kanäle r, g, b, a</div>
				{renderMember({obj: "overlay", name: "addMarker(x, y)", description: "erstellt eine Markierung beim Punkt (x, y)"})}
				{renderMember({obj: "overlay", name: "label", description: "liefert die Bezeichnung des Overlays"})}
			</div>

			<div class="classbox">
				<h3>class <dfn>Collection</dfn></h3>
				<div class="explanation">Dies ist eine Serie von <dfn>Scene</dfn>-Objekten (z.B. Jahre)</div>
				{renderMember({obj: "coll", name: "getScenes()", description: <>liefert der Reihe nach alle <dfn>Scene</dfn>-Objekte</>, aliases: ["scenes"]})}
				{renderMember({obj: "coll", name: "forceFrame(scene)", description: <>blättert die Ansicht zur gewünschten <dfn>Scene</dfn></>, aliases: ["forceFrame(label)"]})}
				{renderMember({obj: "coll", name: "addOverlay(label)", description: <>fügt ein Overlay hinzu{props.mode === "javascript" && " (asynchron)"}</>})}
			</div>

		</div>

		<style jsx>{`
    .container {
      max-width: var(--wleft, 800px);
      font-size: max(0.6em, calc(0.026 * var(--wleft, 800)));
      padding: 0.5em;
      margin: 0 auto;
      --classboxframe: #446688;
      --codebackground: rgb(39, 34, 34);
			--neutralcolor: #2c3e50;
			--borderwidth: 0.2em;
    }
    h2, h3 {
      margin-top: 0.5em;
      margin-bottom: 0.2em;
    }
    .classbox {
    	margin-top: 1em;
      margin-bottom: 0.6em;
    	border: var(--borderwidth) solid var(--classboxframe);
    	background-color: var(--neutralcolor);
    }
    
    .classbox h3 {
    	background-color: var(--classboxframe);
    	padding: 0.1em var(--borderwidth);
    	margin: 0;
    }
    .member, .code {
    	display: flex;
    	padding: 0.1em var(--borderwidth);
    	background-color: var(--codebackground);
    }
    //.member+.member, .code+.code {
    //	margin-top: 0.2em;
    //}
    .explanation {
     	font-size: 0.8em;
    	padding: 0.3em var(--borderwidth) 0.2em var(--borderwidth);
    	background-color: var(--neutralcolor);
    }
    .membertitle  {
    	width: 13em;
    	flex-shrink: 0;
    }
    .pixel .membertitle  {
    	width: 9em;
    	flex-shrink: 0;
    }
    .caption {
    	font-size: 0.8em;
    	padding-top: 0.3em;
    }
    .description {
    	flex-grow: 1;
    	vertical-align: baseline;
    }
    .aliases {
    	background-color: #fff2;
    	font-size: 0.9em;
    	padding: 0 0em 0.1em 0.3em;
    	border-radius: 0.2em;
    }
    .aliases .objpart {
    	margin-right: 0.4em;
    	background-color: var(--codebackground);
    	padding: 0 0.2em;
    	border-radius: 0.2em;
    }
    .objpart, .code {font-family: Monospaced, monospace;}
    .objvar {opacity: 0.5; font-size: 0.9em;}
    .keyword {color: #eb9;}
    .codestring {color: #ee8;}
    .objmember {color: #adf; font-weight: 1.2;}
    .comment {margin-left: 2em; color: #aaa;}
    :global(.documentation-editor .ace_cursor) {opacity: 0 !important;}
		`}</style>
	</>
};