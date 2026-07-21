/**
 * 情绪曲线页 — 共享常量与推导助手
 * 所有数值均由 src/data/nightferry.ts 的演示数据推导,保证跨页自洽。
 */
import type { Beat } from '@/data/nightferry'
import { BEATS, getCharacter } from '@/data/nightferry'

/** 主图关键事件(green 菱形标记)— 与 emotion.md S2 一致 */
export const EVENT_MARKERS: { beat: number; label: string }[] = [
  { beat: 9, label: '发现舱单' },
  { beat: 30, label: '老鬼之死' },
  { beat: 34, label: '风暴对峙' },
  { beat: 41, label: '真相' },
]

/** 场号格式化:1 → 'S01' */
export const beatCode = (n: number): string => `S${String(n).padStart(2, '0')}`

/** 情绪值格式化:-3 → '-3',+4.5 → '+4.5' */
export function fmtVal(v: number): string {
  const r = Math.round(v * 10) / 10
  const s = Number.isInteger(r) ? String(r) : r.toFixed(1)
  return r > 0 ? `+${s}` : s
}

/** 读数着色(与首页 EmotionBand 一致):正 green / 负 rose / 零 paper-dim */
export function valueColor(v: number): string {
  if (v > 0) return '#7BE0A3'
  if (v < 0) return '#FF4D6D'
  return '#9A937F'
}

/* ── 热力色阶:-5(cyan)→ 0(ink-800)→ +5(rose) ── */

type RGB = [number, number, number]
const hx = (h: string): RGB => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
]
const HEAT_LO = hx('#4DD8FF')
const HEAT_MID = hx('#16161F')
const HEAT_HI = hx('#FF4D6D')

export function heatColor(v: number): string {
  const t = Math.max(-5, Math.min(5, v))
  const to = t < 0 ? HEAT_LO : HEAT_HI
  const k = Math.abs(t) / 5
  const c = HEAT_MID.map((a, i) => Math.round(a + (to[i] - a) * k)) as RGB
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`
}

/* ── 数据推导 ── */

/** 人物弧均值(忽略 null 缺场) */
export function charMean(charId: string): number {
  const c = getCharacter(charId)
  if (!c) return 0
  const vals = c.arc.filter((v): v is number => v != null)
  if (!vals.length) return 0
  return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10
}

/** 场景 × 人物平均情绪(该人物在该场景所有出场场的 arc 均值);无出场 → null */
export function sceneCharAvg(sceneId: string, charId: string): number | null {
  const c = getCharacter(charId)
  if (!c) return null
  const vals = BEATS.filter((b) => b.sceneId === sceneId && b.characters.includes(charId))
    .map((b) => c.arc[b.index - 1])
    .filter((v): v is number => v != null)
  if (!vals.length) return null
  return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10
}

/**
 * 唤醒度(0–10)推导:情绪强度 × 在场人数 × 关键节拍加权。
 * 仅用于 S5 象限 y 轴,确定性映射,不产生随机数。
 */
export function beatArousal(b: Beat): number {
  const base = Math.abs(b.emotion) * 1.55
  const crowd = (b.characters.length - 1) * 0.5
  const key = b.key ? 0.9 : 0
  return Math.min(10, Math.round((base + crowd + key) * 10) / 10)
}

/** 某场景覆盖的场号区间(用于主图联动高亮) */
export function sceneBeatRange(sceneId: string): [number, number] {
  const idx = BEATS.filter((b) => b.sceneId === sceneId).map((b) => b.index)
  return [Math.min(...idx), Math.max(...idx)]
}
