# 剧核 Parser —— 剧本结构化提取引擎

把一份剧本文本(Markdown / 纯文本)转换为与 `src/data/nightferry.ts` 同构的 **ScriptData JSON**,
供前端(kais-story-map)通过 `?data=` 动态加载、可视化。

> **当前状态:框架已就绪,LLM 调用为 Stub(不发起网络请求)。**
> 多轮提取流程、prompt 模板、合并、zod 校验、CLI 全部可用;接入真实 LLM 客户端即可端到端跑通。
> 见下文「接入 LLM」。

## 目录结构

```
parser/
├── schema.ts            # zod 运行时 Schema(与 src/types/script-schema.ts 对齐)
├── prompt-templates.ts  # 6+1 轮 LLM prompt 模板(strict JSON)
├── parser.ts            # 主流程:预处理 → 多轮提取 → 合并 → 校验;含 LLMClient 抽象
├── validate.ts          # 结构 + 引用一致性校验
├── cli.ts               # CLI 入口(parse / validate / export)
├── tsconfig.json        # 供 tsx 解析 @/* 路径别名(export 命令用)
└── README.md
```

## 工作流程

```
剧本文本 → [预处理] → [R1 人物] → [R2 道具+流转] → [R3 场景]
        → [R4 逐场节拍] → [R5 关系] → [R6 情绪弧] → [R7 三幕]
        → [合并] → [zod + 引用校验] → ScriptData JSON
```

- 每轮只提取一类实体,降低单次输出复杂度、提高 JSON 合法率;
- 后续轮次把前轮结果作为上下文注入,保证 `id` 引用一致(人物 / 场景 / 道具 id);
- R6 的逐场情绪弧会回填到各 `character.arc`;
- 最终通过 `validate.ts` 的 zod 结构校验 + 引用一致性检查,不过则抛错。

## CLI 用法

```bash
# 1) 校验一份 ScriptData JSON(无需 LLM,立即可用)
npx tsx parser/cli.ts validate --input src/data/nightferry.json

# 2) 解析剧本文本为 JSON(需接入 LLM;框架阶段会提示「LLM 未接入」)
npx tsx parser/cli.ts parse --input ./scripts/sample.md --output ./src/data/parsed.json

# 3) 导出内置《夜航》样本为 JSON(用于生成校验样本 / 默认数据)
#    export 需解析 @/* 别名,须带 --tsconfig
npx tsx --tsconfig parser/tsconfig.json parser/cli.ts export --output src/data/nightferry.json
```

package.json 也提供了快捷脚本:`npm run parse:validate`、`npm run parse:export`。

## 输出 JSON 结构

详见 `schema.ts` / `src/types/script-schema.ts`。顶层:

```jsonc
{
  "meta": { "title": "...", "titleEn": "...", "genre": "...", "synopsis": "..." },
  "characters": [{ "id": "linwan", "name": "林晚", "arc": [0.5, -0.5, ...], ... }],
  "props":     [{ "id": "recorder", "timeline": [{ "beat": 1, ... }], ... }],
  "scenes":    [{ "id": "S01", ... }],
  "beats":     [{ "index": 1, "act": 1, "sceneId": "S01", "emotion": 0.5, ... }],
  "acts":      [{ "id": 1, "range": [1, 12], ... }],
  "relationships": [{ "source": "linwan", "target": "jiangli", "kind": "character-character", ... }]
}
```

将此 JSON 放到前端可访问处(如 `data/web/story-map/parsed.json`),访问
`http://localhost:10588/story-map/#/graph?data=parsed.json` 即可加载该剧本。

## 接入 LLM(待实现)

`parser.ts` 通过 `LLMClient` 接口隔离 LLM 调用,默认 `StubLLMClient` 不发请求。
接入步骤:

1. 在 `parser.ts` 实现真实客户端,例如:

   ```ts
   class KimiClient implements LLMClient {
     async extract(prompt: string, opts?: LLMExtractOptions): Promise<unknown> {
       // 1. 调用 https://api.moonshot.cn/v1/chat/completions(或 OpenAI 兼容端点)
       //    建议 response_format=json_object / 结构化输出
       // 2. 重试:opts.maxRetries(默认 2),捕获超时 / 非 200 / JSON 解析失败
       // 3. 返回 JSON.parse(text)
     }
   }
   ```

2. 在 `createLLMClient()` 里按环境变量实例化:

   ```ts
   if (provider === 'kimi')   return new KimiClient({ apiKey: process.env.KIMI_API_KEY!, ... })
   if (provider === 'openai') return new OpenAICompatibleClient({ ... })
   ```

3. 配置环境变量后即可端到端:

   ```bash
   STORY_MAP_LLM_PROVIDER=kimi \
   KIMI_API_KEY=xxx \
   KIMI_BASE_URL=https://api.moonshot.cn/v1 \
   KIMI_MODEL=moonshot-chat-model \
   npx tsx parser/cli.ts parse --input scripts/sample.md --output src/data/parsed.json
   ```

容错要求(已在接口注释中约定):API 超时 / 错误需重试;最终输出必须通过 `validate.ts` 校验。
