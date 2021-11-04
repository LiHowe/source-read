import { ErrorHandlingOptions, ParserOptions } from './options'
import { NO, isArray, makeMap, extend } from '@vue/shared'
import {
  ErrorCodes,
  createCompilerError,
  defaultOnError,
  defaultOnWarn
} from './errors'
import {
  assert,
  advancePositionWithMutation,
  advancePositionWithClone,
  isCoreComponent,
  isBindKey
} from './utils'
import {
  Namespaces,
  AttributeNode,
  CommentNode,
  DirectiveNode,
  ElementNode,
  ElementTypes,
  ExpressionNode,
  NodeTypes,
  Position,
  RootNode,
  SourceLocation,
  TextNode,
  TemplateChildNode,
  InterpolationNode,
  createRoot,
  ConstantTypes
} from './ast'
import {
  checkCompatEnabled,
  CompilerCompatOptions,
  CompilerDeprecationTypes,
  isCompatEnabled,
  warnDeprecation
} from './compat/compatConfig'

type OptionalOptions =
  | 'whitespace'
  | 'isNativeTag'
  | 'isBuiltInComponent'
  | keyof CompilerCompatOptions
type MergedParserOptions = Omit<Required<ParserOptions>, OptionalOptions> &
  Pick<ParserOptions, OptionalOptions>
type AttributeValue =
  | {
      content: string
      isQuoted: boolean
      loc: SourceLocation
    }
  | undefined

// The default decoder only provides escapes for characters reserved as part of
// the template syntax, and is only used if the custom renderer did not provide
// a platform-specific decoder.
const decodeRE = /&(gt|lt|amp|apos|quot);/g
const decodeMap: Record<string, string> = {
  gt: '>',
  lt: '<',
  amp: '&',
  apos: "'",
  quot: '"'
}

export const defaultParserOptions: MergedParserOptions = {
  delimiters: [`{{`, `}}`],
  getNamespace: () => Namespaces.HTML,
  getTextMode: () => TextModes.DATA,
  isVoidTag: NO,
  isPreTag: NO,
  isCustomElement: NO,
  decodeEntities: (rawText: string): string =>
    rawText.replace(decodeRE, (_, p1) => decodeMap[p1]),
  onError: defaultOnError,
  onWarn: defaultOnWarn,
  comments: __DEV__
}

export const enum TextModes {
  //          | Elements | Entities | End sign              | Inside of
  DATA, //    | ✔        | ✔        | End tags of ancestors |
  RCDATA, //  | ✘        | ✔        | End tag of the parent | <textarea>
  RAWTEXT, // | ✘        | ✘        | End tag of the parent | <style>,<script>
  CDATA,
  ATTRIBUTE_VALUE
}

export interface ParserContext {
  // 解析器选项
  options: MergedParserOptions
  // 原始字符串模板
  readonly originalSource: string
  // 当前剩余待解析字符串模板
  source: string
  // 偏移量
  offset: number
  // 行数
  line: number
  // 列数
  column: number
  // 是否是在`<pre>`标签内, 保留空格
  inPre: boolean // HTML <pre> tag, preserve whitespaces
  // 是否是在`v-pre`指令所在的标签内, 不处理指令和插值
  inVPre: boolean // v-pre, do not process directives and interpolations
  onWarn: NonNullable<ErrorHandlingOptions['onWarn']>
}

/**
 * 基本模板解析器
 * @param content 字符串模板
 * @param options 分析器选项
 * @returns
 */
export function baseParse(
  content: string,
  options: ParserOptions = {}
): RootNode {
  console.log('[log] baseParse')
  // 创建解析上下文对象(合并分析器options)
  const context = createParserContext(content, options)
  // 获取开始解析的指针位置
  const start = getCursor(context)
  return createRoot(
    // 解析子节点
    parseChildren(context, TextModes.DATA, []),
    // 获取位置
    getSelection(context, start)
  )
}

/**
 * 创建解析上下文对象, 用于记录当前解析状态
 * @param content
 * @param rawOptions
 * @returns
 */
function createParserContext(
  content: string,
  rawOptions: ParserOptions
): ParserContext {
  // 拷贝默认解析器设置
  const options = extend({}, defaultParserOptions)

  let key: keyof ParserOptions
  // 将解析器选项进行合并
  for (key in rawOptions) {
    // @ts-ignore
    options[key] =
      rawOptions[key] === undefined
        ? defaultParserOptions[key]
        : rawOptions[key]
  }
  // 返回上下文对象
  return {
    options,
    column: 1,
    line: 1,
    offset: 0,
    originalSource: content,
    source: content,
    inPre: false,
    inVPre: false,
    onWarn: options.onWarn
  }
}

/**
 * 解析孩子节点
 * @param context 待解析内容
 * @param mode 解析模式
 * @param ancestors 祖先元素们
 * @returns
 */
