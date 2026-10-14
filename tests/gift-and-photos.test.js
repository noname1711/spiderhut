import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const root=new URL('../',import.meta.url);
const read=(name)=>fs.readFileSync(new URL(name,root),'utf8');
function gift(){const context={window:{}};vm.runInNewContext(read('gift-settings.js'),context);return context.window.GIFT;}

test('personalized gift retains all six real photos, greetings and a complete ending letter',()=>{
 const g=gift();
 assert.equal(g.herName,'Thủy');
 assert.equal(g.mainTitle,'Làm tí nhện nhọ');
 assert.match(g.subtitle,/Hà Lội/);
 assert.match(g.chapters[2].place,/CHƯƠNG DƯƠNG/);
 assert.equal(g.memories.length,3);
 assert.equal(g.memories.flat().length,6);
 for(const [i,info] of g.memories.flat().entries()){
  assert.ok(info.title && info.text.length>40);
  assert.equal(info.photo,`./photos/${i+1}.jpeg`);
  assert.ok(fs.statSync(new URL(info.photo,root)).size>10000);
 }
 assert.match(g.finalTitle,/GỬI THỦY/);
 assert.ok(Array.isArray(g.finalLetter) && g.finalLetter.length>=3);
 assert.ok(g.finalLetter.every(line=>typeof line==='string'&&line.length>15));
});

test('ending never assumes custom fields are populated, and replay is available',()=>{
 const main=read('src/main.js');
 assert.match(main,/Array\.isArray\(GIFT\.finalLetter\)/);
 assert.match(main,/DEFAULT_FINAL_LETTER/);
 assert.match(main,/if\(mode==='ending'\)return/);
 assert.match(main,/btn\('ĐU LẠI','restart'\)/);
 assert.match(main,/s\?\.distance>=ROUTE_LENGTH/);
 assert.match(main,/GIFT\.mainTitle/);
});

test('photo cards never crop images and adapt to portrait and short landscape viewports',()=>{
 const css=read('src/style.css');
 assert.match(css,/\.memory-visual \.memory-photo\{[^}]*object-fit:contain/);
 assert.match(css,/@media \(max-width:720px\)/);
 assert.match(css,/@media \(max-height:580px\) and \(orientation:landscape\)/);
 assert.match(css,/\.memory-layout\{display:grid/);
 assert.match(read('src/main.js'),/class="memory-layout/);
});
