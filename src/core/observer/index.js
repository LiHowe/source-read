/* @flow */

import Dep from './dep'
import VNode from '../vdom/vnode'
import { arrayMethods } from './array'
import {
  def,
  warn,
  hasOwn,
  hasProto,
  isObject,
  isPlainObject,
  isPrimitive,
  isUndef,
  isValidArrayIndex,
  isServerRendering
} from '../util/index'

const arrayKeys = Object.getOwnPropertyNames(arrayMethods)

/**
 * In some cases we may want to disable observation inside a component's
 * update computation.
 */
export let shouldObserve: boolean = true

export function toggleObserving (value: boolean) {
  shouldObserve = value
}

/**
 * Observer class that is attached to each observed
 * object. Once attached, the observer converts the target
 * object's property keys into getter/setters that
 * collect dependencies and dispatch updates.
 */
export class Observer {
  value: any; // 待观测对象
  dep: Dep; // 依赖
  vmCount: number; // 使用该对象作为根$data的实例数量

  constructor (value: any) {
    this.value = value
    this.dep = new Dep()
    this.vmCount = 0
    // 即value.__ob__ = this, __ob__属性不可枚举
    def(value, '__ob__', this)
    // 如果是数组类型
    if (Array.isArray(value)) {
      // 如果有__proto__
      if (hasProto) {
        // 使用已变异的数组方法来代替原始数组操作方法
        protoAugment(value, arrayMethods)
      } else {
        // 没有原型的数组, 直接赋值变异数组方法
        copyAugment(value, arrayMethods, arrayKeys)
      }
      // 为每个数组项创建Observer
      this.observeArray(value)
    } else {
      // 非数组对象, 遍历属性进行监听
      this.walk(value)
    }
  }

  /**
   * Walk through all properties and convert them into
   * getter/setters. This method should only be called when
   * value type is Object.
   * 遍历全部属性并将它们转换成getter,setter.
   * 该方法只有在观测值为对象的时候才会被调用
   */
  walk (obj: Object) {
    // 获取全部可枚举属性
    const keys = Object.keys(obj)
    // 遍历属性设置getter和setter
    for (let i = 0; i < keys.length; i++) {
      defineReactive(obj, keys[i])
    }
  }

  /**
   * Observe a list of Array items.
   * 观测一个数组
   * @param {*} items 
   */
  observeArray (items: Array<any>) {
    // 遍历数据, 调用observe来观测每个数组项
    for (let i = 0, l = items.length; i < l; i++) {
      observe(items[i])
    }
  }
}

// helpers

/**
 * Augment a target Object or Array by intercepting
 * the prototype chain using __proto__
 * 通过使用__proto__拦截原型链来扩充目标对象/数组
 */
/**
 * 
 * @param {Object} target 目标对象
 * @param {Object} src 赋值对象
 */
function protoAugment (target, src: Object) {
  /* eslint-disable no-proto */
  target.__proto__ = src
  /* eslint-enable no-proto */
}

/**
 * Augment a target Object or Array by defining
 * hidden properties.
 * 通过定义隐藏属性来扩充目标对象/数组
 */
/* istanbul ignore next */
/**
 * 
 * @param {Object} target 目标对象
 * @param {Object} src 
 * @param {Array<String>} keys 
 */
function copyAugment (target: Object, src: Object, keys: Array<string>) {
  for (let i = 0, l = keys.length; i < l; i++) {
    const key = keys[i]
    def(target, key, src[key])
  }
}

/**
 * Attempt to create an observer instance for a value,
 * returns the new observer if successfully observed,
 * or the existing observer if the value already has one.
 * 视图去为一个数据创建一个观测者实例
 * 如果成功观测则返回新的观测者
 * 如果数据已被观测过则返回一个已有的观测者
 */
/**
 * 
 * @param {any} value 待观测对象
 * @param {boolean} asRootData 是否作为根数据
 * @returns 
 */
export function observe (value: any, asRootData: ?boolean): Observer | void {
  // 如果待观测对象不是对象 或者是VNode则不予观测
  if (!isObject(value) || value instanceof VNode) {
    return
  }
  let ob: Observer | void
  // 如果已有观测者, 则直接使用已有观测者
  if (hasOwn(value, '__ob__') && value.__ob__ instanceof Observer) {
    ob = value.__ob__
  } else if (
    shouldObserve &&
    !isServerRendering() &&
    (Array.isArray(value) || isPlainObject(value)) &&
    Object.isExtensible(value) &&
    !value._isVue
  ) {
    ob = new Observer(value)
  }
  // 如果该观测者做为根数据$data
  if (asRootData && ob) {
    ob.vmCount++
  }
  return ob
}

