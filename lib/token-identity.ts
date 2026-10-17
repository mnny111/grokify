import {z} from 'zod';
export const tokenIdentitySchema=z.object({
 name:z.string().trim().min(2).max(32),
 symbol:z.string().trim().min(2).max(10).regex(/^[A-Z0-9]+$/),
 image:z.string().max(65000).regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/)
});
export function tokenImage(data:string){
 const match=data.match(/^data:image\/(png|jpeg|webp);base64,(.+)$/);
 if(!match)throw new Error('Choose a PNG, JPEG or WebP image.');
 const bytes=Buffer.from(match[2],'base64'),type=match[1];
 const valid=type==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):type==='jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP';
 if(!valid||bytes.length>48000)throw new Error('Invalid image or image is too large.');
 return {bytes,type:'image/'+type,filename:'token.'+(type==='jpeg'?'jpg':type)};
}
