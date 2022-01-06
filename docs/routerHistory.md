# RouterHistory

由官网可知, Vue-Router 目前支持3种类型的历史记录

+ History
+ HashHistory
+ MemoryHistory



> 全文的History代表 Vue-Router的 History 而非 window.history

让我们先来看下源码中 `RouterHistory` 对象的定义

```typescript
export interface RouterHistory {
  // 所有URL的根路径
  readonly base: string
  // 当前历史地址
  readonly location: HistoryLocation
  // 当前历史状态
  readonly state: HistoryState

  // 导航到一个路径, 使用 `history.pushState`
  push(to: HistoryLocation, data?: HistoryState): void
  // 导航到一个路径, 使用 `history.replaceState`
  replace(to: HistoryLocation, data?: HistoryState): void
  // 方向导航 (前进/后退)
  go(delta: number, triggerListeners?: boolean): void
  
  // 为History关联一个监听器, 在外部导航的时候触发(比如浏览器的前进后退)
  listen(callback: NavigationCallback): () => void
  // 为一个锚点标签生成一个相应的href
  createHref(location: HistoryLocation): string
  // 清除History所有的事件监听
  destroy(): void
}
```



## History

创建基于 HTML5 History API的路由

### 源码概览

```typescript
export function createWebHistory(base?: string): RouterHistory {
  // 标准化根路径base
  base = normalizeBase(base)
  // 初始化导航对象
  const historyNavigation = useHistoryStateNavigation(base)
  // 添加为window添加事件监听
  const historyListeners = useHistoryListeners(
    base,
    historyNavigation.state,
    historyNavigation.location,
    historyNavigation.replace
  )
  function go(delta: number, triggerListeners = true) {
    if (!triggerListeners) historyListeners.pauseListeners()
    history.go(delta)
  }
  // 合并路由历史对象
  const routerHistory: RouterHistory = assign(
    {
      // it's overridden right after
      location: '',
      base,
      go,
      createHref: createHref.bind(null, base),
    },

    historyNavigation,
    historyListeners
  )
  // 将 location  和 state 设置为只读
  Object.defineProperty(routerHistory, 'location', {
    enumerable: true,
    get: () => historyNavigation.location.value,
  })

  Object.defineProperty(routerHistory, 'state', {
    enumerable: true,
    get: () => historyNavigation.state.value,
  })

  return routerHistory
}
```

实质上该方法主要做了以下几件事:

+ 为 `window` 添加监听事件 (监听 `popstate`, `beforeunload`)
+ 初始化 `routerHistory` 对象
+ 将 `routerHistory` 对象的 `location` , `state` 设置为只读, 避免用户意外改动
+ 返回 `routerHistory` 对象

### 源码精读

