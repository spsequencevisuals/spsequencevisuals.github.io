import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,existsSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {defaultProjects} from '../lib/portfolio-defaults.mjs';
import {projectPage} from '../lib/project-page.ts';
import {exportPages,normalizeBase} from '../scripts/export-github-pages.mjs';

test('Black Friday is one project with three separately playable, accurately labelled versions',()=>{
 const matches=defaultProjects.filter(project=>project.id==='black-friday');assert.equal(matches.length,1);
 const p=matches[0];assert.equal(p.variants.length,1);assert.equal(p.variants[0].id,'portrait');assert.match(p.variants[0].format,/4:5/);assert.match(p.behindScenes.format,/9:16/);
 const html=projectPage({...p,status:'published'},'https://example.com');assert.equal((html.match(/<video /g)||[]).length,3);assert.match(html,/id="portrait"/);assert.match(html,/id="timeline"/);assert.match(html,/href="#portrait"/);
 const review=projectPage({...p,status:'published'},'https://example.com',true);assert.match(review,/noindex,nofollow/);assert.doesNotMatch(review,/mailto:|Start a project/);assert.match(review,/https:\/\/example.com\/view\/black-friday#portrait/);
});
test('static base paths reject traversals and support both user and project repositories',()=>{
 assert.equal(normalizeBase('/'),'/');assert.equal(normalizeBase('/sp-sequence-visuals/'),'/sp-sequence-visuals/');
 for(const value of ['../','/../','/repo/../','//host/','/repo','/bad name/','/repo/?token=1'])assert.throws(()=>normalizeBase(value));
});
test('portable subpath export preserves full media, project links, theme and enquiries without depending on the company host',()=>{
 const output=mkdtempSync(join(tmpdir(),'sp-pages-test-'));
 try{
  const result=exportPages({output,origin:'https://owner.github.io',base:'/portfolio/'});assert.equal(result.projectCount,20);
  const home=readFileSync(join(output,'index.html'),'utf8');assert.doesNotMatch(home,/__[A-Z_]+__|digitaldreamshub2020\.chatgpt\.site|href="\/studio/);assert.match(home,/src="\/portfolio\/app\.js"/);assert.match(home,/"media":"\/portfolio\/assets\/media-files\/computer-basics-educational-lesson\.mp4"/);
  const page=readFileSync(join(output,'work/black-friday/index.html'),'utf8');assert.match(page,/https:\/\/owner.github.io\/portfolio\/work\/black-friday/);assert.match(page,/https:\/\/owner.github.io\/portfolio\/assets\/black-friday-landscape-poster.webp/);assert.equal((page.match(/<video /g)||[]).length,3);
  assert.ok(existsSync(join(output,'assets/media-files/computer-basics-educational-lesson.mp4')));assert.ok(existsSync(join(output,'view/black-friday/index.html')));
  const features=readFileSync(join(output,'features.js'),'utf8');assert.doesNotMatch(features,/fetch\('\/api\/requests'|saved in SP/);
  assert.doesNotMatch(home,/details and brief are saved privately/);assert.match(readFileSync(join(output,'booking.js'),'utf8'),/spsequencevisuals@gmail.com/);
  const manifest=JSON.parse(readFileSync(join(output,'manifest.webmanifest'),'utf8'));assert.equal(manifest.scope,'/portfolio/');assert.ok(manifest.icons.every(icon=>icon.src.startsWith('/portfolio/')));
  assert.doesNotMatch(readFileSync(join(output,'app.js'),'utf8'),/digitaldreamshub2020/);
 }finally{rmSync(output,{recursive:true,force:true});}
});
