import {database} from './database.mjs';
// Loaded only by the native Railway build; Sites keeps its real Worker bindings.
export const env=new Proxy({}, {get:(_,key)=>key==='DB'?database():key==='GROKIFY_NATIVE'?'true':process.env[key]});
