# createRouter

本质是定义`Vue plugin`, 主要进行了路由对象的初始化, 各个方法的定义.

路由对象如下:

```typecript
const router:Router = {
  currentRoute, // 当前路由对象
  
  // 工具方法
  addRoute,     // 添加路由  
  removeRoute,  // 移除路由
  hasRoute,     // 路由是否存在
  getRoutes,    // 获取路由表
  resolve,      // 解析路由
  options,      // 路由选项(用户传入方法的options)

  // 路由控制方法
  push,
  replace,
  go,
  back: () => go(-1),
  forward: () => go(1),

  // 路由守卫
  beforeEach: beforeGuards.add,
  beforeResolve: beforeResolveGuards.add,
  afterEach: afterGuards.add,

  onError: errorHandlers.add, // 错误处理
  isReady, // 路由状态

  // vue plugin注册方法
  install(app:App) {}
}
```

## **install**

1. 定义全局路由组件 `<router-link>` 和 `<router-view>`
2. 为Vue添加全局属性 `$router`
3. 为Vue添加全局属性 `$route`, 值为 `当前路由`, 不允许赋值(`defineProperty get`)
4. **初始化导航, 避免路由用于多个App的时候push多次** (为什么?)
5. 全局 `Provide`: Symbol的 `r`, `rl`, `rvl` (开发环境下为`router`, `router location`, `router view location`)
6. 将当前Vue实例放入 `installedApps`, 用来标识Vue实例是已经加载过的
7. 覆写Vue的 `unmount` 方法, 在vue unmount之前来还原路由状态
   1. 删除 `installedApps` 的对应Vue实例
   2. 如果没有其他Vue实例使用该路由, 则还原路由状态
8. 开发环境下注入 `devtools`



### 初始化导航

使用对应History对象的 `location` 来传入 `push` 方法触发首次路由行为



### push & replace

push用于触发导航, 与 `replace` 一样,都是调用了 `pushWithRedirect` 方法



### pushWithRedirect

1. 解析传入的目标路由(`to`)
2. 判断目标路由是否需要重定向
3. 调用 `navigate` 确认导航.
4. 如果导航未失败的情况下, 调用 `finalizeNavigation` 来最终确认导航
   1. 如果是用户触发的导航且不是首次导航, 则调用 `push` 或 `replace` 来改变URL
   2. 更换当前路由值(`currentRoute`)
   3. 调用 `handleScroll` 来应用 `scrollBehavior`
   4. 调用 `markAsReady` 
5. 触发 `afterEach` 守卫



#### markAsReady

1. 表明路由现在可用 `isReady = true`
2. 调用 `setupListeners` 为 `routerHistory` 配置路由监听, 用来触发导航



#### handleScroll

1. 获取历史状态( `history.state` )中的滚动信息.

2. 等待 vue `nextTick`

   1. 调用 `scrollBehavior` 获取位置
   2. 滚动到指定位置

   

### navigate

收集各种守卫, 然后执行, 导航被确认.

1. 收集路由记录变化(`leavingRecords, updatingRecords, enteringRecords`)

2. 收集组件内 `beforeRouteLeave` 守卫

3. 将 `leavingRecords` 中的 组件 `beforeRouteLeave` 守卫转化为 `Promise类型的方法`

4. 顺序调用守卫(通过`promise.then`链式调用)

   1. 全局配置 `beforeEach`

   2. 组件守卫 `beforeRouteUpdate`

   3. 路由配置 `beforeEnter`

   4. 组件守卫 `beforeRouteEnter`

   5. 全局守卫 `beforeResolve`

      


## createRouterMatcher

创建路由匹配器

+ routes: 路由表
+ globalOptions: 路由创建选项

> globalOptions除了官网展示的几个配置项外, 还有以下3个高级配置项
> `strict`: 默认情况下，所有路由都允许使用尾部的斜线, 开启该选项则不允许使用尾部斜线.
> `end`: 暂时还不知道
> `sensitive`: 路径大小写敏感

