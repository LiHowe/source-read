// import Vue from '../../src/core/index.js'
Vue.config.performance = true
const app = new Vue({
    template: '<span ref="demo"> hello vue </span>',
})
app.$mount('#app')

