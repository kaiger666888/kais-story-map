# Autoresearch Project: kais-story-map type scorer

## Goal
优化故事类型检测准确率到 5/5，同时保持各类型内评分区分度。

## Metric
- Primary: eval_type.py 总分（越高越好，满分100）
- Command: python3 kais-evolve/eval_type.py
- Parse: SCORE: XX.XX

## Scope
- Editable: src/story_scorer.py
- Read-only: 其他所有文件

## Constraints
- Time budget: 180s per experiment
- Simplicity: 只调 detect_story_type() 和 score_story() 中的参数，不要改结构

## Baseline
- SCORE: 14.20 (1/5类型正确)

## Ideas
1. 调整 detect_story_type 中各类型的特征权重
2. 核心问题：classic_narrative 的 secondary_hubs>=2 给了太多分（30分），导致大多数文本都被判为经典
3. 需要加强爽文的信号：短句+星形网络+情绪集中应该是更强的爽文指标
4. 悬疑需要更强的信号：fear ratio > trust ratio
5. 言情需要更强的信号：joy + sadness 同时高 + dialogue高
6. 史诗需要更强的信号：角色数>=6 + 句法复杂度

## Experiment Loop

1. Read results.tsv
2. Read src/story_scorer.py
3. Analyze which types are being misclassified and why
4. Adjust feature weights in detect_story_type()
5. git commit
6. Run eval: python3 kais-evolve/eval_type.py
7. Parse SCORE
8. keep/discard/reset
9. Loop until SCORE >= 80 or 8 rounds

## Rules
- NEVER STOP until SCORE >= 80 or 8 rounds completed.
- Focus on detect_story_type() function first.
- Print the 5 detection results after each eval so we can track which types are fixed.
- After each experiment, briefly note what changed and the new score.
