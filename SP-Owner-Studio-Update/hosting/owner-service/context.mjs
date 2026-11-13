import {AsyncLocalStorage} from 'node:async_hooks';
export const context=new AsyncLocalStorage();
export const env=new Proxy({}, {get(_target,key){const value=context.getStore()?.env;if(!value)throw new Error('No request context');return value[key];}});
export function currentOwner(){return context.getStore()?.owner||null;}

