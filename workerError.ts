addEventListener("message", ({ data }: MessageEvent<number[]>) => {
  // console.log(data);
  for (const i of data) {
    self.postMessage(fib(i));
  }
  // console.log("end", data);
});

addEventListener("error", (e) => {
  // Deno 不能在主线程中捕获错误，所以这是折中的办法
  e.preventDefault();
  console.log("test error");
  self.postMessage({
    colno: e.colno,
    lineno: e.lineno,
    message: e.message,
    filename: e.filename,
    error: e.error,
    isTrusted: e.isTrusted,
    type: e.type,
  });
});

function fib(n: number): number {
  if (n === 30) {
    if (new Date().getSeconds() % 2 === 0) {
      throw new Error("test");
    }
  }
  if (n <= 1) return n;
  return fib(n - 1) + fib(n - 2);
}
