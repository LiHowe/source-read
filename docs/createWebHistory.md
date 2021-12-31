# CreateWebHistory

创建基于 HTML5 History API的路由

## 方法执行顺序

1. `normalizeBase(base)`
   将用户传入的 `base` 标准化
   + 如果传入了 `base`, 直接使用 `base`
   + 如果没有指定 `base` 的话, 它会去寻找文档中的 `<base>` 元素
     + 如果没找到 `<base>` 则会使用 `/`
     + 如果找到的话:
       + 如果没有 `href` 属性值则使用 `/`
       + 有则取 `href` 属性值的域名后的字符串 (如: `'http://localhost:3000/demo/'` 会取 `/demo/` )

   ![流程](https://s2.loli.net/2021/12/31/XafdFoBny7reO8Q.png)

   > [`<base>`](https://developer.mozilla.org/zh-CN/docs/Web/HTML/Element/base): 用于指定一个文档中所有相对URL的根URL.
   > 一个文档中只能有一个 `<base>` 元素

2. `useHistoryStateNavigation`

    定义导航状态记录对象, 使用History State来记录导航状态, 精简代码如下:

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

5. 最终的 history 对象
    ![routerHistory](https://s2.loli.net/2021/12/31/5QSR89oF4JAKj1H.png)