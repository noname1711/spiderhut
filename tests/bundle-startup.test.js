import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('generated browser bundle parses as one classic script without scope collisions',()=>{
 const source=fs.readFileSync(new URL('../game.bundle.js',import.meta.url),'utf8');
 assert.doesNotThrow(()=>new vm.Script(source,{filename:'game.bundle.js'}));
});

test('browser can display startup errors instead of an empty card',()=>{
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/window\.addEventListener\('error'/);
 assert.match(html,/Lỗi tải hoặc thực thi JavaScript/);
});
