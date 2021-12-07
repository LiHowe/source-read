import {
  reactive,
  readonly,
  toRaw,
  ReactiveFlags,
  Target,
  readonlyMap,
  reactiveMap,
  shallowReactiveMap,
  shallowReadonlyMap
} from './reactive'
import { TrackOpTypes, TriggerOpTypes } from './operations'
import {
  track,
  trigger,
  ITERATE_KEY,
  pauseTracking,
  resetTracking
} from './effect'
import {
  isObject,
  hasOwn,
  isSymbol,
  hasChanged,
  isArray,
  isIntegerKey,
  extend,
  makeMap
} from '@vue/shared'
import { isRef } from './ref'

const isNonTrackableKeys = /*#__PURE__*/ makeMap(`__proto__,__v_isRef,__isVue`)

const builtInSymbols = new Set(
  Object.getOwnPropertyNames(Symbol)
    .map(key => (Symbol as any)[key])
    .filter(isSymbol)
)

const get = /*#__PURE__*/ createGetter()
const shallowGet = /*#__PURE__*/ createGetter(false, true)
const readonlyGet = /*#__PURE__*/ createGetter(true)
const shallowReadonlyGet = /*#__PURE__*/ createGetter(true, true)

const arrayInstrumentations = /*#__PURE__*/ createArrayInstrumentations()

/**
 * 创建数组方法监测对象
 * `includes`, `indexOf`, `lastIndexOf`,
 * `push`, `pop`, `shift`, `unshift`, `splice`
 * @returns
 */
function createArrayInstrumentations() {
  const instrumentations: Record<string, Function> = {}
  // instrument identity-sensitive Array methods to account for possible reactive
  // values
  // 监测对元素身份敏感的数组方法来应对响应式值
  // 比如计算属性 computed(() => arr.indexOf(x))
  ;(['includes', 'indexOf', 'lastIndexOf'] as const).forEach(key => {
    instrumentations[key] = function (this: unknown[], ...args: unknown[]) {
      // 获取原始数组对象
      const arr = toRaw(this) as any
      // 跟踪每个数组元素
      for (let i = 0, l = this.length; i < l; i++) {
        track(arr, TrackOpTypes.GET, i + '')
      }
      // we run the method using the original args first (which may be reactive)
      // 使用原始参数来执行方法
      const res = arr[key](...args)
      // 如果没找到对应结果
      if (res === -1 || res === false) {
        // if that didn't work, run it again using raw values.
        // 将参数转为原始值再次调用(避免由于参数是响应式对象而导致结果有误)
        return arr[key](...args.map(toRaw))
      } else {
        return res
      }
    }
  })
  // instrument length-altering mutation methods to avoid length being tracked
  // which leads to infinite loops in some cases (#2137)
  // 监测影响数组长度的方法来避免长度被追踪而导致死循环, 具体案例请看 Issue #2137
  ;(['push', 'pop', 'shift', 'unshift', 'splice'] as const).forEach(key => {
    instrumentations[key] = function (this: unknown[], ...args: unknown[]) {
      pauseTracking()
      const res = (toRaw(this) as any)[key].apply(this, args)
      resetTracking()
      return res
    }
  })
  return instrumentations
}

/**
 * 创建proxy get代理方法
 * @param isReadonly 是否是只读对象
 * @param shallow 是否浅的
 * @returns
 */
function createGetter(isReadonly = false, shallow = false) {
  // 闭包写法, 方便保留入参
  return function get(target: Target, key: string | symbol, receiver: object) {
    //NOTE: target.__v_isReactive === !target.__v_isReadonly
    if (key === ReactiveFlags.IS_REACTIVE) {
      return !isReadonly
    } else if (key === ReactiveFlags.IS_READONLY) {
      return isReadonly
    } else if (
      // 如果获取对象的`__v_raw`属性, 如果有对应缓存, 则返回代理原始对象
      key === ReactiveFlags.RAW &&
      receiver ===
        (isReadonly
          ? shallow
            ? shallowReadonlyMap
            : readonlyMap
          : shallow
          ? shallowReactiveMap
          : reactiveMap
        ).get(target)
    ) {
      return target
    }
    // 目标对象是否是数组
    const targetIsArray = isArray(target)
    // 如果非只读的数组对象, 且当前获取属性为`includes`, `indexOf`, `lastIndexOf`, `push`, `pop`, `shift`, `unshift`, `splice`之一
    if (!isReadonly && targetIsArray && hasOwn(arrayInstrumentations, key)) {
      // 返回调用对应方法结果
      return Reflect.get(arrayInstrumentations, key, receiver)
    }
    // 获取对象对应属性值
    const res = Reflect.get(target, key, receiver)
    // 如果key为 (symbol类型且为内置Symbol属性/方法) 或者 (是不需要追踪的属性), 直接返回属性值
    if (isSymbol(key) ? builtInSymbols.has(key) : isNonTrackableKeys(key)) {
      return res
    }
    // 追踪副作用
    if (!isReadonly) {
      track(target, TrackOpTypes.GET, key)
    }

    if (shallow) {
      return res
    }

    if (isRef(res)) {
      // ref unwrapping - does not apply for Array + integer key.
      const shouldUnwrap = !targetIsArray || !isIntegerKey(key)
      return shouldUnwrap ? res.value : res
    }

    if (isObject(res)) {
      // Convert returned value into a proxy as well. we do the isObject check
      // here to avoid invalid value warning. Also need to lazy access readonly
      // and reactive here to avoid circular dependency.
      return isReadonly ? readonly(res) : reactive(res)
    }

    return res
  }
}

