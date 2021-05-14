/* @flow */

import config from '../config'
import { initProxy } from './proxy'
import { initState } from './state'
import { initRender } from './render'
import { initEvents } from './events'
import { mark, measure } from '../util/perf'
import { initLifecycle, callHook } from './lifecycle'
import { initProvide, initInjections } from './inject'
import { extend, mergeOptions, formatComponentName } from '../util/index'

let uid = 0

/**
 * 主要用于_init方法挂载到Vue原型上
 * @param {Class<Component>} Vue 
 */
export function initMixin (Vue: Class<Component>) {
  /**
   * 初始化方法
   * @param {Object} options 
   */
  Vue.prototype._init = function (options?: Object) {
    debugger
    // 当前组件实例
    const vm: Component = this 
    // 唯一id, 从0开始递增
    vm._uid = uid++
    // 用于非生产环境的性能测试
    let startTag, endTag
    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      startTag = `vue-perf-start:${vm._uid}`
      endTag = `vue-perf-end:${vm._uid}`
      mark(startTag)
    }

    // 避免当前实例(this)被观测的标识
    vm._isVue = true
    // 合并选项(options)
    if (options && options._isComponent) {
      // Vue.component情况
      // 初始化组件
      initInternalComponent(vm, options)
    } else {
      // new Vue情况
      vm.$options = mergeOptions(
        resolveConstructorOptions(vm.constructor),
        options || {},
        vm
      )
    }
    /* istanbul ignore else */
    // 非生产环境为组件实例添加代理
    if (process.env.NODE_ENV !== 'production') {
      initProxy(vm)
    } else {
      vm._renderProxy = vm
    }
    // --- 进入beforeCreate生命周期 ---
    // expose real self
    vm._self = vm
    // 初始化属性
    initLifecycle(vm)
    // 初始化事件
    initEvents(vm)
    // 初始化渲染相关属性 $createElement $slot $scopedSlots $vnode
    initRender(vm)
    callHook(vm, 'beforeCreate')
    // --- 结束beforeCreate生命周期, 实例初始化结束 ---

    // --- 进入created生命周期 ---
    // 解析inject
    initInjections(vm) // resolve injections before data/props
    // 初始化props -> methods -> data -> computed -> watch
    initState(vm)
    // 初始化provide
    initProvide(vm) // resolve provide after data/props
    callHook(vm, 'created')
    // --- 结束created生命周期, 实例初始化结束 ---

    /* istanbul ignore if */
    if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
      vm._name = formatComponentName(vm, false)
      mark(endTag)
      measure(`vue ${vm._name} init`, startTag, endTag)
    }

    if (vm.$options.el) {
      vm.$mount(vm.$options.el)
    }
  }
}

/**
 * 组件实例化, 给组件实例的$options赋值
 * @param {Component}} Vue实例
 * @param {InternalComponentOptions} options 设置
 */
export function initInternalComponent (vm: Component, options: InternalComponentOptions) {
  // 初始化组件$options
  // opts.__proto__ = vm.$options.__proto__  = vm.constructor.options
  // 定义opts只是为了好写一些, 相当于给vm.$options起别名
  const opts = vm.$options = Object.create(vm.constructor.options)
  // doing this because it's faster than dynamic enumeration.
  // 分别赋值比动态枚举要快很多
  const parentVnode = options._parentVnode
  // 父级实例
  opts.parent = options.parent
  // 父级vNode
  opts._parentVnode = parentVnode
  const vnodeComponentOptions = parentVnode.componentOptions
  // prop
  opts.propsData = vnodeComponentOptions.propsData
  // 事件监听
  opts._parentListeners = vnodeComponentOptions.listeners
  // TODO: 不知道
  opts._renderChildren = vnodeComponentOptions.children
  // 当前组件标签名称
  opts._componentTag = vnodeComponentOptions.tag
  // 如果设置中有render属性则使用提供的渲染函数进行渲染
  if (options.render) {
    opts.render = options.render
    // TODO: 静态渲染函数是啥?
    opts.staticRenderFns = options.staticRenderFns
  }
}

/**
 * 处理初始化配置
 * @param {*} Ctor 
 * @returns 
 */
export function resolveConstructorOptions (Ctor: Class<Component>) {
  let options = Ctor.options
  // 如果有继承, TODO: 需确认触发条件
  if (Ctor.super) {
    const superOptions = resolveConstructorOptions(Ctor.super)
    const cachedSuperOptions = Ctor.superOptions
    if (superOptions !== cachedSuperOptions) {
      // super option changed,
      // need to resolve new options.
      Ctor.superOptions = superOptions
      // check if there are any late-modified/attached options (#4976)
      const modifiedOptions = resolveModifiedOptions(Ctor)
      // update base extend options
      if (modifiedOptions) {
        extend(Ctor.extendOptions, modifiedOptions)
      }
      options = Ctor.options = mergeOptions(superOptions, Ctor.extendOptions)
      if (options.name) {
        options.components[options.name] = Ctor
      }
    }
  }
  return options
}

function resolveModifiedOptions (Ctor: Class<Component>): ?Object {
  let modified
  const latest = Ctor.options
  const sealed = Ctor.sealedOptions
  for (const key in latest) {
    if (latest[key] !== sealed[key]) {
      if (!modified) modified = {}
      modified[key] = latest[key]
    }
  }
  return modified
}
