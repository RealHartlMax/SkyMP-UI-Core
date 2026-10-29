// Source compatibility check only. Never copy plugin templates into the shared CEF build.
const fs=require('node:fs'),path=require('node:path');
const fork=path.resolve(process.env.SKYMP_FORK||path.join(__dirname,'../../skymp'));
if(process.argv.includes('--apply')) throw Error('Plugin source copying is retired. Install the signed SkyMPUICore/Runtime package instead.');
for(const [file,marker] of [['skymp5-client/src/services/services/pluginRuntimeLoader.ts','SkyMPPluginRuntimeLoader/v1'],['skymp5-front/src/features/pluginRuntime/index.js','SkyMPPluginUiHost/v1']]) {
  if(!fs.readFileSync(path.join(fork,file),'utf8').includes(marker)) throw Error('Shared Runtime API 1 bootstrap is missing: '+file);
}
console.log('Shared bootstrap sources support Runtime API 1. No files were changed or built.');
