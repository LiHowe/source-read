# RouterLink

文件位于 `src/RouterLink.ts`

### 问题

1. `vue-router` 是如何判断当前路由是否是激活状态的?
2. `active`和`exactActive`有什么区别?

## 解析

### 属性 - Props

我们来看一下 `<router-link>` 的属性定义

```typescript
   props: {
    to: {
      type: [String, Object] as PropType<RouteLocationRaw>,
      required: true,
    },
    replace: Boolean,
    activeClass: String,
    // inactiveClass: String,
    exactActiveClass: String,
    custom: Boolean,
    ariaCurrentValue: {
      type: String as PropType<RouterLinkProps['ariaCurrentValue']>,
      default: 'page',
    },
  },
```

[vur-router-next/API参考](https://next.router.vuejs.org/zh/api/)

+ `to`

  **必须属性**, 表示目标路由的链接。当被点击后，内部会立刻把 `to` 的值传到 `router.push()`，所以这个值可以是一个 `string` 或者是 `描述目标位置的对象(route对象)`。

+ `replace`

  是否替换历史记录(不产生新历史记录). 即路由跳转使用 `router.replace()` 而不是 `router.push()`

+ `activeClass`

  链接激活时，应用于渲染的 `<a>` 的 class。

+ `exactActiveClass`

  链接精准激活时，应用于渲染的 `<a>` 的 class。

+ `custom`

  `<router-link>` 是否应该将其内容包裹在 `<a>` 元素中。在使用 [`v-slot`](https://next.router.vuejs.org/zh/api/#router-link-s-v-slot) 创建自定义 RouterLink 时很有用。默认情况下，`<router-link>` 会将其内容包裹在 `<a>` 元素中，即使使用 `v-slot` 也是如此。传递`自定义的` prop，可以去除这种行为

+ `ariaCurrentValue`

  同 `Element.ariaCurrent`, 用于为残障人士说明该元素用途.

> `activeClass` 和 `exactActiveClass` 的区别在于:
>
> `activeClass` 是比较粗略的路由匹配(比如当前路由的子路由当前激活, 那么当前路由也符合条件), 也就会



### 插槽 - slot

`<router-link>` 提供了一个默认插槽来供开发者自使用.

> 如果**不需要**插槽内容被包裹在 `<a>` 标签内, 需要给 `<router-link>` 设置 `custom` 属性

插槽暴露了 `href, route, navigate, isActive, isExactActive` 这些属性. 对应源码中的 `useLink` 方法

插槽用法:

```vue
<router-link
  to="/about"
  custom
  v-slot="{ href, route, navigate, isActive, isExactActive }"
>
  <NavLink :active="isActive" :href="href" @click="navigate">
    {{ route.fullPath }}
  </NavLink>
</router-link>

```

#### useLink

解析 `<router-link>` 的 `to` 来获取路由对应信息.

解析出来的对象包含以下属性:

+ `href`

  解析后的 URL。将会作为一个 `<a>` 元素的 `href` 属性。如果什么都没提供，则它会包含 `base`。

+ `route`

  使用`router.resolve`方法解析后的规范化的地址。

+ `navigate`

  触发导航的函数。 **会在必要时自动阻止事件**，和 `router-link` 一样。例如：`ctrl` 或者 `cmd` + 点击仍然会被 `navigate` 忽略。

+ `isActive`

  如果需要应用 [active class](https://next.router.vuejs.org/zh/api/#active-class)，则为 `true`。允许应用一个任意的 class。

+ `isExactActive`

  如果需要应用 [exact active class](https://next.router.vuejs.org/zh/api/#exact-active-class)，则为 `true`。允许应用一个任意的 class。
