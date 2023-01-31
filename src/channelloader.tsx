/* @refresh reload */
import { render } from 'solid-js/web';
import { StyleRegistry } from 'solid-styled';
import './index.css';
import ChannelLoaderApp from './ChannelLoadApp';

render(() => <StyleRegistry><ChannelLoaderApp/></StyleRegistry>, document.getElementById('root') as HTMLElement);
