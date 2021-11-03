const { baseCompile, baseParse } = require('../dist/compiler-core.cjs')

const template = `<!DOCTYPE html> 123`
const ast = baseParse(template, {})
console.log(ast)
