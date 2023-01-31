/* @refresh reload */
import { render } from 'solid-js/web';
import { StyleRegistry } from 'solid-styled';
import './index.css';
import App from './App';

render(() => <StyleRegistry><App /></StyleRegistry>, document.getElementById('root') as HTMLElement);
