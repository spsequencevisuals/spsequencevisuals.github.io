import { AsyncLocalStorage } from 'node:async_hooks';

const contexts = new AsyncLocalStorage();

export function runWithBackgroundTasks(context, run) {
  return contexts.run(context, run);
}

export async function keepAlive(task) {
  const context = contexts.getStore();
  if (context?.waitUntil) context.waitUntil(task);
  else await task;
}