function parseChildren(
  context: ParserContext,
  mode: TextModes,
  ancestors: ElementNode[]
): TemplateChildNode[] {
  // 获取父元素
  const parent = last(ancestors)
  console.log('解析子节点, 当前父节点是', parent)
  const ns = parent ? parent.ns : Namespaces.HTML
  const nodes: TemplateChildNode[] = []
  // 循环解析字符串直到字符串最后
  while (!isEnd(context, mode, ancestors)) {
    console.log('继续解析, 剩余字符串:', context.source)
    __TEST__ && assert(context.source.length > 0)
    // 原始字符串
    const s = context.source
    let node: TemplateChildNode | TemplateChildNode[] | undefined = undefined

    if (mode === TextModes.DATA || mode === TextModes.RCDATA) {
      if (!context.inVPre && startsWith(s, context.options.delimiters[0])) {
        // 以'{{'开头的字符串，即 插值
        // 分析插值
        node = parseInterpolation(context, mode)
      } else if (mode === TextModes.DATA && s[0] === '<') {
        // 如果模板字符串以'<'开头, 即HTML标签
        // https://html.spec.whatwg.org/multipage/parsing.html#tag-open-state
        if (s.length === 1) {
          emitError(context, ErrorCodes.EOF_BEFORE_TAG_NAME, 1)
        } else if (s[1] === '!') {
          // https://html.spec.whatwg.org/multipage/parsing.html#markup-declaration-open-state
          // 以！开头的字符串， 基本是注释
          if (startsWith(s, '<!--')) {
            node = parseComment(context)
          } else if (startsWith(s, '<!DOCTYPE')) {
            // Ignore DOCTYPE by a limitation.
            node = parseBogusComment(context)
          } else if (startsWith(s, '<![CDATA[')) {
            if (ns !== Namespaces.HTML) {
              node = parseCDATA(context, ancestors)
            } else {
              emitError(context, ErrorCodes.CDATA_IN_HTML_CONTENT)
              node = parseBogusComment(context)
            }
          } else {
            emitError(context, ErrorCodes.INCORRECTLY_OPENED_COMMENT)
            node = parseBogusComment(context)
          }
        } else if (s[1] === '/') {
          // https://html.spec.whatwg.org/multipage/parsing.html#end-tag-open-state
          if (s.length === 2) {
            emitError(context, ErrorCodes.EOF_BEFORE_TAG_NAME, 2)
          } else if (s[2] === '>') {
            emitError(context, ErrorCodes.MISSING_END_TAG_NAME, 2)
            advanceBy(context, 3)
            continue
          } else if (/[a-z]/i.test(s[2])) {
            emitError(context, ErrorCodes.X_INVALID_END_TAG)
            parseTag(context, TagType.End, parent)
            continue
          } else {
            emitError(
              context,
              ErrorCodes.INVALID_FIRST_CHARACTER_OF_TAG_NAME,
              2
            )
            node = parseBogusComment(context)
          }
        } else if (/[a-z]/i.test(s[1])) {
          node = parseElement(context, ancestors)

          // 2.x <template> with no directive compat
          if (
            __COMPAT__ &&
            isCompatEnabled(
              CompilerDeprecationTypes.COMPILER_NATIVE_TEMPLATE,
              context
            ) &&
            node &&
            node.tag === 'template' &&
            !node.props.some(
              p =>
                p.type === NodeTypes.DIRECTIVE &&
                isSpecialTemplateDirective(p.name)
            )
          ) {
            __DEV__ &&
              warnDeprecation(
                CompilerDeprecationTypes.COMPILER_NATIVE_TEMPLATE,
                context,
                node.loc
              )
            node = node.children
          }
        } else if (s[1] === '?') {
          emitError(
            context,
            ErrorCodes.UNEXPECTED_QUESTION_MARK_INSTEAD_OF_TAG_NAME,
            1
          )
          node = parseBogusComment(context)
        } else {
          emitError(context, ErrorCodes.INVALID_FIRST_CHARACTER_OF_TAG_NAME, 1)
        }
      }
    }
    if (!node) {
      // 解析文本
      node = parseText(context, mode)
    }
    // 将解析好的文本对象进行存储
    if (isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        pushNode(nodes, node[i])
      }
    } else {
      pushNode(nodes, node)
    }
  }

  // Whitespace handling strategy like v2
  let removedWhitespace = false
  if (mode !== TextModes.RAWTEXT && mode !== TextModes.RCDATA) {
    const shouldCondense = context.options.whitespace !== 'preserve'
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i]
      if (!context.inPre && node.type === NodeTypes.TEXT) {
        if (!/[^\t\r\n\f ]/.test(node.content)) {
          const prev = nodes[i - 1]
          const next = nodes[i + 1]
          // Remove if:
          // - the whitespace is the first or last node, or:
          // - (condense mode) the whitespace is adjacent to a comment, or:
          // - (condense mode) the whitespace is between two elements AND contains newline
          if (
            !prev ||
            !next ||
            (shouldCondense &&
              (prev.type === NodeTypes.COMMENT ||
                next.type === NodeTypes.COMMENT ||
                (prev.type === NodeTypes.ELEMENT &&
                  next.type === NodeTypes.ELEMENT &&
                  /[\r\n]/.test(node.content))))
          ) {
            removedWhitespace = true
            nodes[i] = null as any
          } else {
            // Otherwise, the whitespace is condensed into a single space
            node.content = ' '
          }
        } else if (shouldCondense) {
          // in condense mode, consecutive whitespaces in text are condensed
          // down to a single space.
          // 如果需要缩进空格, 使用正则将多个空格或者换行符替换成单个空格
          node.content = node.content.replace(/[\t\r\n\f ]+/g, ' ')
        }
      }
      // Remove comment nodes if desired by configuration.
      else if (node.type === NodeTypes.COMMENT && !context.options.comments) {
        removedWhitespace = true
        nodes[i] = null as any
      }
    }
    if (context.inPre && parent && context.options.isPreTag(parent.tag)) {
      // remove leading newline per html spec
      // https://html.spec.whatwg.org/multipage/grouping-content.html#the-pre-element
      const first = nodes[0]
      if (first && first.type === NodeTypes.TEXT) {
        first.content = first.content.replace(/^\r?\n/, '')
      }
    }
  }

  return removedWhitespace ? nodes.filter(Boolean) : nodes
}
/**
 * 将节点放入模板孩子节点数组
 * @param nodes 模板孩子节点数组
 * @param node 待放入节点
 * @returns
 */
