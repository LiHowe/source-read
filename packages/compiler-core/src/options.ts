import { ElementNode, Namespace, TemplateChildNode, ParentNode } from './ast'
import { TextModes } from './parse'
import { CompilerError } from './errors'
import {
  NodeTransform,
  DirectiveTransform,
  TransformContext
} from './transform'
import { CompilerCompatOptions } from './compat/compatConfig'
import { ParserPlugin } from '@babel/parser'

export interface ErrorHandlingOptions {
  onWarn?: (warning: CompilerError) => void
  onError?: (error: CompilerError) => void
}

export interface ParserOptions
  extends ErrorHandlingOptions,
    CompilerCompatOptions {
  /**
   * 平台原生元素, 浏览器平台如`<div>`, `<span>`等
   */
  isNativeTag?: (tag: string) => boolean
  /**
   * 平台自闭合元素, 浏览器平台如 `<img>`, `<br>`, `<hr>`
   */
  isVoidTag?: (tag: string) => boolean
  /**
   * 可以保留元素内部空格的元素, 如 `<pre>`
   */
  isPreTag?: (tag: string) => boolean
  /**
   * 平台相关内置组件, 如Vue在浏览器平台的 `<Transition>` 组件
   */
  isBuiltInComponent?: (tag: string) => symbol | void
  /**
   * Separate option for end users to extend the native elements list
   * 是否是用户扩展的自定义标签, 避免当做组件来解析
   */
  isCustomElement?: (tag: string) => boolean | void
  /**
   * 获取标签命名空间
   */
  getNamespace?: (tag: string, parent: ElementNode | undefined) => Namespace
  /**
   * 获取这个元素的文本解析模式(TextMode)
   */
  getTextMode?: (
    node: ElementNode,
    parent: ElementNode | undefined
  ) => TextModes
  /**
   * 插值分隔符, 默认`{{ }}`
   * @default ['{{', '}}']
   */
  delimiters?: [string, string]
  /**
   * 空格处理策略
   * 保留空格 | 压缩空格
   */
  whitespace?: 'preserve' | 'condense'
  /**
   * 仅DOM编译器需要，解析实体字符，例如：$gt 解析为 >  $lt 解析为 <
   */
  decodeEntities?: (rawText: string, asAttr: boolean) => string
  /**
   * Whether to keep comments in the templates AST.
   * This defaults to `true` in development and `false` in production builds.
   * 是否在AST中保留注释, 开发环境默认为 `true`, 生产环境为 `false`
   */
  comments?: boolean
}

export type HoistTransform = (
  children: TemplateChildNode[],
  context: TransformContext,
  parent: ParentNode
) => void

export const enum BindingTypes {
  /**
   * returned from data()
   */
  DATA = 'data',
  /**
   * declared as a prop
   */
  PROPS = 'props',
  /**
   * a local alias of a `<script setup>` destructured prop.
   * the original is stored in __propsAliases of the bindingMetadata object.
   */
  PROPS_ALIASED = 'props-aliased',
  /**
   * a let binding (may or may not be a ref)
   */
  SETUP_LET = 'setup-let',
  /**
   * a const binding that can never be a ref.
   * these bindings don't need `unref()` calls when processed in inlined
   * template expressions.
   */
  SETUP_CONST = 'setup-const',
  /**
   * a const binding that may be a ref.
   */
  SETUP_MAYBE_REF = 'setup-maybe-ref',
  /**
   * bindings that are guaranteed to be refs
   */
  SETUP_REF = 'setup-ref',
  /**
   * declared by other options, e.g. computed, inject
   */
  OPTIONS = 'options'
}

export type BindingMetadata = {
  [key: string]: BindingTypes | undefined
} & {
  __isScriptSetup?: boolean
  __propsAliases?: Record<string, string>
}

interface SharedTransformCodegenOptions {
  /**
   * Transform expressions like {{ foo }} to `_ctx.foo`.
   * If this option is false, the generated code will be wrapped in a
   * `with (this) { ... }` block.
   * - This is force-enabled in module mode, since modules are by default strict
   * and cannot use `with`
   * @default mode === 'module'
   */
  prefixIdentifiers?: boolean
  /**
   * Control whether generate SSR-optimized render functions instead.
   * The resulting function must be attached to the component via the
   * `ssrRender` option instead of `render`.
   *
   * When compiler generates code for SSR's fallback branch, we need to set it to false:
   *  - context.ssr = false
   *
   * see `subTransform` in `ssrTransformComponent.ts`
   */
  ssr?: boolean
  /**
   * Indicates whether the compiler generates code for SSR,
   * it is always true when generating code for SSR,
   * regardless of whether we are generating code for SSR's fallback branch,
   * this means that when the compiler generates code for SSR's fallback branch:
   *  - context.ssr = false
   *  - context.inSSR = true
   */
  inSSR?: boolean
  /**
   * Optional binding metadata analyzed from script - used to optimize
   * binding access when `prefixIdentifiers` is enabled.
   */
  bindingMetadata?: BindingMetadata
  /**
   * Compile the function for inlining inside setup().
   * This allows the function to directly access setup() local bindings.
   */
  inline?: boolean
  /**
   * Indicates that transforms and codegen should try to output valid TS code
   */
  isTS?: boolean
  /**
   * Filename for source map generation.
   * Also used for self-recursive reference in templates
   * @default 'template.vue.html'
   */
  filename?: string
}

