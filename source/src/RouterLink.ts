import {
  defineComponent,
  h,
  PropType,
  inject,
  computed,
  reactive,
  unref,
  VNode,
  UnwrapRef,
  VNodeProps,
  AllowedComponentProps,
  ComponentCustomProps,
  getCurrentInstance,
  watchEffect,
  // this is a workaround for https://github.com/microsoft/rushstack/issues/1050
  // this file is meant to be prepended to the generated dist/src/RouterLink.d.ts
  // @ts-ignore
  ComputedRef,
  // @ts-ignore
  DefineComponent,
  // @ts-ignore
  RendererElement,
  // @ts-ignore
  RendererNode,
  // @ts-ignore
  ComponentOptionsMixin,
} from 'vue'
import {
  RouteLocationRaw,
  VueUseOptions,
  RouteLocation,
  RouteLocationNormalized,
} from './types'
import { isSameRouteLocationParams, isSameRouteRecord } from './location'
import { routerKey, routeLocationKey } from './injectionSymbols'
import { RouteRecord } from './matcher/types'
import { NavigationFailure } from './errors'
import { isBrowser, noop } from './utils'

export interface RouterLinkOptions {
  /**
   * Route Location the link should navigate to when clicked on.
   */
  to: RouteLocationRaw
  /**
   * Calls `router.replace` instead of `router.push`.
   */
  replace?: boolean
  // TODO: refactor using extra options allowed in router.push. Needs RFC
}

export interface RouterLinkProps extends RouterLinkOptions {
  /**
   * Whether RouterLink should not wrap its content in an `a` tag. Useful when
   * using `v-slot` to create a custom RouterLink
   */
  custom?: boolean
  /**
   * Class to apply when the link is active
   */
  activeClass?: string
  /**
   * Class to apply when the link is exact active
   */
  exactActiveClass?: string
  /**
   * Value passed to the attribute `aria-current` when the link is exact active. Defaults to "page"
   */
  ariaCurrentValue?:
    | 'page'
    | 'step'
    | 'location'
    | 'date'
    | 'time'
    | 'true'
    | 'false'
}

export interface UseLinkDevtoolsContext {
  route: RouteLocationNormalized & { href: string }
  isActive: boolean
  isExactActive: boolean
}

export type UseLinkOptions = VueUseOptions<RouterLinkOptions>

// TODO: we could allow currentRoute as a prop to expose `isActive` and
// `isExactActive` behavior should go through an RFC
// 传入组件的props
/**
 * 解析当前路由
 * @param props 
 * @returns 
 */
export function useLink(props: UseLinkOptions) {
  // 路由实例
  const router = inject(routerKey)!
  // 当前路由
  const currentRoute = inject(routeLocationKey)!
  // 解析目标路由
  const route = computed(() => router.resolve(unref(props.to)))
  // 当前激活的路由记录下标
  const activeRecordIndex = computed<number>(() => {
    // 匹配 目标 路由路径的路由
    const { matched } = route.value
    // 获取匹配到路由的数量, 如果 > 1 则为嵌套路由
    const { length } = matched
    // 获取最后一个符合的路由
    const routeMatched: RouteRecord | undefined = matched[length - 1]
    // 匹配 当前 路由路径的路由
    const currentMatched = currentRoute.matched
    // 如果当前路由没有匹配 或者 目标路由没有匹配, 则返回
    if (!routeMatched || !currentMatched.length) return -1
    // 在 当前 匹配的路由记录中寻找与 目标 路由相同的路由记录
    const index = currentMatched.findIndex(
      isSameRouteRecord.bind(null, routeMatched)
    )
    // 如果有相同记录, 直接返回
    if (index > -1) return index
    // possible parent record
    // 找到父路由记录的path, 如果没有则为 ''
    const parentRecordPath = getOriginalPath(
      matched[length - 2] as RouteRecord | undefined
    )
    return (
      // we are dealing with nested routes
      length > 1 &&
        // if the parent and matched route have the same path, this link is
        // referring to the empty child. Or we currently are on a different
        // child of the same parent
        getOriginalPath(routeMatched) === parentRecordPath &&
        // avoid comparing the child with its parent
        currentMatched[currentMatched.length - 1].path !== parentRecordPath
        ? currentMatched.findIndex(
            isSameRouteRecord.bind(null, matched[length - 2])
          )
        : index
    )
  })
  // 路由是否激活 (子路径的路由激活也会导致当前路由处于激活状态 .router-link-active)
  const isActive = computed<boolean>(
    () =>
      activeRecordIndex.value > -1 &&
      includesParams(currentRoute.params, route.value.params)
  )
  // 是否精确激活 (只有当前确切的路由激活 .router-link-exact-active)
  const isExactActive = computed<boolean>(
    () =>
      activeRecordIndex.value > -1 &&
      activeRecordIndex.value === currentRoute.matched.length - 1 &&
      isSameRouteLocationParams(currentRoute.params, route.value.params)
  )
  /**
   * 使用 router.replace 或者 router.push 来进行路由跳转
   * 具体用哪个取决于 router-link 组件的 props.replace
   * @param e 鼠标事件
   * @returns 
   */
  function navigate(
    e: MouseEvent = {} as MouseEvent
  ): Promise<void | NavigationFailure> {
    if (guardEvent(e)) {
      debugger
      return router[unref(props.replace) ? 'replace' : 'push'](
        unref(props.to)
        // avoid uncaught errors are they are logged anyway
      ).catch(noop)
    }
    return Promise.resolve()
  }

  // devtools only
  if ((__DEV__ || __FEATURE_PROD_DEVTOOLS__) && isBrowser) {
    const instance = getCurrentInstance()
    if (instance) {
      const linkContextDevtools: UseLinkDevtoolsContext = {
        route: route.value,
        isActive: isActive.value,
        isExactActive: isExactActive.value,
      }

      // @ts-expect-error: this is internal
      instance.__vrl_devtools = instance.__vrl_devtools || []
      // @ts-expect-error: this is internal
      instance.__vrl_devtools.push(linkContextDevtools)
      watchEffect(
        () => {
          linkContextDevtools.route = route.value
          linkContextDevtools.isActive = isActive.value
          linkContextDevtools.isExactActive = isExactActive.value
        },
        { flush: 'post' }
      )
    }
  }

  return {
    route,
    href: computed(() => route.value.href),
    isActive,
    isExactActive,
    navigate,
  }
}

