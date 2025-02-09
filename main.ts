// deno-lint-ignore-file ban-ts-comment
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
      printWorkerData(workerData, i);
      const initialChunk = data.slice(startChunk, endChunk);
      const messageHandle = (e: MessageEvent<R>) => {
        // Deno 不能在主线程中捕获错误，所以这是折中的办法 start
        // @ts-ignore
        if (e.data?.type === "error") {
          // @ts-ignore
          return errorHandel(e.data);
        }
        // Deno 不能在主线程中捕获错误，所以这是折中的办法 end
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
          workerData.worker.addEventListener("message", messageHandle);
          workerData.worker.addEventListener("error", errorHandel);
          workerData.stolen = false;
        }
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
        const targetWorker = workerPool[targetWorkerIndex];
        printWorkerData(workerData, i);
        printWorkerData(targetWorker, targetWorkerIndex);
        targetWorker.stolen = true;
        const splitPoint = Math.ceil(
          (targetWorker.currentChunk + targetWorker.endChunk) >>> 1
        );
        workerData.endChunk = targetWorker.endChunk;
        workerData.currentChunk =
          workerData.startChunk =
          targetWorker.endChunk =
            splitPoint;
        const newChunk = data.slice(splitPoint, workerData.endChunk);
        printWorkerData(workerData, i);
        printWorkerData(targetWorker, targetWorkerIndex);
        workerData.worker.postMessage(newChunk);
      };
      const errorHandel = (err: ErrorEvent) => {
        if (workerData.retryCount >= maxRetries) {
          for (let i = 0; i < workerPool.length; i++) {
            if (i in workerPool) workerPool[i].worker.terminate();
          }
          return reject(err);
        }
        workerData.retryCount++;
        workerData.stolen = false;
        printWorkerData(workerData, i, "try: ");
        workerData.worker.postMessage(
          data.slice(workerData.currentChunk, workerData.endChunk)
        );
      };
      workerData.worker.addEventListener("message", messageHandle);
      workerData.worker.addEventListener("error", errorHandel);
      workerData.worker.postMessage(initialChunk);
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

function printWorkerData(workerData: WorkerData, i: number, msg: string = "") {
  workerData;
  console.log(
    `${msg}Worker ${i}: ${workerData.startChunk}-${workerData.endChunk}:${workerData.currentChunk}:${workerData.retryCount}:${workerData.stolen}`
  );
}

/** 单线程 */
export function execSingleThread(data: number[]) {
  function fib(n: number): number {
    if (n <= 1) return n;
    return fib(n - 1) + fib(n - 2);
  }
  return data.map((item) => ({ origin: item, data: fib(item) }));
}

/** 传统多线程 */
export function execTraditionalMultithreading<T, R>(
  threadCount: number,
  workerFactory: () => Worker,
  data: T[]
) {
  if (data.length < 1) return Promise.resolve([]);
  if (threadCount < 1) throw new Error("threadCount must be greater than 0");
  return new Promise<{ origin: T; data: R }[]>((resolve) => {
    const chunkSize = Math.ceil(data.length / threadCount);
    let workerCount = 0;
    const res: { origin: T; data: R }[] = [];
    for (let i = 0; i < data.length; i += chunkSize) {
      workerCount++;
      const worker = workerFactory();
      const endChunk = Math.min(i + chunkSize, data.length);
      worker.postMessage(data.slice(i, endChunk));
      let count = i;
      worker.onmessage = (e: MessageEvent<R>) => {
        res[count] = { origin: data[count], data: e.data };
        count++;
        if (count < endChunk) return;
        worker.terminate();
        workerCount--;
        if (workerCount === 0) resolve(res);
      };
    }
  });
}