/**
 * Define a reactive property on an Object.
 * 为对象定义一个响应式属性
 * 双向绑定核心
 * @param {Object} obj 目标对象
 * @param {String} key 属性名称
 * @param {any} val 属性值
 * @param {Function | undefined} customSetter 自定义setter
 * @param {Boolean | undefined} shallow 是否是浅的
 */
export function defineReactive (
  obj: Object,
  key: string,
  val: any,
  customSetter?: ?Function,
  shallow?: boolean
) {
  // 初始化依赖
  const dep = new Dep()
  // 获取对象对应属性描述符对象
  const property = Object.getOwnPropertyDescriptor(obj, key)
  // 如果该属性不可配置(configurable 为 false)
  /**
   * Object.freeze()
   * Object.defineProperty(obj, key, { configurable: false })
   */
  if (property && property.configurable === false) {
    return
  }

  // cater for pre-defined getter/setters
  // 如果属性已经定义了getter和setter则调用get和set
  const getter = property && property.get
  const setter = property && property.set
  // 方法入参只有obj和key,且属性有setter或者没有getter,直接返回对象属性值
  if ((!getter || setter) && arguments.length === 2) {
    val = obj[key]
  }
  // shallow -- 是否需要观测, 处理内置attr和listener的时候为true(也就是不需要观测)
  //? 为什么内置属性和事件监听不需要观测?
  let childOb = !shallow && observe(val)
  // 发布-订阅设计模式
  Object.defineProperty(obj, key, {
    enumerable: true,
    configurable: true,
    // 当有使用该对象该属性的时候进行依赖搜集
    get: function reactiveGetter () {
      const value = getter ? getter.call(obj) : val
      if (Dep.target) {
        dep.depend()
        if (childOb) {
          childOb.dep.depend()
          if (Array.isArray(value)) {
            dependArray(value)
          }
        }
      }
      return value
    },
    // 赋值的时候通知所有依赖进行更新
    set: function reactiveSetter (newVal) {
      // 获取历史值
      const value = getter ? getter.call(obj) : val
      /* eslint-disable no-self-compare */
      // 如果新值与历史值不同才进行赋值
      if (newVal === value || (newVal !== newVal && value !== value)) {
        return
      }
      /* eslint-enable no-self-compare */
      // 只有非生产环境下才允许调用自定义setter
      if (process.env.NODE_ENV !== 'production' && customSetter) {
        customSetter()
      }
      // #7981: for accessor properties without setter
      // 如果只有getter没有setter,即只读属性直接返回
      if (getter && !setter) return
      if (setter) {
        // 调用setter方法
        setter.call(obj, newVal)
      } else {
        val = newVal
      }
      // 观测新值
      childOb = !shallow && observe(newVal)
      // 通知依赖更新
      dep.notify()
    }
  })
}

/**
 * Set a property on an object. Adds the new property and
 * triggers change notification if the property doesn't
 * already exist.
 */
export function set (target: Array<any> | Object, key: any, val: any): any {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot set reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.length = Math.max(target.length, key)
    target.splice(key, 1, val)
    return val
  }
  if (key in target && !(key in Object.prototype)) {
    target[key] = val
    return val
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid adding reactive properties to a Vue instance or its root $data ' +
      'at runtime - declare it upfront in the data option.'
    )
    return val
  }
  if (!ob) {
    target[key] = val
    return val
  }
  defineReactive(ob.value, key, val)
  ob.dep.notify()
  return val
}

/**
 * Delete a property and trigger change if necessary.
 */
export function del (target: Array<any> | Object, key: any) {
  if (process.env.NODE_ENV !== 'production' &&
    (isUndef(target) || isPrimitive(target))
  ) {
    warn(`Cannot delete reactive property on undefined, null, or primitive value: ${(target: any)}`)
  }
  if (Array.isArray(target) && isValidArrayIndex(key)) {
    target.splice(key, 1)
    return
  }
  const ob = (target: any).__ob__
  if (target._isVue || (ob && ob.vmCount)) {
    process.env.NODE_ENV !== 'production' && warn(
      'Avoid deleting properties on a Vue instance or its root $data ' +
      '- just set it to null.'
    )
    return
  }
  if (!hasOwn(target, key)) {
    return
  }
  delete target[key]
  if (!ob) {
    return
  }
  ob.dep.notify()
}

/**
 * Collect dependencies on array elements when the array is touched, since
 * we cannot intercept array element access like property getters.
 */
function dependArray (value: Array<any>) {
  for (let e, i = 0, l = value.length; i < l; i++) {
    e = value[i]
    e && e.__ob__ && e.__ob__.dep.depend()
    if (Array.isArray(e)) {
      dependArray(e)
    }
  }
}
