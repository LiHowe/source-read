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


## createRouterMatcher

创建路由匹配器

+ routes: 路由表
+ globalOptions: 路由创建选项

> globalOptions除了官网展示的几个配置项外, 还有以下3个高级配置项
> `strict`: 默认情况下，所有路由都允许使用尾部的斜线, 开启该选项则不允许使用尾部斜线.
> `end`: 暂时还不知道
> `sensitive`: 路径大小写敏感

