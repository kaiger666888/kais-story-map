/**
 * Parser Schema —— 剧本数据的运行时校验定义(zod)
 *
 * 与 src/types/script-schema.ts 的 TypeScript 类型严格对齐,
 * 供 parser/validate.ts 对 LLM 输出 / 外部 JSON 做结构校验。
 * 这是「剧本 → JSON」管线的契约:任何 ScriptData JSON 必须通过此 schema。
 */
import { z } from 'zod'

/* ──────────────────────────── 枚举 ──────────────────────────── */

export const actIdSchema = z.union([z.literal(1), z.literal(2), z.literal(3)])
export const genderSchema = z.enum(['女', '男'])
export const propKindSchema = z.enum(['证据', '工具', '信物'])
export const beatTypeSchema = z.enum([
  'setup',
  'inciting',
  'rising',
  'turning',
  'crisis',
  'climax',
  'resolution',
])
export const edgeKindSchema = z.enum([
  'character-character',
  'character-prop',
  'character-scene',
  'prop-scene',
])

/* ──────────────────────────── 实体 ──────────────────────────── */

export const characterSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  nameEn: z.string(),
  role: z.string(),
  age: z.number().int().nonnegative(),
  gender: genderSchema,
  color: z.string(),
  avatar: z.string(),
  bio: z.string(),
  desire: z.string(),
  tags: z.array(z.string()),
  /** 逐场情绪值,-5..+5;null = 不在场 */
  arc: z.array(z.number().nullable()),
})

export const propAppearanceSchema = z.object({
  beat: z.number().int().positive(),
  sceneId: z.string(),
  note: z.string(),
  holderId: z.string().optional(),
})

export const scriptPropSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  nameEn: z.string(),
  kind: propKindSchema,
  color: z.string(),
  description: z.string(),
  significance: z.number().int().min(1).max(5),
  timeline: z.array(propAppearanceSchema),
})

export const sceneSchema = z.object({
  id: z.string().min(1),
  code: z.string(),
  name: z.string(),
  nameEn: z.string(),
  color: z.string(),
  description: z.string(),
  mood: z.array(z.string()),
})

export const beatSchema = z.object({
  index: z.number().int().positive(),
  act: actIdSchema,
  sceneId: z.string(),
  title: z.string(),
  summary: z.string(),
  emotion: z.number().min(-5).max(5),
  characters: z.array(z.string()),
  props: z.array(z.string()).optional(),
  key: z.boolean().optional(),
  type: beatTypeSchema,
})

export const actSchema = z.object({
  id: actIdSchema,
  name: z.string(),
  nameEn: z.string(),
  range: z.tuple([z.number().int(), z.number().int()]),
  color: z.string(),
  summary: z.string(),
})

export const relationshipSchema = z.object({
  id: z.string().min(1),
  source: z.string(),
  target: z.string(),
  kind: edgeKindSchema,
  label: z.string(),
  sentiment: z.number().min(-5).max(5),
  strength: z.number().int().min(1).max(5),
  sinceBeat: z.number().int().positive(),
})

export const scriptMetaSchema = z.object({
  title: z.string(),
  titleEn: z.string(),
  genre: z.string(),
  synopsis: z.string(),
  dialogueLines: z.number().int().positive().optional(),
  paceEntropy: z.number().min(0).max(1).optional(),
})

/* ──────────────────────────── 聚合 ──────────────────────────── */

export const scriptDataSchema = z.object({
  meta: scriptMetaSchema,
  characters: z.array(characterSchema),
  props: z.array(scriptPropSchema),
  scenes: z.array(sceneSchema),
  beats: z.array(beatSchema),
  acts: z.array(actSchema),
  relationships: z.array(relationshipSchema),
})

export type ScriptData = z.infer<typeof scriptDataSchema>
