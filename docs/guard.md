# Guard

`vue-router` 提供了多种[路由守卫](https://next.router.vuejs.org/zh/guide/advanced/navigation-guards).



**全局配置守卫**:

+ `beforeEach`
+ `beforeResolve`
+ `afterEach`

**路由配置守卫:**

+ `beforeEnter`

**组件内守卫:**

+ `beforeRouteEnter`
+ `beforeRouteUpdate`
+ `beforeRouteLeave`



### 守卫调用流程:

1. 导航被触发。
2. 在失活的组件里调用 `beforeRouteLeave` 守卫。
3. 调用全局的 `beforeEach` 守卫。
4. 在重用的组件里调用 `beforeRouteUpdate` 守卫(2.2+)。
5. 在路由配置里调用 `beforeEnter`。 
6. 解析异步路由组件。
7. 在被激活的组件里调用 `beforeRouteEnter`。
8. 调用全局的 `beforeResolve` 守卫(2.5+)。
9. 导航被确认。
10. 调用全局的 `afterEach` 钩子。
11. 触发 DOM 更新(Vue生命周期)。
12. 调用 `beforeRouteEnter` 守卫中传给 `next` 的回调函数，创建好的组件实例会作为回调函数的参数传入。



![Untitled-2021-12-21-1349](https://s2.loli.net/2022/01/06/tPrgcJIFZ1N5zu9.png)



### extractComponentsGuards

提取组件内的路由守卫方法, 包含

+ `beforeRouteEnter`
+ `beforeRouteUpdate`
+ `beforeRouteLeave`

> 在组合式API的写法中没有 `beforeRotuerEnter`
>
> 因为调用 `setup` 的时候已经进入组件了.