export const RouterLinkImpl = /*#__PURE__*/ defineComponent({
  name: 'RouterLink',
  props: {
    // 目标路由地址
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

  useLink,

  setup(props, { slots }) {
    const link = reactive(useLink(props))
    const { options } = inject(routerKey)!

    const elClass = computed(() => ({
      // 优先使用组件级定义的`activeClass` 其次是全局定义的 `linkActiveClass` 最后是默认值
      [getLinkClass(
        props.activeClass,
        options.linkActiveClass,
        'router-link-active'
      )]: link.isActive,
      // [getLinkClass(
      //   props.inactiveClass,
      //   options.linkInactiveClass,
      //   'router-link-inactive'
      // )]: !link.isExactActive,
      [getLinkClass(
        props.exactActiveClass,
        options.linkExactActiveClass,
        'router-link-exact-active'
      )]: link.isExactActive,
    }))
    return () => {
      const children = slots.default && slots.default(link)
      // props设置了custom, 表明使用自定义标签来代替a标签包裹
      return props.custom
        ? children
        : h(
            'a',
            {
              'aria-current': link.isExactActive
                ? props.ariaCurrentValue
                : null,
              href: link.href,
              // this would override user added attrs but Vue will still add
              // the listener so we end up triggering both
              onClick: link.navigate,
              class: elClass.value,
            },
            children
          )
    }
  },
})

// export the public type for h/tsx inference
// also to avoid inline import() in generated d.ts files
/**
 * Component to render a link that triggers a navigation on click.
 */
export const RouterLink = RouterLinkImpl as unknown as {
  new (): {
    $props: AllowedComponentProps &
      ComponentCustomProps &
      VNodeProps &
      RouterLinkProps

    $slots: {
      default: (arg: UnwrapRef<ReturnType<typeof useLink>>) => VNode[]
    }
  }

  /**
   * Access to `useLink()` without depending on using vue-router
   * 在不依赖vue-router的情况下来调用 `useLink()`
   * @internal
   */
  useLink: typeof useLink
}

function guardEvent(e: MouseEvent) {
  // don't redirect with control keys
  if (e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) return
  // don't redirect when preventDefault called
  if (e.defaultPrevented) return
  // don't redirect on right click
  if (e.button !== undefined && e.button !== 0) return
  // don't redirect if `target="_blank"`
  // @ts-expect-error getAttribute does exist
  if (e.currentTarget && e.currentTarget.getAttribute) {
    // @ts-expect-error getAttribute exists
    const target = e.currentTarget.getAttribute('target')
    if (/\b_blank\b/i.test(target)) return
  }
  // this may be a Weex event which doesn't have this method
  if (e.preventDefault) e.preventDefault()

  return true
}

function includesParams(
  outer: RouteLocation['params'],
  inner: RouteLocation['params']
): boolean {
  for (const key in inner) {
    const innerValue = inner[key]
    const outerValue = outer[key]
    if (typeof innerValue === 'string') {
      if (innerValue !== outerValue) return false
    } else {
      if (
        !Array.isArray(outerValue) ||
        outerValue.length !== innerValue.length ||
        innerValue.some((value, i) => value !== outerValue[i])
      )
        return false
    }
  }

  return true
}

/**
 * Get the original path value of a record by following its aliasOf
 * 根据路径别名来获取路由记录的原始路径
 * @param record
 */
function getOriginalPath(record: RouteRecord | undefined): string {
  return record ? (record.aliasOf ? record.aliasOf.path : record.path) : ''
}

/**
 * Utility class to get the active class based on defaults.
 * 获取router-link样式, 优先级 propClass -> globalClass -> defaultClass
 * @param propClass
 * @param globalClass
 * @param defaultClass
 */
const getLinkClass = (
  propClass: string | undefined,
  globalClass: string | undefined,
  defaultClass: string
): string =>
  propClass != null
    ? propClass
    : globalClass != null
    ? globalClass
    : defaultClass
