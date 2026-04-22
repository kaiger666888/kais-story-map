# kais-story-score 📖

小说五维特性可视化分析工具。从 `.txt` 小说原文生成交互式 HTML 报告。

## 五维分析

| 维度 | 说明 |
|------|------|
| 📈 叙事弧线 | 滑动窗口情感打分 + 六大弧线模板 DTW 匹配 |
| 🎭 情感深度 | NRC 8 维情绪分析（愤怒/期待/厌恶/恐惧/喜悦/悲伤/惊讶/信任） |
| 🕸️ 角色网络 | NER 角色提取 + 共现矩阵 + PageRank 中心度 → D3 力导向图 |
| ⚡ 节奏张力 | 句长/对话比/描写比/动作密度 → 张力曲线 |
| ✨ 文本质量 | TTR / 句法复杂度 / 词汇丰富度 / 可读性评分 |

## 安装

```bash
pip install -r requirements.txt

# 英文 NER 需要 spaCy 模型
python -m spacy download en_core_web_sm
```

## 使用

```bash
# 基本用法
python src/cli.py -i novel.txt -o ./output

# 指定语言
python src/cli.py -i novel.txt -o ./output -l zh

# 指定角色（中文用逗号分隔）
python src/cli.py -i novel.txt -o ./output -c "Harry,Ron,Hermione"

# 导出所有格式
python src/cli.py -i novel.txt -o ./output -f all
```

### 参数

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `-i, --input` | 输入文件 (.txt) | 必填 |
| `-o, --output-dir` | 输出目录 | `./output` |
| `-l, --language` | `zh` 或 `en` | 自动检测 |
| `-c, --characters` | 角色名（逗号分隔） | 自动提取 |
| `-f, --format` | `html` / `json` / `csv` / `all` | `html` |

## 输出

- **report.html** — 交互式单文件报告（Plotly + D3.js）
- **report.json** — 结构化分析数据
- **csv/** — 分维度 CSV 文件

## 六大叙事弧线

| 弧线 | 描述 |
|------|------|
| Rags to Riches | 从低谷到巅峰 |
| Riches to Rags | 从巅峰到低谷 |
| Man in a Hole | 跌入困境后奋起 |
| Icarus | 飞得太高后坠落 |
| Oedipus | 风光后跌落且无法恢复 |
| Cinderella | 低谷→高峰→低谷→最高峰 |

## 示例

```bash
# 分析英文小说
python src/cli.py -i examples/prince.txt -o ./output -c "Prince,Happy,Bird"

# 分析中文小说
python src/cli.py -i examples/three_body.txt -o ./output -l zh -c "叶文洁,罗辑,程心"
```

## 技术栈

- **Python 3.10+** — 分析引擎
- **NLTK / jieba** — 分词
- **spaCy** — 英文 NER
- **networkx** — 图分析
- **Jinja2** — HTML 模板
- **Plotly.js** — 交互式图表
- **D3.js** — 力导向网络图
