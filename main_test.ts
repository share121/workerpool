// import { assertEquals } from "@std/assert";
import { exec } from "./main.ts";

const workerFactory = () => {
  return new Worker(new URL("./worker.ts", import.meta.url).href, {
    type: "module",
  });
};

Deno.test(async function execTest() {
  setTimeout(() => {}, 3);
  const data = Array.from({ length: 7 }, (_, i) => i + 1);
  console.log(data);
  console.time("exec");
  const res = await exec(2, workerFactory, data);
  console.timeEnd("exec");
  console.log(res);
});
