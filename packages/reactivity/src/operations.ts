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

export const enum TriggerOpTypes {
  SET = 'set',
  ADD = 'add',
  DELETE = 'delete',
  CLEAR = 'clear'
}