function pushNode(nodes: TemplateChildNode[], node: TemplateChildNode): void {
  if (node.type === NodeTypes.TEXT) {
    // 当上一个节点和当前节点都是文本的时候进行合并
    const prev = last(nodes)
    // Merge if both this and the previous node are text and those are
    // consecutive. This happens for cases like "a < b".
    if (
      prev &&
      prev.type === NodeTypes.TEXT &&
      prev.loc.end.offset === node.loc.start.offset
    ) {
      prev.content += node.content
      prev.loc.end = node.loc.end
      prev.loc.source += node.loc.source
      return
    }
  }

  nodes.push(node)
}

function parseCDATA(
  context: ParserContext,
  ancestors: ElementNode[]
): TemplateChildNode[] {
  __TEST__ &&
    assert(last(ancestors) == null || last(ancestors)!.ns !== Namespaces.HTML)
  __TEST__ && assert(startsWith(context.source, '<![CDATA['))

  advanceBy(context, 9)
  const nodes = parseChildren(context, TextModes.CDATA, ancestors)
  if (context.source.length === 0) {
    emitError(context, ErrorCodes.EOF_IN_CDATA)
  } else {
    __TEST__ && assert(startsWith(context.source, ']]>'))
    advanceBy(context, 3)
  }

  return nodes
}

/**
 * 解析注释
 * @param context
 */
function parseComment(context: ParserContext): CommentNode {
  __TEST__ && assert(startsWith(context.source, '<!--'))

  const start = getCursor(context)
  let content: string

  // Regular comment.
  const match = /--(\!)?>/.exec(context.source)
  if (!match) {
    content = context.source.slice(4)
    advanceBy(context, context.source.length)
    emitError(context, ErrorCodes.EOF_IN_COMMENT)
  } else {
    if (match.index <= 3) {
      emitError(context, ErrorCodes.ABRUPT_CLOSING_OF_EMPTY_COMMENT)
    }
    if (match[1]) {
      emitError(context, ErrorCodes.INCORRECTLY_CLOSED_COMMENT)
    }
    content = context.source.slice(4, match.index)

    // Advancing with reporting nested comments.
    const s = context.source.slice(0, match.index)
    let prevIndex = 1,
      nestedIndex = 0
    while ((nestedIndex = s.indexOf('<!--', prevIndex)) !== -1) {
      advanceBy(context, nestedIndex - prevIndex + 1)
      if (nestedIndex + 4 < s.length) {
        emitError(context, ErrorCodes.NESTED_COMMENT)
      }
      prevIndex = nestedIndex + 1
    }
    advanceBy(context, match.index + match[0].length - prevIndex + 1)
  }

  return {
    type: NodeTypes.COMMENT,
    content,
    loc: getSelection(context, start)
  }
}

/**
 * 解析文档声明`<!DOCTYPE`, 返回节点type为`COMMENT`
 * @param context
 */
function parseBogusComment(context: ParserContext): CommentNode | undefined {
  __TEST__ && assert(/^<(?:[\!\?]|\/[^a-z>])/i.test(context.source))

  const start = getCursor(context)
  const contentStart = context.source[1] === '?' ? 1 : 2
  let content: string

  const closeIndex = context.source.indexOf('>')
  if (closeIndex === -1) {
    content = context.source.slice(contentStart)
    advanceBy(context, context.source.length)
  } else {
    content = context.source.slice(contentStart, closeIndex)
    advanceBy(context, closeIndex + 1)
  }

  return {
    type: NodeTypes.COMMENT,
    content,
    loc: getSelection(context, start)
  }
}

