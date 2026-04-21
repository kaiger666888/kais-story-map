---
name: kais-story-map
description: 小说五维特性可视化分析（叙事弧线/情感深度/角色网络/节奏张力/文本质量）。从 .txt 小说原文生成交互式 HTML 报告，包含 Plotly 图表、D3 角色网络力导向图和编剧建议卡片。
---

# kais-story-map — 小说五维可视化分析

## 触发词
小说分析、故事分析、story map、文本分析、叙事弧线、角色网络、情感分析、节奏分析、文本质量、小说可视化、story visualization

## 使用方法

```bash
# 基本用法
python skills/kais-story-map/src/cli.py --input novel.txt --output-dir ./output

# 指定语言
python skills/kais-story-map/src/cli.py --input novel.txt --output-dir ./output --language zh

# 指定角色列表（逗号分隔）
python skills/kais-story-map/src/cli.py --input novel.txt --output-dir ./output --characters "Harry,Ron,Hermione"

# 仅导出 JSON
python skills/kais-story-map/src/cli.py --input novel.txt --output-dir ./output --format json
```

## 参数说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--input` | 输入文本文件路径 (.txt) | 必填 |
| `--output-dir` | 输出目录 | `./output` |
| `--language` | 语言代码 `zh` 或 `en`，不指定则自动检测 | 自动检测 |
| `--characters` | 手动指定角色名列表（逗号分隔） | 自动提取 |
| `--format` | 输出格式：`html`(默认)、`json`、`csv`、`all` | `html` |

## 输出格式

- **report.html** — 交互式单文件 HTML 报告（Plotly + D3.js）
- **report.json** — 结构化分析数据
- **arc.csv / emotions.csv / characters.csv / pacing.csv / quality.csv / advice.csv** — 分维度 CSV

## 五维分析维度

1. **叙事弧线** — 滑动窗口情感打分 + 六大弧线模板 DTW 匹配（Rags to Riches / Man in Hole / Icarus 等）
2. **情感深度** — NRC 8 维情绪分析（愤怒/期待/厌恶/恐惧/喜悦/悲伤/惊讶/信任）
3. **角色网络** — NER 角色提取 + 共现矩阵 + PageRank 中心度 → D3 力导向图
4. **节奏张力** — 句长/对话比/描写比/动作密度 → 张力曲线
5. **文本质量** — TTR / 句法复杂度 / 词汇丰富度 / 可读性评分

## 依赖

```
pip install -r skills/kais-story-map/requirements.txt
```
