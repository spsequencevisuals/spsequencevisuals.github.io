import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {designProjects} from '../lib/design-projects.mjs';
import {defaultProjects} from '../lib/portfolio-defaults.mjs';
import {projectPage} from '../lib/project-page.ts';

test('business-card and campaign versions stay together with full-size original image files',()=>{
 const cards=designProjects.find(p=>p.id==='dr-olisa-business-cards');
 assert.equal(cards.gallery.length,5);
 assert.ok(cards.gallery.some(p=>p.id==='card-front'));
 assert.ok(cards.gallery.some(p=>p.id==='card-reverse'));
 assert.equal(designProjects.find(p=>p.id==='peter-goodness-campaign').gallery.length,2);
 for(const project of designProjects){
  assert.equal(defaultProjects.filter(p=>p.id===project.id).length,1);
  for(const image of project.gallery||[{media:project.media}]){
   assert.match(image.media,/\.(jpg|png)$/);
   const file=fileURLToPath(new URL('../public'+image.media,import.meta.url));
   assert.ok(existsSync(file));
   assert.ok(readFileSync(file).byteLength>100000);
  }
  assert.ok(!Object.keys(project).some(key=>/price|cost|fee/i.test(key)));
 }
});

test('design collections use artwork labels while photography retains its correct credit',()=>{
 const design=projectPage({...designProjects.find(p=>p.id==='worship-and-wonders'),status:'published'},'https://example.com');
 assert.match(design,/2 ARTWORKS · GRAPHIC DESIGN/);
 assert.match(design,/Open artwork 2 of 2/);
 assert.doesNotMatch(design,/PHOTOGRAPHY &amp; PHOTO EDITING|PHOTOGRAPHY & PHOTO EDITING|2 photographs|A moment, remembered/);
 const photo=projectPage({...defaultProjects.find(p=>p.id==='mirabel-first-birthday'),status:'published'},'https://example.com');
 assert.match(photo,/8 PHOTOGRAPHS · PHOTOGRAPHY & PHOTO EDITING/);
 assert.match(photo,/Open photo 8 of 8/);
 assert.doesNotMatch(photo,/mrs-maria-portrait-/);
});
