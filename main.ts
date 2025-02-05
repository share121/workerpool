// deno-lint-ignore-file no-explicit-any
export function exec<T, R>(
  threadCount: number,
  workerFactory: () => Worker,
  data: T[],
  maxRetries: number = 3
) {
  if (data.length < 1) return Promise.resolve([]);
  if (threadCount < 1) throw new Error("threadCount must be greater than 0");
  return new Promise<{ origin: T; data: R }[]>((resolve, reject) => {
    const baseChunkCount = Math.floor(data.length / threadCount);
    const remainingChunks = data.length % threadCount;
    const results: { origin: T; data: R }[] = [];
    const workerPool: WorkerData[] = [];
    let activeWorkers = 0;
    for (let i = 0; i < threadCount; i++, activeWorkers++) {
      const startChunk = i * baseChunkCount + Math.min(i, remainingChunks);
      if (startChunk >= data.length) break;
      const endChunk =
        startChunk + baseChunkCount + (i < remainingChunks ? 1 : 0);
      const workerData = (workerPool[i] = {
        worker: workerFactory(),
        startChunk,
        endChunk,
        currentChunk: startChunk,
        retryCount: 0,
        stolen: false,
      } as WorkerData);
      const initialChunk = data.slice(startChunk, endChunk);
      workerData.worker.postMessage(initialChunk);
      const messageHandle = (e: MessageEvent<R>) => {
        workerData.retryCount = 0;
        results[workerData.currentChunk] = {
          origin: data[workerData.currentChunk],
          data: e.data,
        };
        workerData.currentChunk++;
        if (workerData.currentChunk < workerData.endChunk) return;
        if (workerData.stolen) {
          workerData.worker.terminate();
          workerData.worker = workerFactory();
          workerData.worker.onmessage = messageHandle;
          workerData.worker.onerror = errorHandel;
          workerData.stolen = false;
        }
        // 任务窃取逻辑
        let maxRemain = 0;
        let targetWorkerIndex = -1;
        for (let j = 0; j < workerPool.length; j++) {
          if (!(j in workerPool) || j === i) continue;
          const w = workerPool[j];
          const remaining = w.endChunk - w.currentChunk - 1;
          if (remaining > maxRemain) {
            maxRemain = remaining;
            targetWorkerIndex = j;
          }
        }
        if (maxRemain < 1) {
          delete workerPool[i];
          workerData.worker.terminate();
          activeWorkers--;
          if (activeWorkers === 0) resolve(results);
          return;
        }
        console.log(`Worker ${i} stole from ${targetWorkerIndex}`);
        // 分割任务
        const targetWorker = workerPool[targetWorkerIndex];
        targetWorker.stolen = true;
        const splitPoint = Math.ceil(
          (targetWorker.currentChunk + targetWorker.endChunk) / 2
        );
        workerData.endChunk = targetWorker.endChunk;
        targetWorker.endChunk = splitPoint;
        workerData.startChunk = splitPoint;
        workerData.currentChunk = splitPoint;
        const newChunk = data.slice(splitPoint, workerData.endChunk);
        workerData.worker.postMessage(newChunk);
      };
      const errorHandel = (err: ErrorEvent) => {
        if (workerData.retryCount < maxRetries) {
          workerData.retryCount++;
          workerData.worker.terminate(); // 终止旧Worker
          workerData.worker = workerFactory(); // 创建新Worker
          workerData.worker.postMessage(
            data.slice(workerData.currentChunk, workerData.endChunk)
          );
          // 重新绑定消息和错误处理
          workerData.worker.onmessage = messageHandle; // 需确保正确绑定
          workerData.worker.onerror = errorHandel;
          workerData.stolen = false;
        } else {
          for (let i = 0; i < workerPool.length; i++) {
            if (i in workerPool) workerPool[i].worker.terminate();
          }
          reject(err);
        }
      };
      workerData.worker.onmessage = messageHandle;
      workerData.worker.onerror = errorHandel;
    }
  });
}

interface WorkerData {
  worker: Worker;
  startChunk: number;
  endChunk: number;
  currentChunk: number;
  retryCount: number;
  stolen: boolean;
}

const workerFactory = () => {
  return new Worker(new URL("./worker.ts", import.meta.url).href, {
    type: "module",
  });
};

function exec2(_a: any, _b: any, data: number[]) {
  return data.map((item) => fib(item));
}

function exec3<T, R>(
  threadCount: number,
  workerFactory: () => Worker,
  data: T[]
) {
  if (data.length < 1) return Promise.resolve([]);
  if (threadCount < 1) throw new Error("threadCount must be greater than 0");
  return new Promise<{ origin: T; data: R }[]>((resolve, reject) => {
    const baseChunkCount = Math.floor(data.length / threadCount);
    const remainingChunks = data.length % threadCount;
    const results: { origin: T; data: R }[] = [];
    const workerPool: WorkerData[] = [];
    let activeWorkers = 0;
    for (let i = 0; i < threadCount; i++, activeWorkers++) {
      const startChunk = i * baseChunkCount + Math.min(i, remainingChunks);
      if (startChunk >= data.length) break;
      const endChunk =
        startChunk + baseChunkCount + (i < remainingChunks ? 1 : 0);
      const workerData = (workerPool[i] = {
        worker: workerFactory(),
        startChunk,
        endChunk,
        currentChunk: startChunk,
        retryCount: 0,
        stolen: false,
      } as WorkerData);
      const initialChunk = data.slice(startChunk, endChunk);
      workerData.worker.postMessage(initialChunk);
      const messageHandle = (e: MessageEvent<R>) => {
        workerData.retryCount = 0;
        results[workerData.currentChunk] = {
          origin: data[workerData.currentChunk],
          data: e.data,
        };
        workerData.currentChunk++;
        if (workerData.currentChunk < workerData.endChunk) return;
        delete workerPool[i];
        workerData.worker.terminate();
        activeWorkers--;
        if (activeWorkers === 0) resolve(results);
        return;
      };
      workerData.worker.onmessage = messageHandle;
    }
  });
}

async function fn(thread: number, len: number, i: number) {
  console.log(`thread: ${thread}, len: ${len}, i: ${i}`);
  const data = Array.from({ length: len }, (_, i) => i + 1);
  console.time("exec" + i);
  const _res = await exec3(thread, workerFactory, data);
  console.timeEnd("exec" + i);
  console.log(_res);
}

async function main() {
  // for (let i = 0; i < 100; i++) {
  //   await fn(getRandomInt(1, 39), getRandomInt(0, 40), i);
  // }
  await fn(8, 45, 0);
}

if (import.meta.main) {
  main();
}

function fib(n: number): number {
  if (n <= 1) return n;
  return fib(n - 1) + fib(n - 2);
}

function getRandomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
