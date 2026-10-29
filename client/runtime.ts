import { UiCoreBridge } from './native/uiCoreBridge';
export const apiVersion = 1;
export function activate(api: any) {
  const bridge = new UiCoreBridge(api.sp, api.controller, api.requestFocus, api.constants.CustomPacket);
  api.bindUi(bridge); api.onDismiss(() => bridge.dismiss());
  return () => { bridge.setAllowed(false); bridge.dismiss(); };
}
