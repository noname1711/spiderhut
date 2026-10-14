import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
const files=['math.js','quality.js','renderer.js','world.js','physics.js','fx.js','camera.js','main.js'];
let out='/* THE LAST SWING 3D - self-contained browser bundle - no dependencies */\n"use strict";\nconst GIFT = window.GIFT;\n';
for(const f of files){
  let src=fs.readFileSync(new URL('../src/'+f,import.meta.url),'utf8');
  src=src.replace(/^import .*?;\s*$/gm,'').replace(/\bexport\s+(?=(?:const|let|function|class)\b)/g,'');
  out+='\n// ===== '+f+' =====\n'+src+'\n';
}
const destination=new URL('../game.bundle.js',import.meta.url);
fs.writeFileSync(destination,out);
// The custom bundler flattens module scopes: duplicate top-level declarations can break startup.
// Check the *generated bundle*, not only the source modules, before shipping.
try {
  execFileSync(process.execPath,['--check',destination.pathname],{encoding:'utf8',stdio:'pipe'});
} catch (error) {
  console.error('ERROR: generated bundle is invalid JavaScript.');
  console.error(error.stderr?.toString() || error.message);
  process.exitCode=1;
  throw new Error('Build validation failed: game.bundle.js has a syntax error');
}
console.log('Built and syntax-checked game.bundle.js:',out.length,'bytes');
