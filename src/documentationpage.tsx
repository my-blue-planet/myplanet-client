/* @refresh reload */
import { render } from 'solid-js/web';
import { StyleRegistry } from 'solid-styled';
import './index.css';
import './documentation-print.css';
import {Documentation} from "./Documentation";

render(() => <StyleRegistry><Documentation mode="python"/></StyleRegistry>, document.getElementById('root') as HTMLElement);
