// The client/UI module belongs to the plugin, not to Data/Platform/UI or a launcher EXE.
const path=require('node:path');
const manifest=require('../plugin.json');
require('./plugin-runtime/package.cjs').verifyRuntimePackage(path.join(__dirname,'../release/SkyMPUICore/Runtime'),manifest);
require('./package.cjs');