/**
 * 解析HTML元素
 * @param context
 * @param ancestors
 */
function parseElement(
  context: ParserContext,
  ancestors: ElementNode[]
): ElementNode | undefined {
  __TEST__ && assert(/^<[a-z]/i.test(context.source))

  // Start tag.
  const wasInPre = context.inPre
  const wasInVPre = context.inVPre
  const parent = last(ancestors)
  const element = parseTag(context, TagType.Start, parent)
  const isPreBoundary = context.inPre && !wasInPre
  const isVPreBoundary = context.inVPre && !wasInVPre
  // 元素是否是自闭合标签 或者 是否是空标签
  if (element.isSelfClosing || context.options.isVoidTag(element.tag)) {
    // #4030 self-closing <pre> tag
    if (isPreBoundary) {
      context.inPre = false
    }
    if (isVPreBoundary) {
      context.inVPre = false
    }
    return element
  }

  // Children., 现将元素入栈,解析完子节点后出栈
  ancestors.push(element)
  const mode = context.options.getTextMode(element, parent)
  const children = parseChildren(context, mode, ancestors)
  ancestors.pop()

  // 2.x inline-template compat
  if (__COMPAT__) {
    const inlineTemplateProp = element.props.find(
      p => p.type === NodeTypes.ATTRIBUTE && p.name === 'inline-template'
    ) as AttributeNode
    if (
      inlineTemplateProp &&
      checkCompatEnabled(
        CompilerDeprecationTypes.COMPILER_INLINE_TEMPLATE,
        context,
        inlineTemplateProp.loc
      )
    ) {
      const loc = getSelection(context, element.loc.end)
      inlineTemplateProp.value = {
        type: NodeTypes.TEXT,
        content: loc.source,
        loc
      }
    }
  }

  element.children = children

  // End tag.
  if (startsWithEndTagOpen(context.source, element.tag)) {
    parseTag(context, TagType.End, parent)
  } else {
    emitError(context, ErrorCodes.X_MISSING_END_TAG, 0, element.loc.start)
    if (context.source.length === 0 && element.tag.toLowerCase() === 'script') {
      const first = children[0]
      if (first && startsWith(first.loc.source, '<!--')) {
        emitError(context, ErrorCodes.EOF_IN_SCRIPT_HTML_COMMENT_LIKE_TEXT)
      }
    }
  }

  element.loc = getSelection(context, element.loc.start)

  if (isPreBoundary) {
    context.inPre = false
  }
  if (isVPreBoundary) {
    context.inVPre = false
  }
  return element
}

const enum TagType {
  Start,
  End
}

const isSpecialTemplateDirective = /*#__PURE__*/ makeMap(
  `if,else,else-if,for,slot`
)

/**
 * 解析标签(开始标签和结束标签)
 * Parse a tag (E.g. `<div id=a>`) with that type (start tag or end tag).
 */
function parseTag(
  context: ParserContext,
  type: TagType.Start,
  parent: ElementNode | undefined
): ElementNode
function parseTag(
  context: ParserContext,
  type: TagType.End,
  parent: ElementNode | undefined
): void
function parseTag(
  context: ParserContext,
  type: TagType,
  parent: ElementNode | undefined
): ElementNode | undefined {
  __TEST__ && assert(/^<\/?[a-z]/i.test(context.source))
  __TEST__ &&
    assert(
      type === (startsWith(context.source, '</') ? TagType.End : TagType.Start)
    )

  // Tag open.
  const start = getCursor(context)
  // 匹配标签名的正则
  const match = /^<\/?([a-z][^\t\r\n\f />]*)/i.exec(context.source)!
  // 获取匹配到的标签名
  const tag = match[1]
  // 获取命名空间
  const ns = context.options.getNamespace(tag, parent)
  // 截取标签
  advanceBy(context, match[0].length)
  // 去除空格
  advanceSpaces(context)

  // save current state in case we need to re-parse attributes with v-pre
  // 保存当前状态以防我们需要重新解析包含v-pre指令标签的属性
  const cursor = getCursor(context)
  // 获取当前解析进度
  const currentSource = context.source

  // check <pre> tag
  // 检查是否是<pre>标签
  if (context.options.isPreTag(tag)) {
    // 更新上下文inPre标识, 表明包含pre标签
    context.inPre = true
  }

  // Attributes.
  // 解析标签属性
  let props = parseAttributes(context, type)

  // check v-pre
  // 检查v-pre指令的标签
  if (
    type === TagType.Start && // 如果是开始标签
    !context.inVPre && // 且不是pre标签
    props.some(p => p.type === NodeTypes.DIRECTIVE && p.name === 'pre') // 并且有v-pre指令
  ) {
    context.inVPre = true
    // reset context
    extend(context, cursor)
    context.source = currentSource
    // re-parse attrs and filter out v-pre itself
    props = parseAttributes(context, type).filter(p => p.name !== 'v-pre')
  }

  // Tag close.
  let isSelfClosing = false
  if (context.source.length === 0) {
    emitError(context, ErrorCodes.EOF_IN_TAG)
  } else {
    isSelfClosing = startsWith(context.source, '/>')
    if (type === TagType.End && isSelfClosing) {
      emitError(context, ErrorCodes.END_TAG_WITH_TRAILING_SOLIDUS)
    }
    advanceBy(context, isSelfClosing ? 2 : 1)
  }

  if (type === TagType.End) {
    return
  }

  // 2.x deprecation checks
  if (
    __COMPAT__ &&
    __DEV__ &&
    isCompatEnabled(
      CompilerDeprecationTypes.COMPILER_V_IF_V_FOR_PRECEDENCE,
      context
    )
  ) {
    let hasIf = false
    let hasFor = false
    for (let i = 0; i < props.length; i++) {
      const p = props[i]
      if (p.type === NodeTypes.DIRECTIVE) {
        if (p.name === 'if') {
          hasIf = true
        } else if (p.name === 'for') {
          hasFor = true
        }
      }
      if (hasIf && hasFor) {
        warnDeprecation(
          CompilerDeprecationTypes.COMPILER_V_IF_V_FOR_PRECEDENCE,
          context,
          getSelection(context, start)
        )
        break
      }
    }
  }

  let tagType = ElementTypes.ELEMENT
  if (!context.inVPre) {
    if (tag === 'slot') {
      tagType = ElementTypes.SLOT
    } else if (tag === 'template') {
      if (
        props.some(
          p =>
            p.type === NodeTypes.DIRECTIVE && isSpecialTemplateDirective(p.name)
        )
      ) {
        tagType = ElementTypes.TEMPLATE
      }
    } else if (isComponent(tag, props, context)) {
      tagType = ElementTypes.COMPONENT
    }
  }

  return {
    type: NodeTypes.ELEMENT,
    ns,
    tag,
    tagType,
    props,
    isSelfClosing,
    children: [],
    loc: getSelection(context, start),
    codegenNode: undefined // to be created during transform phase
  }
}

