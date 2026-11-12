import test from 'node:test';
import assert from 'node:assert/strict';
import { validateRequest, requireSameOrigin, isOwner } from '../lib/request-data.mjs';
const valid={idempotencyKey:'8f003fc2-a334-43af-92ca-97096e86fd21',intent:'order',name:' A Client ',email:'CLIENT@example.com',service:'Video editing',details:'A launch promo for a new product.'};
const validate=data=>validateRequest(data,'2026-10-27');
test('valid requests retain the brief and normalize contact fields',()=>{const result=validate(valid);assert.equal(result.name,'A Client');assert.equal(result.email,'client@example.com');assert.equal(result.details,valid.details);assert.equal(result.preferredDate,'');});
test('sessions require a real present or future date; orders can omit it',()=>{assert.throws(()=>validate({...valid,intent:'session'}));assert.throws(()=>validate({...valid,intent:'session',preferredDate:'2026-02-30'}));assert.throws(()=>validate({...valid,intent:'session',preferredDate:'2026-10-26'}));assert.equal(validate({...valid,intent:'session',preferredDate:'2026-10-27',preferredTime:'14:30'}).preferredTime,'14:30');assert.throws(()=>validate({...valid,preferredTime:'26:10'}));});
test('rejects malformed contacts, forged choices, bot traps and excessive input',()=>{for(const change of [{idempotencyKey:'bad'},{email:'bad'},{service:'Free money'},{intent:'paid'},{website:'bot.example'},{details:'x'.repeat(5001)},{name:['bad']},{email:'a@example.com\r\nBCC:x@example.com'}])assert.throws(()=>validate({...valid,...change}));});
test('reference links reject executable schemes and embedded credentials',()=>{assert.equal(validate({...valid,referenceUrl:'https://example.com/brief'}).referenceUrl,'https://example.com/brief');for(const link of ['javascript:alert(1)','data:text/html,hello','https://name:password@example.com/'])assert.throws(()=>validate({...valid,referenceUrl:link}));});
test('only same-origin browser writes are accepted',()=>{requireSameOrigin(new Request('https://studio.example/api/requests',{headers:{Origin:'https://studio.example'}}));assert.throws(()=>requireSameOrigin(new Request('https://studio.example/api/requests',{headers:{Origin:'https://other.example'}})));assert.throws(()=>requireSameOrigin(new Request('https://studio.example/api/requests')));});
test('approved studio accounts require a platform user identity',()=>{
 for(const email of ['spsequencevisuals@gmail.com','digitaldreamshub2020@gmail.com']){
  assert.equal(isOwner({userId:'site-scoped-account-id',email}),true);
  assert.equal(isOwner({userId:'site-scoped-account-id',email:email.toUpperCase()}),true);
  for(const userId of [undefined,null,'',' ',123])assert.equal(isOwner({userId,email}),false);
 }
 assert.equal(isOwner(null),false);
 for(const email of ['client@example.com','spsequencevisuals@gmail.com.attacker.test','spsequencevisuals+other@gmail.com','spsequencevisuals@gmail.co',undefined,{}])assert.equal(isOwner({userId:'other',email}),false);
});
