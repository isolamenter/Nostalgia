/** 引擎共享常量 */

/** 对话结束哨兵（节点 next/choice.next 指向它即结束对话） */
export const END = '$END'

/** 档案状态回写 flag 前缀约定：`archive.<id>.status` */
export const ARCHIVE_FLAG_PREFIX = 'archive.'
export const ARCHIVE_STATUS_SUFFIX = '.status'

/** 由档案 id 推导的状态 flag 名 */
export function archiveStatusFlag(archiveId: string): string {
  return `${ARCHIVE_FLAG_PREFIX}${archiveId}${ARCHIVE_STATUS_SUFFIX}`
}

/** 判断 flag 是否为档案状态回写（形如 archive.<id>.status），是则返回档案 id */
export function parseArchiveStatusFlag(flag: string): string | null {
  if (!flag.startsWith(ARCHIVE_FLAG_PREFIX) || !flag.endsWith(ARCHIVE_STATUS_SUFFIX)) return null
  return flag.slice(ARCHIVE_FLAG_PREFIX.length, -ARCHIVE_STATUS_SUFFIX.length)
}