function isComponent(
  tag: string,
  props: (AttributeNode | DirectiveNode)[],
  context: ParserContext
) {
  const options = context.options
  if (options.isCustomElement(tag)) {
    return false
  }
  if (
    tag === 'component' ||
    /^[A-Z]/.test(tag) ||
    isCoreComponent(tag) ||
    (options.isBuiltInComponent && options.isBuiltInComponent(tag)) ||
    (options.isNativeTag && !options.isNativeTag(tag))
  ) {
    return true
  }
  // at this point the tag should be a native tag, but check for potential "is"
  // casting
  for (let i = 0; i < props.length; i++) {
    const p = props[i]
    if (p.type === NodeTypes.ATTRIBUTE) {
      if (p.name === 'is' && p.value) {
        if (p.value.content.startsWith('vue:')) {
          return true
        } else if (
          __COMPAT__ &&
          checkCompatEnabled(
            CompilerDeprecationTypes.COMPILER_IS_ON_ELEMENT,
            context,
            p.loc
          )
        ) {
          return true
        }
      }
    } else {
      // directive
      // v-is (TODO Deprecate)
      if (p.name === 'is') {
        return true
      } else if (
        // :is on plain element - only treat as component in compat mode
        p.name === 'bind' &&
        isBindKey(p.arg, 'is') &&
        __COMPAT__ &&
        checkCompatEnabled(
          CompilerDeprecationTypes.COMPILER_IS_ON_ELEMENT,
          context,
          p.loc
        )
      ) {
        return true
      }
    }
  }
}

/**
 * 解析标签属性
 * @param context 解析上下文对象
 * @param type 解析标签的类型
 */
function parseAttributes(
  context: ParserContext,
  type: TagType
): (AttributeNode | DirectiveNode)[] {
  // 初始化属性集合
  const props = []
  // 标签名集合
  const attributeNames = new Set<string>()
  // 循环, 直到解析到结束标签末尾
  while (
    context.source.length > 0 &&
    !startsWith(context.source, '>') && // 标准标签结束字符
    !startsWith(context.source, '/>') // 自闭标签结束字符
  ) {
    // 如果解析的标签以/开始, 报错
    if (startsWith(context.source, '/')) {
      emitError(context, ErrorCodes.UNEXPECTED_SOLIDUS_IN_TAG)
      advanceBy(context, 1)
      advanceSpaces(context)
      continue
    }
    // 如果当前标签是结束标签, 报错(因为结束标签肯定要是以>结束
    if (type === TagType.End) {
      emitError(context, ErrorCodes.END_TAG_WITH_ATTRIBUTES)
    }
    // 解析标签属性
    const attr = parseAttribute(context, attributeNames)

    // Trim whitespace between class
    // https://github.com/vuejs/vue-next/issues/4251
    // 缩进class属性值之间的空格
    if (
      attr.type === NodeTypes.ATTRIBUTE &&
      attr.value &&
      attr.name === 'class'
    ) {
      attr.value.content = attr.value.content.replace(/\s+/g, ' ').trim() // 美化空格, 将多个空格改为1个缩进
    }

    if (type === TagType.Start) {
      props.push(attr)
    }

    if (/^[^\t\r\n\f />]/.test(context.source)) {
      emitError(context, ErrorCodes.MISSING_WHITESPACE_BETWEEN_ATTRIBUTES)
    }
    advanceSpaces(context)
  }
  return props
}

