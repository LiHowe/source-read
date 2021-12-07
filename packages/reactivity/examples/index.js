/* eslint-disable */
const {
  reactive,
  readonly,
  markRaw,
  effect
} = require('../dist/reactivity.cjs')

const a = reactive({
  name: 'howe',
  age: 16
})

const eff = effect(() => {
  console.log(a.age)
})

a.age = 10

console.log(eff)
