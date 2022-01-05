# RouterView

## 介绍

文件在 `src/RouterView.ts`



## 解析 

### props - 组件参数:

+ `name`: 默认 `default`, 用于[命名视图](https://next.router.vuejs.org/zh/guide/essentials/named-views.html)
+ `route`: 路由对象, 一个路由地址的所有组件都已被解析（如果所有组件都被懒加载），因此可以显示

### `setup`方法

覆盖vue-router的全局`Provide`的`routerViewLocationKey`

并 `Provide`两个新的值:

+ `viewDepthKey`: 当前路由深度
+ `matchedRouteKey`: 当前路由匹配的路由



监听 `组件实例` , `路由记录(to)` , `名称(props.name)`

