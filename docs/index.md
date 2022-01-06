---
home: true
---

# Doc

个人认为阅读源码的前提应该是 **已经完全熟悉了官方文档以及各个API的调用** 并且有一定场景下的使用用例.

官方源码 `playground` 中提供了大量的使用场景供我们学习及debug.



## 问题

1. 路由的种类以及差异

   路由分为 `istory`, `hash history` 和 `memory history` 三种

   

2. vue-router是如何匹配路由记录的

3. 如何取消导航 | 取消导航的几种方式

4. vue-router-next 与 vue-router 的差异

5. `beforeRouterEnter`, `beforeRouteUpdate`, `beforeRouteLeave` 与 Vue的生命周期的执行顺序

6. 组件内路由守卫的实现

   读取Vue组件的 `__vccOpts` 来获取vue的options, 再从中获取对应守卫函数.

7. 路由切换时候两个Vue组件的生命周期调用顺序

   以 `A.vue` 和 `B.vue` 两个组件来说明:

   **先进入A组件**

   1. [全局路由守卫]`beforeEach`
   2. [A组件路由守卫]`beforeRouteEnter`
   3. [全局路由守卫]`beforeResolve`
   4. [全局路由守卫]`beforeEach`
   5. [A生命周期] `beforeCreate`
   6. [A生命周期] `created`
   7. [A生命周期] `beforeMount`
   8. [A生命周期] `mounted`

   **路由跳转到B组件**

   1. [A组件路由守卫] `beforeRouteLeave`
   2. [全局路由守卫]`beforeEach`
   3. [B组件路由守卫]`beforeRouteEnter`
   4. [全局路由守卫]`beforeResolve`
   5. [全局路由守卫]`beforeEach`
   6. [A生命周期] `beforeUnmount`
   7. [B生命周期] `beforeCreate`
   8. [B生命周期] `created`
   9. [A生命周期] `unmounted`

   



