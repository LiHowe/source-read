const { baseCompile, baseParse } = require('../dist/compiler-core.cjs')

const template = `{{ demo }}`
const ast = baseParse(template, {})
console.log(ast)
