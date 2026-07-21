#!/usr/bin/env tsx
/**
 * 剧核 parser CLI
 *
 * 用法:
 *   tsx parser/cli.ts parse    --input <剧本.md>  --output <out.json>
 *       解析剧本文本为 ScriptData JSON(需接入 LLM,框架阶段会提示未接入)
 *   tsx parser/cli.ts validate --input <data.json>
 *       校验一份 ScriptData JSON 的结构与引用一致性
 *   tsx parser/cli.ts export   --output <out.json>
 *       导出内置《夜航》样本数据为 JSON(用于生成校验样本 / 前端默认数据)
 *
 * 注:export 需解析 @/* 路径别名,请用:
 *   tsx --tsconfig parser/tsconfig.json parser/cli.ts export --output src/data/nightferry.json
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { parseScript } from './parser'
import { validateScriptFile } from './validate'

function usage(): never {
  console.log(`剧核 parser CLI

用法:
  tsx parser/cli.ts parse    --input <剧本.md> --output <out.json>
  tsx parser/cli.ts validate --input <data.json>
  tsx parser/cli.ts export   --output <out.json>
`)
  process.exit(1)
}

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(name)
  return i >= 0 && i + 1 < args.length ? args[i + 1] : undefined
}

function printResult(result: ReturnType<typeof validateScriptFile>) {
  const s = result.stats
  console.log(
    `统计:${s.beats} 场 / ${s.characters} 人物 / ${s.props} 道具 / ${s.scenes} 场景 / ${s.acts} 幕 / ${s.relationships} 关系`,
  )
  if (result.ok) {
    console.log('✓ 校验通过')
  } else {
    console.log(`✗ 校验失败(${result.errors.length} 处错误)`)
    for (const e of result.errors) console.log(`  ✗ ${e.path}: ${e.message}`)
  }
  if (result.warnings.length) {
    console.log(`警告(${result.warnings.length}):`)
    for (const w of result.warnings) console.log(`  ⚠ ${w}`)
  }
}

async function main() {
  const [, , cmd, ...rest] = process.argv
  if (!cmd) usage()

  if (cmd === 'validate') {
    const input = flag(rest, '--input')
    if (!input) {
      console.error('validate 需要 --input <file>')
      process.exit(1)
    }
    const result = validateScriptFile(input)
    printResult(result)
    process.exit(result.ok ? 0 : 1)
  }

  if (cmd === 'parse') {
    const input = flag(rest, '--input')
    const output = flag(rest, '--output')
    if (!input || !output) {
      console.error('parse 需要 --input <剧本> 与 --output <out.json>')
      process.exit(1)
    }
    const text = readFileSync(input, 'utf8')
    try {
      const data = await parseScript(text, {
        onProgress: (p) => console.error(`[${p.index}/${p.total}] ${p.round} ...`),
      })
      writeFileSync(output, JSON.stringify(data, null, 2))
      console.log(`✓ 已解析并校验 → ${output}`)
    } catch (e) {
      console.error('解析失败:', e instanceof Error ? e.message : e)
      process.exit(1)
    }
    return
  }

  if (cmd === 'export') {
    const output = flag(rest, '--output')
    if (!output) {
      console.error('export 需要 --output <out.json>')
      process.exit(1)
    }
    // 动态 import,使 validate / parse 命令不依赖 @/* 路径别名
    const { DEFAULT_DATA } = await import('../src/data/nightferry')
    writeFileSync(output, JSON.stringify(DEFAULT_DATA, null, 2))
    console.log(`✓ 已导出《夜航》默认数据 → ${output}`)
    return
  }

  usage()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