1. `normalizeBase(base)`
   将用户传入的 `base` 标准化
   
   + 如果传入了 `base`, 直接使用 `base`
   + 如果没有指定 `base` 的话, 它会去寻找文档中的 `<base>` 元素
     + 如果没找到 `<base>` 则会使用 `/`
     + 如果找到的话:
       + 如果没有 `href` 属性值则使用 `/`
       + 有则取 `href` 属性值的域名后的字符串 (如: `'http://localhost:3000/demo/'` 会取 `/demo/` )
   
   <img src="https://s2.loli.net/2021/12/31/XafdFoBny7reO8Q.png" alt="流程" style="zoom: 33%;" />
   
   > [`<base>`](https://developer.mozilla.org/zh-CN/docs/Web/HTML/Element/base)用于指定一个文档中所有的相对URL的根URL.
   > 一个文档中只能有一个 `<base>` 元素
   
2. `useHistoryStateNavigation`

    初始化导航状态记录对象, 使用History State来记录导航状态, 精简代码如下:

    ```typescript
    function useHistoryStateNavigation(base: string) {
      const { history, location } = window
      // 创建标准化历史记录: 将一些奇奇怪怪的base(#, /#, #/, #!, #!/, /#!/)转换为基于base的路径
      const currentLocation: ValueContainer<HistoryLocation> = {
        value: createCurrentLocation(base, location),
      }
      const historyState: ValueContainer<StateEntry> = { value: history.state }
      if (!historyState.value){}
      function replace(to, data){}
      function changeLocation(to, state, replace){}
      function push(to,data){}
      return {
        location: currentLocation,
        state: historyState,
        push,
        replace,
      }
    }
    ```

3. `useHistoryListeners`

    定义监听器对象, 为 `window` 添加 **`popstate`** 和 **`beforeunload`** 监听事件

    这两个事件监听即为 `History` 模式路由的核心

    + `popStateHandler`

      > 不清楚 `popState` 事件的同学可以查看[MDN/onpopstate](https://developer.mozilla.org/zh-CN/docs/Web/API/WindowEventHandlers/onpopstate)

      那么该方法主要做了哪些事情呢?

    + `beforeUnloadListener`

4. 定义并合并 routerHistory 对象

    上面几步的目的是为了生成 routerHistory 的部分属性, 用于在该步骤进行对象合并

    ```typescript
    const routerHistory: RouterHistory = assign(
      {
        // it's overridden right after
        location: '',
        base,
        go,
        createHref: createHref.bind(null, base),
      },
    
      historyNavigation, // useHistoryStateNavigation返回值
      historyListeners // useHistoryListeners返回值
    )
    ```

    然后使用 `Object.defineProperty` 来覆写 `location` 和 `state` 属性的 `get` 方法

    实际上
    `routerHistory.location` 返回的是 `historyNavigation.location.value`
    `routerHistory.state` 返回的是 `historyNavigation.state.value`





## HashHistory

创建一个 hash 历史记录。对于没有主机的 web 应用程序 (例如 `file://`)，或当配置服务器不能处理任意 URL 时这非常有用。

> **注意：如果 SEO 对你很重要，你应该使用 [`createWebHistory`](https://next.router.vuejs.org/zh/api/#createwebhistory)*

**函数签名**

```typescript
export declare function createWebHashHistory(base?: string): RouterHistory
```

该函数接收唯一一个可选参数 `base` , 用来配置路由根路径. 默认值为 `location.pathname + location.search`

**有以下几种情况需要注意**:

1. 如果HTML的`head`中有`<base>`, 则会使用 `<base>` 的 href
2. 如果使用的是没有host的路径(比如文件路径(`file://`)), 则会忽略 `base` 设置
3. 如果host为 `https://example.com/folder` 则路由地址为 `https://example.com/folder#`



### 源码概览

```typescript
export function createWebHashHistory(base?: string): RouterHistory {
  base = location.host ? base || location.pathname + location.search : ''
  if (!base.includes('#')) base += '#'
  return createWebHistory(base)
}
```

可以看出, 创建Hash模式路由不过就是为 `base` 拼接了 `#` , 实际上还是调用 `History` 模式路由的创建方法.





## MemoryHistory

创建一个基于内存(使用数组来控制路由队列)的历史记录, Memory路由的主要使用场景是 `SSR`



### 源码概览

```typescript
export function createMemoryHistory(base: string = ''): RouterHistory {
  // 导航监听器
  let listeners: NavigationCallback[] = []
  // 路由队列
  let queue: HistoryLocation[] = [START]
  // 当前路由位置
  let position: number = 0
  // 路由根路径
  base = normalizeBase(base)

  /**
   * 导航方法, 实质上是在控制路由队列queue
   */
  function setLocation(location: HistoryLocation) {
    position++
    if (position === queue.length) {
      // we are at the end, we can simply append a new entry
      queue.push(location)
    } else {
      // we are in the middle, we remove everything from here in the queue
      queue.splice(position)
      queue.push(location)
    }
  }
  /**
   * 触发监听器
   */
  function triggerListeners(
    to: HistoryLocation,
    from: HistoryLocation,
    { direction, delta }: Pick<NavigationInformation, 'direction' | 'delta'>
  ): void {
    const info: NavigationInformation = {
      direction,
      delta,
      type: NavigationType.pop,
    }
    for (const callback of listeners) {
      callback(to, from, info)
    }
  }

  const routerHistory: RouterHistory = {
    // rewritten by Object.defineProperty
    location: START,
    // TODO: should be kept in queue
    state: {},
    base,
    createHref: createHref.bind(null, base),

    replace(to) {
      // remove current entry and decrement position
      queue.splice(position--, 1)
      setLocation(to)
    },

    push(to, data?: HistoryState) {
      setLocation(to)
    },

    listen(callback) {
      listeners.push(callback)
      return () => {
        const index = listeners.indexOf(callback)
        if (index > -1) listeners.splice(index, 1)
      }
    },
    destroy() {
      listeners = []
      queue = [START]
      position = 0
    },

    go(delta, shouldTrigger = true) {
      const from = this.location
      const direction: NavigationDirection =
        delta < 0 ? NavigationDirection.back : NavigationDirection.forward
      position = Math.max(0, Math.min(position + delta, queue.length - 1))
      if (shouldTrigger) {
        triggerListeners(this.location, from, {
          direction,
          delta,
        })
      }
    },
  }

  Object.defineProperty(routerHistory, 'location', {
    enumerable: true,
    get: () => queue[position],
  })
  
  return routerHistory
}
```





## 总结

|               | 使用场景                                                     | 原理                       | 注意事项           |
| ------------- | ------------------------------------------------------------ | -------------------------- | ------------------ |
| History       | SPA                                                          | `popstate`, `beforeunload` | 需要服务器配置支持 |
| HashHistory   | 用于没有主机(域名)类的应用程序,或者服务器没有配置处理任意URL的情况 | 同 History                 |                    |
| MemoryHistory | SSR                                                          | 队列(数组)                 |                    |

