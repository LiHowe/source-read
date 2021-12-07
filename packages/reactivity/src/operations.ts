// using literal strings instead of numbers so that it's easier to inspect
// debugger events

/**
 * 追踪对象的方式
 */
export const enum TrackOpTypes {
  /**
   * get方法
   */
  GET = 'get',
  /**
   * has方法
   */
  HAS = 'has',
  /**
   * 迭代方法
   */
  ITERATE = 'iterate'
}

/**
 * 触发操作类型
 */
export const enum TriggerOpTypes {
  /**
   * 赋值
   */
  SET = 'set',
  /**
   * 新增
   */
  ADD = 'add',
  /**
   * 删除
   */
  DELETE = 'delete',
  /**
   * 清空
   */
  CLEAR = 'clear'
}