export interface TransformOptions
  extends SharedTransformCodegenOptions,
    ErrorHandlingOptions,
    CompilerCompatOptions {
  /**
   * An array of node transforms to be applied to every AST node.
   */
  nodeTransforms?: NodeTransform[]
  /**
   * An object of { name: transform } to be applied to every directive attribute
   * node found on element nodes.
   */
  directiveTransforms?: Record<string, DirectiveTransform | undefined>
  /**
   * An optional hook to transform a node being hoisted.
   * used by compiler-dom to turn hoisted nodes into stringified HTML vnodes.
   * @default null
   */
  transformHoist?: HoistTransform | null
  /**
   * If the pairing runtime provides additional built-in elements, use this to
   * mark them as built-in so the compiler will generate component vnodes
   * for them.
   */
  isBuiltInComponent?: (tag: string) => symbol | void
  /**
   * Used by some transforms that expects only native elements
   */
  isCustomElement?: (tag: string) => boolean | void
  /**
   * Transform expressions like {{ foo }} to `_ctx.foo`.
   * If this option is false, the generated code will be wrapped in a
   * `with (this) { ... }` block.
   * - This is force-enabled in module mode, since modules are by default strict
   * and cannot use `with`
   * @default mode === 'module'
   */
  prefixIdentifiers?: boolean
  /**
   * Hoist static VNodes and props objects to `_hoisted_x` constants
   * @default false
   */
  hoistStatic?: boolean
  /**
   * Cache v-on handlers to avoid creating new inline functions on each render,
   * also avoids the need for dynamically patching the handlers by wrapping it.
   * e.g `@click="foo"` by default is compiled to `{ onClick: foo }`. With this
   * option it's compiled to:
   * ```js
   * { onClick: _cache[0] || (_cache[0] = e => _ctx.foo(e)) }
   * ```
   * - Requires "prefixIdentifiers" to be enabled because it relies on scope
   * analysis to determine if a handler is safe to cache.
   * @default false
   */
  cacheHandlers?: boolean
  /**
   * A list of parser plugins to enable for `@babel/parser`, which is used to
   * parse expressions in bindings and interpolations.
   * https://babeljs.io/docs/en/next/babel-parser#plugins
   */
  expressionPlugins?: ParserPlugin[]
  /**
   * SFC scoped styles ID
   */
  scopeId?: string | null
  /**
   * Indicates this SFC template has used :slotted in its styles
   * Defaults to `true` for backwards compatibility - SFC tooling should set it
   * to `false` if no `:slotted` usage is detected in `<style>`
   */
  slotted?: boolean
  /**
   * SFC `<style vars>` injection string
   * Should already be an object expression, e.g. `{ 'xxxx-color': color }`
   * needed to render inline CSS variables on component root
   */
  ssrCssVars?: string
}

export interface CodegenOptions extends SharedTransformCodegenOptions {
  /**
   * - `module` mode will generate ES module import statements for helpers
   * and export the render function as the default export.
   * - `function` mode will generate a single `const { helpers... } = Vue`
   * statement and return the render function. It expects `Vue` to be globally
   * available (or passed by wrapping the code with an IIFE). It is meant to be
   * used with `new Function(code)()` to generate a render function at runtime.
   * @default 'function'
   */
  mode?: 'module' | 'function'
  /**
   * Generate source map?
   * @default false
   */
  sourceMap?: boolean
  /**
   * SFC scoped styles ID
   */
  scopeId?: string | null
  /**
   * Option to optimize helper import bindings via variable assignment
   * (only used for webpack code-split)
   * @default false
   */
  optimizeImports?: boolean
  /**
   * Customize where to import runtime helpers from.
   * @default 'vue'
   */
  runtimeModuleName?: string
  /**
   * Customize where to import ssr runtime helpers from/**
   * @default 'vue/server-renderer'
   */
  ssrRuntimeModuleName?: string
  /**
   * Customize the global variable name of `Vue` to get helpers from
   * in function mode
   * @default 'Vue'
   */
  runtimeGlobalName?: string
}

export type CompilerOptions = ParserOptions & TransformOptions & CodegenOptions