/**
 * 解析标签属性
 * @param context 待解析文本
 * @param nameSet 属性
 */
function parseAttribute(
  context: ParserContext,
  nameSet: Set<string>
): AttributeNode | DirectiveNode {
  __TEST__ && assert(/^[^\t\r\n\f />]/.test(context.source))

  const start = getCursor(context)
  // 获取标签属性名正则
  const match = /^[^\t\r\n\f />][^\t\r\n\f />=]*/.exec(context.source)!
  // 匹配到属性名
  const name = match[0]
  // 如果有重名属性, 报错
  if (nameSet.has(name)) {
    emitError(context, ErrorCodes.DUPLICATE_ATTRIBUTE)
  }
  // 放入属性数组
  nameSet.add(name) // 放入名称列表
  // 如果属性名字符串首位是=, 报错
  if (name[0] === '=') {
    emitError(context, ErrorCodes.UNEXPECTED_EQUALS_SIGN_BEFORE_ATTRIBUTE_NAME)
  }
  {
    // 校验非法属性名, 即属性名中包含`"`, `'`, `<`
    const pattern = /["'<]/g
    let m: RegExpExecArray | null
    while ((m = pattern.exec(name))) {
      emitError(
        context,
        ErrorCodes.UNEXPECTED_CHARACTER_IN_ATTRIBUTE_NAME,
        m.index
      )
    }
  }
  // 前进指针
  advanceBy(context, name.length)

  // Value
  let value: AttributeValue = undefined
  // 匹配属性值
  if (/^[\t\r\n\f ]*=/.test(context.source)) {
    // 去掉=前空格
    advanceSpaces(context)
    // 前进一位, 去掉=
    advanceBy(context, 1)
    // 去掉=后空格
    advanceSpaces(context)
    // 解析属性值
    value = parseAttributeValue(context)
    // 如果没有解析到属性值, 则报错
    if (!value) {
      emitError(context, ErrorCodes.MISSING_ATTRIBUTE_VALUE)
    }
  }
  const loc = getSelection(context, start) // 获取指针位置
  // Vue简写指令处理
  if (!context.inVPre && /^(v-[A-Za-z0-9-]|:|\.|@|#)/.test(name)) {
    const match =
      /(?:^v-([a-z0-9-]+))?(?:(?::|^\.|^@|^#)(\[[^\]]+\]|[^\.]+))?(.+)?$/i.exec(
        name
      )!

    let isPropShorthand = startsWith(name, '.')
    let dirName =
      match[1] ||
      (isPropShorthand || startsWith(name, ':')
        ? 'bind'
        : startsWith(name, '@')
        ? 'on'
        : 'slot')
    let arg: ExpressionNode | undefined

    if (match[2]) {
      const isSlot = dirName === 'slot'
      const startOffset = name.lastIndexOf(match[2])
      const loc = getSelection(
        context,
        getNewPosition(context, start, startOffset),
        getNewPosition(
          context,
          start,
          startOffset + match[2].length + ((isSlot && match[3]) || '').length
        )
      )
      let content = match[2]
      let isStatic = true

      if (content.startsWith('[')) {
        isStatic = false

        if (!content.endsWith(']')) {
          emitError(
            context,
            ErrorCodes.X_MISSING_DYNAMIC_DIRECTIVE_ARGUMENT_END
          )
          content = content.slice(1)
        } else {
          content = content.slice(1, content.length - 1)
        }
      } else if (isSlot) {
        // #1241 special case for v-slot: vuetify relies extensively on slot
        // names containing dots. v-slot doesn't have any modifiers and Vue 2.x
        // supports such usage so we are keeping it consistent with 2.x.
        content += match[3] || ''
      }

      arg = {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content,
        isStatic,
        constType: isStatic
          ? ConstantTypes.CAN_STRINGIFY
          : ConstantTypes.NOT_CONSTANT,
        loc
      }
    }

    if (value && value.isQuoted) {
      const valueLoc = value.loc
      valueLoc.start.offset++
      valueLoc.start.column++
      valueLoc.end = advancePositionWithClone(valueLoc.start, value.content)
      valueLoc.source = valueLoc.source.slice(1, -1)
    }

    const modifiers = match[3] ? match[3].slice(1).split('.') : []
    if (isPropShorthand) modifiers.push('prop')

    // 2.x compat v-bind:foo.sync -> v-model:foo
    if (__COMPAT__ && dirName === 'bind' && arg) {
      if (
        modifiers.includes('sync') &&
        checkCompatEnabled(
          CompilerDeprecationTypes.COMPILER_V_BIND_SYNC,
          context,
          loc,
          arg.loc.source
        )
      ) {
        dirName = 'model'
        modifiers.splice(modifiers.indexOf('sync'), 1)
      }

      if (__DEV__ && modifiers.includes('prop')) {
        checkCompatEnabled(
          CompilerDeprecationTypes.COMPILER_V_BIND_PROP,
          context,
          loc
        )
      }
    }

    return {
      type: NodeTypes.DIRECTIVE,
      name: dirName,
      exp: value && {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: value.content,
        isStatic: false,
        // Treat as non-constant by default. This can be potentially set to
        // other values by `transformExpression` to make it eligible for hoisting.
        constType: ConstantTypes.NOT_CONSTANT,
        loc: value.loc
      },
      arg,
      modifiers,
      loc
    }
  }

  // missing directive name or illegal directive name
  if (!context.inVPre && startsWith(name, 'v-')) {
    emitError(context, ErrorCodes.X_MISSING_DIRECTIVE_NAME)
  }

  return {
    type: NodeTypes.ATTRIBUTE,
    name,
    value: value && {
      type: NodeTypes.TEXT,
      content: value.content,
      loc: value.loc
    },
    loc
  }
}

/**
 * 解析标签属性值
 * @param context 解析上下文对象
 */
function parseAttributeValue(context: ParserContext): AttributeValue {
  const start = getCursor(context)
  let content: string
  // 获取引号
  const quote = context.source[0]
  // 属性值是否以(单|双)引号开头
  const isQuoted = quote === `"` || quote === `'`
  // 如果是以引号开头
  if (isQuoted) {
    // 如果是引号值, 先前进一位去除引号
    advanceBy(context, 1)
    // 找到回引号位置
    const endIndex = context.source.indexOf(quote)
    // 如果没有回引号, 解析文本
    if (endIndex === -1) {
      // 将待解析字符串作为属性进行解码
      content = parseTextData(
        context,
        context.source.length,
        TextModes.ATTRIBUTE_VALUE
      )
    } else {
      // 将回引号之前的文本作为属性进行解码
      content = parseTextData(context, endIndex, TextModes.ATTRIBUTE_VALUE) // 解析到回引号之前的文本内容作为属性值
      advanceBy(context, 1) // 前进去除回引号
    }
  } else {
    // Unquoted
    const match = /^[^\t\r\n\f >]+/.exec(context.source)
    if (!match) {
      return undefined
    }
    const unexpectedChars = /["'<=`]/g // 异常字符
    let m: RegExpExecArray | null
    while ((m = unexpectedChars.exec(match[0]))) {
      emitError(
        context,
        ErrorCodes.UNEXPECTED_CHARACTER_IN_UNQUOTED_ATTRIBUTE_VALUE,
        m.index
      )
    } // 如果包含异常字符, 则报错
    content = parseTextData(context, match[0].length, TextModes.ATTRIBUTE_VALUE) // 解析文本
  }

  return { content, isQuoted, loc: getSelection(context, start) }
}

/**
 * 解析插值
 * @param context
 * @param mode
 */
function parseInterpolation(
  context: ParserContext,
  mode: TextModes
): InterpolationNode | undefined {
  // 获取插值符号
  const [open, close] = context.options.delimiters
  __TEST__ && assert(startsWith(context.source, open))
  // 获取插值关闭符号位置
  const closeIndex = context.source.indexOf(close, open.length)
  // 没有关闭符号, 报错
  if (closeIndex === -1) {
    emitError(context, ErrorCodes.X_MISSING_INTERPOLATION_END)
    return undefined
  }
  // 获取当前指针位置
  const start = getCursor(context)
  // 前进
  advanceBy(context, open.length)
  const innerStart = getCursor(context)
  const innerEnd = getCursor(context)
  const rawContentLength = closeIndex - open.length
  // 获取插值文本
  const rawContent = context.source.slice(0, rawContentLength)
  // 预trim
  const preTrimContent = parseTextData(context, rawContentLength, mode)
  // trim
  const content = preTrimContent.trim()
  const startOffset = preTrimContent.indexOf(content)
  // 更新开始位置信息
  if (startOffset > 0) {
    advancePositionWithMutation(innerStart, rawContent, startOffset)
  }
  // 更新结束位置信息
  const endOffset =
    rawContentLength - (preTrimContent.length - content.length - startOffset)
  advancePositionWithMutation(innerEnd, rawContent, endOffset)
  advanceBy(context, close.length)

  return {
    type: NodeTypes.INTERPOLATION,
    content: {
      type: NodeTypes.SIMPLE_EXPRESSION,
      isStatic: false,
      // Set `isConstant` to false by default and will decide in transformExpression
      constType: ConstantTypes.NOT_CONSTANT,
      content,
      loc: getSelection(context, innerStart, innerEnd)
    },
    loc: getSelection(context, start)
  }
}

/**
 * 解析文本
 * @param context 待解析文本
 * @param mode 解析模式
 * @returns
 */
function parseText(context: ParserContext, mode: TextModes): TextNode {
  __TEST__ && assert(context.source.length > 0)
  // 获取结束标识, `<`, `{{`
  const endTokens =
    mode === TextModes.CDATA ? [']]>'] : ['<', context.options.delimiters[0]]
  // 字符串总长度
  let endIndex = context.source.length
  // 找到第一个结束分词(<,{{)的位置下标
  for (let i = 0; i < endTokens.length; i++) {
    const index = context.source.indexOf(endTokens[i], 1)
    if (index !== -1 && endIndex > index) {
      endIndex = index
    }
  }

  __TEST__ && assert(endIndex > 0)
  // 获取指针位置
  const start = getCursor(context)
  // 获取当前位置文本, 并更新行列信息
  const content = parseTextData(context, endIndex, mode)

  return {
    type: NodeTypes.TEXT,
    content,
    loc: getSelection(context, start)
  }
}

/**
 * 获取文本给定长度位置的文本数据并更新位置信息, 翻译文本中的HTML实体
 * Get text data with a given length from the current location.
 * This translates HTML entities in the text data.
 */
function parseTextData(
  context: ParserContext,
  length: number,
  mode: TextModes
): string {
  // 按给定长度截取字符串
  const rawText = context.source.slice(0, length)
  advanceBy(context, length)
  if (
    mode === TextModes.RAWTEXT ||
    mode === TextModes.CDATA ||
    rawText.indexOf('&') === -1
  ) {
    return rawText
  } else {
    // DATA or RCDATA containing "&"". Entity decoding required.
    return context.options.decodeEntities(
      rawText,
      mode === TextModes.ATTRIBUTE_VALUE
    )
  }
}
/**
 * 获取开始解析的锚点位置
 * @param context 待解析内容
 * @returns 列， 行， 位移
 */
function getCursor(context: ParserContext): Position {
  const { column, line, offset } = context
  return { column, line, offset }
}

/**
 * 获取给定区间的文本
 * @param context 待解析文本上下文
 * @param start 开始位置
 * @param end 结束位置
 * @returns
 */
function getSelection(
  context: ParserContext,
  start: Position,
  end?: Position
): SourceLocation {
  // 如果没有给定结束位置则获取当前文本环境中的位置信息
  end = end || getCursor(context)
  return {
    start,
    end,
    source: context.originalSource.slice(start.offset, end.offset)
  }
}

function last<T>(xs: T[]): T | undefined {
  return xs[xs.length - 1]
}

function startsWith(source: string, searchString: string): boolean {
  return source.startsWith(searchString)
}

function advanceBy(context: ParserContext, numberOfCharacters: number): void {
  const { source } = context
  __TEST__ && assert(numberOfCharacters <= source.length)
  advancePositionWithMutation(context, source, numberOfCharacters)
  // 更新待解析文本
  context.source = source.slice(numberOfCharacters)
}

function advanceSpaces(context: ParserContext): void {
  const match = /^[\t\r\n\f ]+/.exec(context.source)
  if (match) {
    advanceBy(context, match[0].length)
  }
}

function getNewPosition(
  context: ParserContext,
  start: Position,
  numberOfCharacters: number
): Position {
  return advancePositionWithClone(
    start,
    context.originalSource.slice(start.offset, numberOfCharacters),
    numberOfCharacters
  )
}

function emitError(
  context: ParserContext,
  code: ErrorCodes,
  offset?: number,
  loc: Position = getCursor(context)
): void {
  if (offset) {
    loc.offset += offset
    loc.column += offset
  }
  context.options.onError(
    createCompilerError(code, {
      start: loc,
      end: loc,
      source: ''
    })
  )
}

/**
 * 判断是否结束
 * @param context
 * @param mode
 * @param ancestors
 * @returns
 */
function isEnd(
  context: ParserContext,
  mode: TextModes,
  ancestors: ElementNode[]
): boolean {
  const s = context.source

  switch (mode) {
    case TextModes.DATA:
      if (startsWith(s, '</')) {
        // TODO: probably bad performance
        for (let i = ancestors.length - 1; i >= 0; --i) {
          if (startsWithEndTagOpen(s, ancestors[i].tag)) {
            return true
          }
        }
      }
      break

    case TextModes.RCDATA:
    case TextModes.RAWTEXT: {
      const parent = last(ancestors)
      if (parent && startsWithEndTagOpen(s, parent.tag)) {
        return true
      }
      break
    }

    case TextModes.CDATA:
      if (startsWith(s, ']]>')) {
        return true
      }
      break
  }

  return !s
}

function startsWithEndTagOpen(source: string, tag: string): boolean {
  return (
    startsWith(source, '</') &&
    source.slice(2, 2 + tag.length).toLowerCase() === tag.toLowerCase() &&
    /[\t\r\n\f />]/.test(source[2 + tag.length] || '>')
  )
}
