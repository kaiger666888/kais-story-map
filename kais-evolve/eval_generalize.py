#!/usr/bin/env python3
"""泛化性评估 — 适配实际文件名"""
import json, os, sys, subprocess

SKILL_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAMPLES = "/tmp/samples"

EXPECTED = {
    "01_power_fantasy.txt": "power_fantasy",
    "02_classic.txt": "classic_narrative",
    "03_suspense.txt": "suspense",
    "04_romance.txt": "romance",
    "05_epic.txt": "epic",
    "06_xianxia.txt": "power_fantasy",
    "07_dushi.txt": "power_fantasy",
    "08_fable.txt": "classic_narrative",
    "09_xiyouji.txt": "classic_narrative",
    "10_mystery.txt": "suspense",
    "11_horror.txt": "suspense",
    "12_crush.txt": "romance",
}

def run_analysis(txt, outdir):
    os.makedirs(outdir, exist_ok=True)
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
    total = 0
    scores_list = []
    cross_ok = 0
    type_stats = {}
    name_map = {"power_fantasy":"爽文/热血","classic_narrative":"经典叙事",
                "suspense":"悬疑/惊悚","romance":"言情/情感","epic":"史诗/历史"}

    for fname, expected_type in sorted(EXPECTED.items()):
        fpath = os.path.join(SAMPLES, fname)
        if not os.path.exists(fpath):
            print(f"  ⚠️ 缺失: {fname}")
            continue
        total += 1
        tag = fname.split("_")[0]

        d = run_analysis(fpath, f"/tmp/ev3_{tag}")
        if d is None:
            print(f"  ❌ 分析失败: {fname}")
            continue

        r = score(d)
        detected = r["story_type"]
        correct = detected == expected_type
        if correct: type_correct += 1

        ts = r["type_scores"]
        expected_conf = ts.get(expected_type, 0)
        other_max = max((v for k,v in ts.items() if k != expected_type), default=0)
        if expected_conf > other_max: cross_ok += 1

        if expected_type not in type_stats:
            type_stats[expected_type] = {"correct": 0, "total": 0}
        type_stats[expected_type]["total"] += 1
        if correct: type_stats[expected_type]["correct"] += 1

        mark = "✅" if correct else "❌"
        conf_mark = "🟢" if expected_conf > other_max else "🟡"
        print(f"  {mark}{conf_mark} {fname:25} exp={expected_type:20} got={detected:20} score={r['total']:5.1f}")
        scores_list.append(r["total"])

    type_acc = type_correct / total if total > 0 else 0
    type_score = type_acc * 50
    range_score = min((max(scores_list)-min(scores_list))/20, 1.0)*20 if len(scores_list)>=2 else 0
    cross_score = (cross_ok/total)*20 if total > 0 else 0
    avg_score = sum(scores_list)/len(scores_list) if scores_list else 0
    spread = 10 if 40<=avg_score<=80 else 5 if 30<=avg_score<=90 else 0
    total_score = type_score + range_score + cross_score + spread

    print(f"\n{'='*60}")
    print(f"  泛化性评估汇总 ({total} 样本)")
    print(f"{'='*60}")
    print(f"  类型准确率: {type_correct}/{total} = {type_acc:.0%} → {type_score:.0f}/50")
    print(f"  评分区分度: range={max(scores_list)-min(scores_list):.1f} → {range_score:.0f}/20")
    print(f"  类型置信领先: {cross_ok}/{total} → {cross_score:.0f}/20")
    print(f"  平均分: {avg_score:.1f} → {spread:.0f}/10")
    print(f"  总分: {total_score:.1f}/100")
    print(f"\n  按类型:")
    for t, s in type_stats.items():
        print(f"    {name_map.get(t,t):12} {s['correct']}/{s['total']}")
    print(f"\nSCORE: {total_score:.2f}")

if __name__ == "__main__":
    eval_all()
