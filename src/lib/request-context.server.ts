import { AsyncLocalStorage } from "node:async_hooks";

export interface WorkerExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

const executionContextStorage = new AsyncLocalStorage<WorkerExecutionContext>();

export function runWithWorkerExecutionContext<T>(
  context: unknown,
  task: () => Promise<T>,
): Promise<T> {
  const candidate = context as Partial<WorkerExecutionContext> | null;
  if (!candidate || typeof candidate.waitUntil !== "function") return task();
  return executionContextStorage.run(candidate as WorkerExecutionContext, task);
}

export function getWorkerExecutionContext(): WorkerExecutionContext | undefined {
  return executionContextStorage.getStore();
}