/* @refresh reload */
import { render } from 'solid-js/web';
import { StyleRegistry } from 'solid-styled';
import './index.css';
import AppWelcome from './AppWelcome';

render(() => <StyleRegistry><AppWelcome/></StyleRegistry>, document.getElementById('root') as HTMLElement);
