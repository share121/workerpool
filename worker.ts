self.onmessage = ({ data }: MessageEvent<number[]>) => {
  console.log(data);
  for (const i of data) {
    self.postMessage(fib(i));
  }
  console.log("end", data);
};

function fib(n: number): number {
  if (n <= 1) return n;
  return fib(n - 1) + fib(n - 2);
}