const set = /*#__PURE__*/ createSetter()
const shallowSet = /*#__PURE__*/ createSetter(true)

/**
 * 创建对象赋值handler
 * @param shallow
 * @returns
 */
function createSetter(shallow = false) {
  /**
   * 对象赋值handler
   */
  return function set(
    target: object,
    key: string | symbol,
    value: unknown,
    receiver: object
  ): boolean {
    // 先获取旧值
    let oldValue = (target as any)[key]
    // 如果不是浅模式
    if (!shallow) {
      // 获取新值的原始值
      value = toRaw(value)
      // 获取旧值的原始值
      oldValue = toRaw(oldValue)
      // 如果当前对象不是数组, 且旧值是Ref对象, 新值不是Ref对象
      // 即, 如果当前设置的属性旧值为Ref对象, 则直接更新Ref对象的value值
      if (!isArray(target) && isRef(oldValue) && !isRef(value)) {
        oldValue.value = value
        return true
      }
    } else {
      // in shallow mode, objects are set as-is regardless of reactive or not
      // 在浅层模式下, 对象不管是不是响应式的都是按照原样设置的
    }
    // 标识: 目标对象是否有待设置的key
    const hadKey =
    // 根据对象是否是数组来做不同判断
      isArray(target) && isIntegerKey(key)
        ? Number(key) < target.length // 判断下标是否越界
        : hasOwn(target, key) // 判断是否有对应key
    // 标识: 值是否设置成功
    const result = Reflect.set(target, key, value, receiver)
    // don't trigger if target is something up in the prototype chain of original
    // 如果目标对象是原型链上的就不触发副作用 (如果是该对象的代理)
    if (target === toRaw(receiver)) {
      if (!hadKey) {
        // key不存在于原始对象, 则为新增值
        trigger(target, TriggerOpTypes.ADD, key, value)
      } else if (hasChanged(value, oldValue)) {
        // key存在于原始对象, 则为更新值, 触发副作用
        trigger(target, TriggerOpTypes.SET, key, value, oldValue)
      }
    }
    return result
  }
}

function deleteProperty(target: object, key: string | symbol): boolean {
  const hadKey = hasOwn(target, key)
  const oldValue = (target as any)[key]
  const result = Reflect.deleteProperty(target, key)
  if (result && hadKey) {
    trigger(target, TriggerOpTypes.DELETE, key, undefined, oldValue)
  }
  return result
}

function has(target: object, key: string | symbol): boolean {
  const result = Reflect.has(target, key)
  // 如果属性不是Symbol类型, 或者key不是内置Symbol对象的属性
  if (!isSymbol(key) || !builtInSymbols.has(key)) {
    track(target, TrackOpTypes.HAS, key)
  }
  return result
}

function ownKeys(target: object): (string | symbol)[] {
  track(target, TrackOpTypes.ITERATE, isArray(target) ? 'length' : ITERATE_KEY)
  return Reflect.ownKeys(target)
}

export const mutableHandlers: ProxyHandler<object> = {
  get,
  set,
  deleteProperty,
  has,
  ownKeys
}

export const readonlyHandlers: ProxyHandler<object> = {
  get: readonlyGet,
  set(target, key) {
    if (__DEV__) {
      console.warn(
        `Set operation on key "${String(key)}" failed: target is readonly.`,
        target
      )
    }
    return true
  },
  deleteProperty(target, key) {
    if (__DEV__) {
      console.warn(
        `Delete operation on key "${String(key)}" failed: target is readonly.`,
        target
      )
    }
    return true
  }
}

export const shallowReactiveHandlers = /*#__PURE__*/ extend(
  {},
  mutableHandlers,
  {
    get: shallowGet,
    set: shallowSet
  }
)

// Props handlers are special in the sense that it should not unwrap top-level
// refs (in order to allow refs to be explicitly passed down), but should
// retain the reactivity of the normal readonly object.
export const shallowReadonlyHandlers = /*#__PURE__*/ extend(
  {},
  readonlyHandlers,
  {
    get: shallowReadonlyGet
  }
)
