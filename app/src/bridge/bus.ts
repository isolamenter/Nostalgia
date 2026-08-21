/**
 * 类型化领域事件总线（mitt 单例）。
 * 变异一律走 store action；bus 只广播已发生的事实，供 React/Phaser 观察。
 */
import mitt from 'mitt'
import type { DomainEventMap } from '../engine/events'

export const bus = mitt<DomainEventMap>()
export type Bus = typeof bus