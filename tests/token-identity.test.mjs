import test from 'node:test';
import assert from 'node:assert/strict';
import {tokenIdentitySchema,tokenImage} from '../lib/token-identity.ts';
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lZkAAAAASUVORK5CYII=';
test('valid token identity preserves the submitted artwork',()=>{
 const value=tokenIdentitySchema.parse({name:' Orbit ',symbol:'ORB',image});
 assert.equal(value.name,'Orbit');assert.equal(tokenImage(value.image).type,'image/png');
});
test('rejects active images, fake MIME types and oversized images',()=>{
 assert.equal(tokenIdentitySchema.safeParse({name:'Orbit',symbol:'ORB',image:'data:image/svg+xml;base64,PHN2Zz4='}).success,false);
 assert.throws(()=>tokenImage('data:image/png;base64,SGVsbG8='));
 assert.throws(()=>tokenImage('data:image/png;base64,'+Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),Buffer.alloc(48000)]).toString('base64')));
});
test('rejects token identity outside launch provider limits',()=>{
 for(const change of [{name:'x'.repeat(33)},{symbol:'a b'},{symbol:'A'},{symbol:'A'.repeat(11)}])assert.equal(tokenIdentitySchema.safeParse({name:'Orbit',symbol:'ORB',image,...change}).success,false);
});
