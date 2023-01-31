import {Component, createSignal, Index, onMount, Suspense} from 'solid-js';

const AppWelcome: Component = () => {
  return <>
    <div class="main">
      <img class="logo" src="/img/myplanet1.png"/>
      <h1>MyPlanet </h1>
      <a class="linkToMain" href="./main.html">explore the world using code</a>
      <div>
        <img class="previews" src="/img/images2.png"/>
      </div>
    </div>
    <footer>
      <img class="logos" src="/img/EarthEngineLogo.png"/>
      <img class="logos" src="/img/nasa-logo.png"/>
      <img class="logos" src="/img/esa-logo.png"/>
      <a href="https://github.com/my-blue-planet" title="Visit this project on GitHub"><img class="logos github" src="/img/GitHubLogo.png"/></a>

    </footer>
    <style jsx>{`
      .logo {height: 3.5em;}
      h1 {margin-top: 0; color: #cde;}
      .main {text-align: center; padding-top: 10vh;}
      .previews {width: 100vmin;}
      footer {
        position: absolute;
        bottom: 0.5em;
        text-align: center;
        width: 100%;
      }
      .linkToMain {
        background-color: #0006;
        color: #cde;
        padding: 0.4em;
        font-size: 1.2em;
        display: inline-block;
        text-decoration: none;
        margin: 0 0 1em 0; 
        border: none;
        cursor: pointer;
      }
      .linkToMain:hover {
        color: #fff;
      }
      footer>* {margin: 0 1.5em; display: inline-block;}
      .logos {height: 8vmin; filter: grayscale(0.72);}
      .logos.github {filter: invert(); opacity: 0.5;}
    `}</style>
  </>
}

export default AppWelcome;


