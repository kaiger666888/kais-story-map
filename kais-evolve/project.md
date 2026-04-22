# Autoresearch Project: kais-story-score

## Goal
迭代修复 bug 并提升 kais-story-score 小说分析质量。三个待修复 bug + 分析质量优化。

## Metric
- Primary: 综合质量评分（0-100，越高越好），由测试脚本自动计算
- Command: python3 ~/.openclaw/workspace/skills/kais-story-score/kais-evolve/eval.py
- Parse: 最后一行输出 "SCORE: XX.XX"

### 评分维度（每项 0-20 分，总分 100）
1. **角色网络质量** (20分): degree > 0 的节点占比 × 20
2. **编剧建议质量** (20分): 不含 "?" 的建议占比 × 20
3. **中文角色匹配** (15分): 中文测试中卢克·天行者 degree > 0 → 15分
4. **情感弧线精度** (15分): 采样点数 > 10 → 10分, 置信度 > 0.6 → 5分
5. **中文对话检测** (15分): 中文测试对话比例 > 5% → 15分
6. **报告完整性** (15分): HTML > 20KB, JSON 包含全部6个顶级 key → 15分

## Scope
- Editable: src/**/*.py, data/*.json, templates/*.j2
- Read-only: SKILL.md, README.md, requirements.txt
- No new dependencies: true（仅用已安装的 nltk/spacy/jieba/networkx/jinja2/matplotlib）

## Constraints
- Time budget: 180s per experiment
- Memory: 1GB
- Simplicity: 优先修复 bug，不要过度重构

## Baseline
- Command: python3 ~/.openclaw/workspace/skills/kais-story-score/kais-evolve/eval.py
- Expected metric: ~40 (当前 bug 导致多个维度 0 分)

## Test Data
- 英文测试: /tmp/starwars_clean.txt（with --characters）
- 中文测试: /tmp/starwars_zh.txt（with --characters）

## Ideas
1. 修复中文角色名变体映射（"卢克"→"卢克·天行者"，"莱娅"→"莱娅公主"）
2. 修复编剧建议 message 字段为 "?" 的问题（screenwriter_advice.py）
3. 修复中文对话检测（识别「」""引号）
4. 优化中文情感词典覆盖率（当前可能不足）
5. 增强角色网络 edge weight 计算准确性

## Experiment Loop

LOOP FOREVER (until human stops you):

1. Read the current git state (branch, commit)
2. Look at results.tsv for what's been tried and what worked
3. Form a hypothesis based on:
   - Previous successful experiments (keep patterns)
   - Previous near-misses (combining partial wins)
   - Code understanding (reading the editable files)
   - Domain knowledge (common optimization techniques)
4. Implement the change by editing files in the Editable scope
5. git commit with a descriptive message
6. Run the experiment command: python3 kais-evolve/eval.py
7. Parse the metric from output (SCORE: XX.XX)
8. Record in results.tsv:
   - If improved: status=keep, advance the branch
   - If worse or equal: status=discard, git reset
   - If crash: status=crash, log error, try to fix or skip
9. Go to step 1

## Rules
- NEVER STOP. Keep going until human interrupts.
- NEVER ask "should I continue?" — the answer is always yes.
- NEVER modify files outside the Editable scope.
- NEVER install new dependencies.
- If crash: read the error, fix if trivial, skip if fundamental.
- Simplicity wins: removing code for equal performance > adding code for tiny gains.
- Time budget: kill experiments that exceed 180s, treat as crash.
