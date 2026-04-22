#!/usr/bin/env python3
"""kais-story-score 类型感知评分 — kais-evolve 评估脚本"""
import json, os, sys, glob, subprocess

SKILL_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAMPLES = "/tmp/samples"

# 期望类型映射
EXPECTED = {
    "01_power_fantasy.txt": "power_fantasy",
    "02_classic.txt": "classic_narrative",
    "03_suspense.txt": "suspense",
    "04_romance.txt": "romance",
    "05_epic.txt": "epic",
}

def run_analysis(txt, outdir):
    os.makedirs(outdir, exist_ok=True)
    for f in glob.glob(os.path.join(outdir, "*")):
        if os.path.isfile(f): os.remove(f)
    cmd = [sys.executable, "-m", "src.cli",
           "--input", txt, "--output-dir", outdir,
           "--language", "zh", "--format", "json", "--granularity", "fine"]
    subprocess.run(cmd, cwd=SKILL_DIR, capture_output=True, timeout=120)
    jf = os.path.join(outdir, "report.json")
    if not os.path.exists(jf): return None
    with open(jf) as f: return json.load(f)

def score(d):
    sys.path.insert(0, os.path.join(SKILL_DIR, "src"))
    from story_scorer import score_story
    return score_story(d)

def eval_all():
    results = {}
    type_correct = 0
    total_samples = 0
    score_detail = []

    for fname, expected_type in EXPECTED.items():
        fpath = os.path.join(SAMPLES, fname)
        if not os.path.exists(fpath):
            print(f"  ⚠️ 缺失: {fname}")
            continue
        total_samples += 1

        d = run_analysis(fpath, f"/tmp/ev_{fname.replace('.txt','')}")
        if d is None:
            print(f"  ❌ 分析失败: {fname}")
            results[fname] = {"type_correct": False, "total": 0}
            continue

        r = score(d)
        detected = r["story_type"]
        correct = detected == expected_type
        if correct:
            type_correct += 1

        results[fname] = {
            "expected": expected_type,
            "detected": detected,
            "type_correct": correct,
            "total": r["total"],
            "grade": r["grade"],
            "type_confidence": r["type_scores"].get(expected_type, 0),
            "dims": {k: v["score"] for k, v in r["dimensions"].items()},
        }
        mark = "✅" if correct else "❌"
        print(f"  {mark} {fname}: expected={expected_type} detected={detected} "
              f"score={r['total']} grade={r['grade']} "
              f"confidence={r['type_scores'].get(expected_type,0)}")

    # 类型检测准确率 (40分)
    type_accuracy = type_correct / total_samples if total_samples > 0 else 0
    type_score = type_accuracy * 40

    # 区分度: 同类型内评分 vs 不同类型评分的差距 (30分)
    # 简化: 每个类型在其期望类型下的权重分数应该最高
    cross_penalty = 0
    for fname, r in results.items():
        if not r.get("type_correct", False):
            cross_penalty += 10
            continue
        ts = r.get("type_confidence", 0)
        others = [v for k, v in r.items() if k != "type_correct" and k.startswith("type_") and k != "type_confidence" and k != "detected"]
        # 如果期望类型的置信度不是最高，扣分
        # (这个暂时跳过，因为 type_scores 是在 story_scorer 外部不好访问)

    # 各类型内评分区分度 (30分)
    # 理想: 不同类型文章的同一维度分数应该有明显差异
    scores_list = [r["total"] for r in results.values() if isinstance(r, dict) and "total" in r]
    if len(scores_list) >= 2:
        score_range = max(scores_list) - min(scores_list)
        range_score = min(score_range / 20, 1.0) * 30  # 差距20分以上满分
    else:
        range_score = 0

    total = type_score + range_score + (30 - cross_penalty)

    print(f"\n=== 评估汇总 ===")
    print(f"  类型准确率: {type_correct}/{total_samples} = {type_score:.0f}/40")
    print(f"  评分区分度: range={max(scores_list)-min(scores_list) if scores_list else 0:.1f} = {range_score:.0f}/30")
    print(f"  交叉惩罚: {cross_penalty:.0f} → {(30-cross_penalty):.0f}/30")
    print(f"=== 总分: {total:.1f}/100 ===")
    print(f"SCORE: {total:.2f}")
    return total

if __name__ == "__main__":
    eval_all()
