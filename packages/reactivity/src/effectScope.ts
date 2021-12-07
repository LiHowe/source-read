import { ReactiveEffect } from './effect'
import { warn } from './warning'

let activeEffectScope: EffectScope | undefined
const effectScopeStack: EffectScope[] = []

/**
 * 影响范围
 */
export class EffectScope {
  /**
   * 是否启用
   */
  active = true
  /**
   * 影响队列
   */
  effects: ReactiveEffect[] = []
  cleanups: (() => void)[] = []

  parent: EffectScope | undefined
  scopes: EffectScope[] | undefined
  /**
   * track a child scope's index in its parent's scopes array for optimized
   * removal
   */
  private index: number | undefined

  constructor(detached = false) {
    if (!detached && activeEffectScope) {
      this.parent = activeEffectScope
      this.index =
        (activeEffectScope.scopes || (activeEffectScope.scopes = [])).push(
          this
        ) - 1
    }
  }

  run<T>(fn: () => T): T | undefined {
    if (this.active) {
      try {
        this.on()
        return fn()
      } finally {
        this.off()
      }
    } else if (__DEV__) {
      warn(`cannot run an inactive effect scope.`)
    }
  }

  /**
   * 监听
   * 将当前影响范围对象放入影响栈
   */
  on() {
    if (this.active) {
      effectScopeStack.push(this)
      activeEffectScope = this
    }
  }

  off() {
    if (this.active) {
      effectScopeStack.pop()
      activeEffectScope = effectScopeStack[effectScopeStack.length - 1]
    }
  }

  stop(fromParent?: boolean) {
    if (this.active) {
      this.effects.forEach(e => e.stop())
      this.cleanups.forEach(cleanup => cleanup())
      if (this.scopes) {
        this.scopes.forEach(e => e.stop(true))
      }
      // nested scope, dereference from parent to avoid memory leaks
      if (this.parent && !fromParent) {
        // optimized O(1) removal
        const last = this.parent.scopes!.pop()
        if (last && last !== this) {
          this.parent.scopes![this.index!] = last
          last.index = this.index!
        }
      }
      this.active = false
    }
  }
}

export function effectScope(detached?: boolean) {
  return new EffectScope(detached)
}

/**
 * 记录副作用的作用域  <br>
 * 实际上就是将`effect` push到`scope`的`effects`中
 * @param effect 副作用
 * @param scope 范围
 */
export function recordEffectScope(
  effect: ReactiveEffect,
  scope?: EffectScope | null
) {
  scope = scope || activeEffectScope
  if (scope && scope.active) {
    scope.effects.push(effect)
  }
}

export function getCurrentScope() {
  return activeEffectScope
}

export function onScopeDispose(fn: () => void) {
  if (activeEffectScope) {
    activeEffectScope.cleanups.push(fn)
  } else if (__DEV__) {
    warn(
      `onScopeDispose() is called when there is no active effect scope` +
        ` to be associated with.`
    )
  }
}
