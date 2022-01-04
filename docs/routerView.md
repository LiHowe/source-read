# RouterView

文件在 `src/RouterView.ts`

## 解析 

### props - 组件参数:

+ `name`: 默认 `default`
+ `route`: 路由对象

### `setup`方法

覆盖vue-router的全局`Provide`的`routerViewLocationKey`

并 `Provide`两个新的值:

+ `viewDepthKey`: 当前路由深度
+ `matchedRouteKey`: 当前路由匹配的路由



监听 `组件实例` , `路由记录(to)` , `名称(props.name)`

