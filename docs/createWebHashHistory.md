# createWebHashHistory

## 介绍

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



## 解析

**源码如下:**

很少的几行代码, 实则调用 `createWebHistory`

```typescript
export function createWebHashHistory(base?: string): RouterHistory {
  base = location.host ? base || location.pathname + location.search : ''
  if (!base.includes('#')) base += '#'
  return createWebHistory(base)
}
```

