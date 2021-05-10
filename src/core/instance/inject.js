/* @flow */

import { hasOwn } from 'shared/util'
import { warn, hasSymbol } from '../util/index'
import { defineReactive, toggleObserving } from '../observer/index'

/**
 * 初始化provide
 * @param {Component}} vm 
 */
export function initProvide (vm: Component) {
  const provide = vm.$options.provide
  if (provide) {
    vm._provided = typeof provide === 'function'
      ? provide.call(vm)
      : provide
  }
}

/**
 * 初始化注入(inject)
 * @param {Component} vm 
 */
export function initInjections (vm: Component) {
  const result = resolveInject(vm.$options.inject, vm)
  if (result) {
    toggleObserving(false)
    Object.keys(result).forEach(key => {
      /* istanbul ignore else */
      if (process.env.NODE_ENV !== 'production') {
        defineReactive(vm, key, result[key], () => {
          warn(
            `Avoid mutating an injected value directly since the changes will be ` +
            `overwritten whenever the provided component re-renders. ` +
            `injection being mutated: "${key}"`,
            vm
          )
        })
      } else {
        defineReactive(vm, key, result[key])
      }
    })
    toggleObserving(true)
  }
}

/**
 * 解析注入(inject)
 * @param {Array<string> | { [key: string]: string | Symbol | Object }} inject 注入
 * @param {Component}} vm vue实例
 * @returns {?Object | undefined}
 */
export function resolveInject (inject: any, vm: Component): ?Object {
  if (inject) {
    // inject is :any because flow is not smart enough to figure out cached
    // 创建空对象
    const result = Object.create(null)
    // 获取全部inject, 如果支持Symbol使用反射(Reflect)来获取,否则降级使用Object.keys来获取
    const keys = hasSymbol
      ? Reflect.ownKeys(inject)
      : Object.keys(inject)
    // 遍历inject
    for (let i = 0; i < keys.length; i++) {
      const key = keys[i]
      // #6574 in case the inject object is observed...
      // 如果inject对象是被观测的, 跳过__ob__属性
      if (key === '__ob__') continue
      // 获取可用注入内容(provide的key)
      const provideKey = inject[key].from
      let source = vm // 当前实例
      while (source) {
        // 向上查找inject的提供者实例
        if (source._provided && hasOwn(source._provided, provideKey)) {
          result[key] = source._provided[provideKey]
          break
        }
        source = source.$parent
      }
      // 如果向上查找一直没有找到提供者, 则取用户定义的默认值(default)
      if (!source) {
        // 如果定义了default
        if ('default' in inject[key]) {
          const provideDefault = inject[key].default
          result[key] = typeof provideDefault === 'function'
            ? provideDefault.call(vm)
            : provideDefault
        } else if (process.env.NODE_ENV !== 'production') {
          // 非生产环境提示 inject未找到
          warn(`Injection "${key}" not found`, vm)
        }
      }
    }
    return result
  }
}
