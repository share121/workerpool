import {
  exec,
  execSingleThread,
  execTraditionalMultithreading,
} from "./main.ts";

const workerFactory = () =>
  new Worker(import.meta.resolve("./worker.ts"), {
    type: "module",
  });
const testData = Array.from({ length: 30 }, (_, i) => i + 1);
const cpuCount = navigator.hardwareConcurrency || 4;

Deno.test(async function execTest() {
  console.log(testData);
  console.log("cpu", cpuCount);
  console.time("exec");
  const res = await exec(cpuCount, workerFactory, testData);
  console.timeEnd("exec");
  console.log(res);
});

Deno.test(function execSingleThreadTest() {
  console.log(testData);
  console.time("execSingleThreadTest");
  const res = execSingleThread(testData);
  console.timeEnd("execSingleThreadTest");
  console.log(res);
});

Deno.test(async function execTraditionalMultithreadingTest() {
  console.log(testData);
  console.log("cpu", cpuCount);
  console.time("execTraditionalMultithreadingTest");
  const res = await execTraditionalMultithreading(
    cpuCount,
    workerFactory,
    testData
  );
  console.timeEnd("execTraditionalMultithreadingTest");
  console.log(res);
});
