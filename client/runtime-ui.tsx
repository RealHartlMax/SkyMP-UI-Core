import React from 'react';
import { UiCoreHost } from './host';
declare const window: any;
window.SkyMPPluginRuntime.register({ pluginId: 'skymp-ui-core', apiVersion: 1, mount(ctx: any) {
  ctx.mountReact(React.createElement(UiCoreHost));
} });
