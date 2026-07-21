/**
 * LLM Prompt 模板 —— 剧本结构化提取的 6 轮提示。
 *
 * 设计原则:
 *   - 每轮只提取一类实体,降低单次输出复杂度、提高 JSON 合法率;
 *   - 每轮明确给出目标 JSON Schema(字段 + 枚举 + 取值区间),要求「只输出 JSON、无解释」;
 *   - 后续轮次把前轮结果作为上下文注入,保证 id 引用一致(人物 id / 场景 id / 道具 id)。
 *
 * 这些模板在 parser.ts 的多轮流程中被 LLMClient 逐个调用。
 * 当前为框架阶段:模板已就绪,LLMClient 实际请求逻辑待接入(见 parser.ts)。
 */
import type { Character, SceneLocation, ScriptProp } from './schema'

const STRICT_JSON_PREFIX = `你是一个剧本结构化分析引擎。请严格按给定 JSON Schema 输出,且「只输出一个 JSON 对象,不要任何解释、Markdown 代码围栏或前后缀文字」。字段缺失时用空字符串 / 空数组 / null。`

/** Round 1 · 人物列表 */
export function promptCharacters(script: string): string {
  return `${STRICT_JSON_PREFIX}

【任务】从下面这部剧本中,提取全部有名字或台词的人物。

【输出 JSON Schema】
{
  "characters": [
    {
      "id": "string  // 短小英文 id,如 linwan",
      "name": "string  // 中文姓名",
      "nameEn": "string  // 拼音 / 英文大写,如 LIN WAN",
      "role": "string  // 角色定位,如 主角·调查记者",
      "age": number,
      "gender": "女" | "男",
      "color": "string  // hex 代表色",
      "avatar": "string  // 头像路径占位,如 /avatar-id.png",
      "bio": "string  // 一两句人物小传",
      "desire": "string  // 核心动机",
      "tags": ["string"],
      "arc": [number|null]  // 留空数组 [],后续轮次填充
    }
  ]
}

【剧本】
${script}`
}

/** Round 2 · 道具列表 + 流转链 */
export function promptProps(script: string, characters: Character[]): string {
  return `${STRICT_JSON_PREFIX}

【任务】提取剧本中起关键作用的道具(证据 / 工具 / 信物),及其在场次间的流转链。

【已知人物 id】(holderId 必须从此列表选取)
${characters.map((c) => c.id).join(', ')}

【输出 JSON Schema】
{
  "props": [
    {
      "id": "string  // 如 recorder",
      "name": "string",
      "nameEn": "string",
      "kind": "证据" | "工具" | "信物",
      "color": "#A78BFA",
      "description": "string",
      "significance": number,  // 1-5
      "timeline": [
        { "beat": number, "sceneId": "string", "note": "string", "holderId": "string  // 可选,已知人物 id" }
      ]
    }
  ]
}

【剧本】
${script}`
}

/** Round 3 · 场景列表 */
export function promptScenes(script: string): string {
  return `${STRICT_JSON_PREFIX}

【任务】提取剧本中出现的所有地点 / 场景,编号为 S01、S02……

【输出 JSON Schema】
{
  "scenes": [
    {
      "id": "S01",
      "code": "S01",
      "name": "string  // 中文场景名",
      "nameEn": "string  // 英文大写",
      "color": "#4DD8FF",
      "description": "string  // 场景氛围一两句",
      "mood": ["string"]  // 氛围关键词 2-3 个
    }
  ]
}

【剧本】
${script}`
}

/** Round 4 · 逐场节拍 */
export function promptBeats(
  script: string,
  characters: Character[],
  scenes: SceneLocation[],
  props: ScriptProp[],
): string {
  return `${STRICT_JSON_PREFIX}

【任务】把剧本拆解为有序的「场」(beat),逐场给出情绪、出场人物、涉及道具与节拍类型。

【已知人物 id】${characters.map((c) => c.id).join(', ')}
【已知场景 id】${scenes.map((s) => s.id).join(', ')}
【已知道具 id】${props.map((p) => p.id).join(', ')}

【输出 JSON Schema】
{
  "beats": [
    {
      "index": number,  // 从 1 递增
      "act": 1 | 2 | 3,
      "sceneId": "string  // 已知场景 id",
      "title": "string  // 场标题",
      "summary": "string  // 一两句梗概",
      "emotion": number,  // -5..+5
      "characters": ["string  // 已知人物 id"],
      "props": ["string  // 已知道具 id,可选"],
      "key": boolean,  // 是否关键节拍,可选
      "type": "setup" | "inciting" | "rising" | "turning" | "crisis" | "climax" | "resolution"
    }
  ]
}

【剧本】
${script}`
}

/** Round 5 · 人物关系 */
export function promptRelationships(script: string, characters: Character[]): string {
  return `${STRICT_JSON_PREFIX}

【任务】提取人物之间(以及人物与道具 / 场景之间)的关系边。

【已知人物 id】${characters.map((c) => c.id).join(', ')}

【输出 JSON Schema】
{
  "relationships": [
    {
      "id": "r01",
      "source": "string  // 人物 id",
      "target": "string  // 人物 / 道具 / 场景 id",
      "kind": "character-character" | "character-prop" | "character-scene" | "prop-scene",
      "label": "string  // 关系短语,如 猎手与猎物",
      "sentiment": number,  // -5..+5
      "strength": number,  // 1-5
      "sinceBeat": number  // 关系建立的场号
    }
  ]
}

【剧本】
${script}`
}

/** Round 6 · 每人物逐场情绪弧 */
export function promptEmotionArcs(script: string, characters: Character[], beatCount: number): string {
  return `${STRICT_JSON_PREFIX}

【任务】为每个已知人物,沿 ${beatCount} 个场给出逐场情绪值(-5 绝望 .. +5 狂喜)。该人物不在场 / 失联 / 死亡的场次用 null。

【已知人物 id】${characters.map((c) => c.id).join(', ')}

【输出 JSON Schema】
{
  "arcs": {
    "<人物 id>": [number|null, ...]  // 长度必须 == ${beatCount}
  }
}

【剧本】
${script}`
}

/** 三幕切分(可选,辅助) */
export function promptActs(script: string, beatCount: number): string {
  return `${STRICT_JSON_PREFIX}

【任务】把全剧 ${beatCount} 场切分为三幕,给出每幕的场号区间(闭区间)。

【输出 JSON Schema】
{
  "acts": [
    { "id": 1, "name": "第一幕 · 建置", "nameEn": "ACT I", "range": [1, number], "color": "#F2EAD8", "summary": "string" },
    { "id": 2, "name": "第二幕 · 对抗", "nameEn": "ACT II", "range": [number, number], "color": "#FFB347", "summary": "string" },
    { "id": 3, "name": "第三幕 · 解决", "nameEn": "ACT III", "range": [number, ${beatCount}], "color": "#FF4D6D", "summary": "string" }
  ]
}

【剧本】
${script}`
}
