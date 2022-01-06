
function testPromise() {
  const queue = Array.from(
    new Array(Math.floor(Math.random() * 10)),
    (item, idx) => () => {
      console.time(idx)
      setTimeout(() => {
        console.log(`This is the ${idx} fn`)
      }, item * 1000)
      console.timeEnd(idx)
    }
  )
  console.log('queue length is:',queue.length)
  return queue.reduce(
    (promise, fn) => promise.then(() => fn()),
    Promise.resolve()
  )
}
