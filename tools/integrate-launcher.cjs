// Read-only check of the generic launcher pipeline; no UI-Core code is copied.
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(process.env.SKYMP_LAUNCHER||path.join(__dirname,'../../skymp-client-launcher'));
if(process.argv.includes('--apply')) throw Error('Plugin-specific launcher patches are retired. Install the generic plugin-runtime-capable launcher once.');
if(!fs.readFileSync(path.join(root,'launcher/src-tauri/src/connection/plugin_runtime.rs'),'utf8').includes('ED25519')) throw Error('Signed plugin Runtime support is missing');
console.log('Generic signed plugin Runtime downloader exists. No files were changed or built.');
