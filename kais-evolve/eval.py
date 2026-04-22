#!/usr/bin/env python3
"""kais-story-score 自动评估脚本 — 供 kais-evolve 使用"""
import json, os, sys, glob, subprocess

SKILL_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(SKILL_DIR, "src"))

def run_analysis(txt, lang, chars, outdir):
    """运行分析，返回 JSON"""
    os.makedirs(outdir, exist_ok=True)
    # 清理旧输出
    for f in glob.glob(os.path.join(outdir, "*")):
        if os.path.isfile(f): os.remove(f)
    
    cmd = [
        sys.executable, "-m", "src.cli",
        "--input", txt, "--output-dir", outdir,
        "--language", lang, "--characters", chars, "--format", "all"
    ]
    result = subprocess.run(cmd, cwd=SKILL_DIR, capture_output=True, text=True, timeout=120)
    if result.returncode != 0:
        print(f"STDERR: {result.stderr[:500]}")
        return None
    
    jf = os.path.join(outdir, "report.json")
    if not os.path.exists(jf):
        return None
    with open(jf) as f:
        return json.load(f)

def score(d):
    """计算综合评分 0-100"""
    scores = {}
    
    # 1. 角色网络质量 (20分)
    if d and "characters" in d:
        nodes = d["characters"].get("nodes", [])
        total = len(nodes)
        positive = sum(1 for n in nodes if n.get("degree", 0) > 0)
        scores["network"] = (positive / total * 20) if total > 0 else 0
    else:
        scores["network"] = 0
    
    # 2. 编剧建议质量 (20分)
    if d and "advice" in d:
        advice = d["advice"]
        total = len(advice)
        good = sum(1 for a in advice if a.get("message", "?") != "?")
        scores["advice"] = (good / total * 20) if total > 0 else 0
    else:
        scores["advice"] = 0
    
    # 3. JSON 完整性 (15分)
    if d:
        required = ["meta", "narrative_arc", "emotions", "characters", "pacing", "quality", "advice"]
        found = sum(1 for k in required if k in d)
        scores["json_complete"] = found / len(required) * 10
        # HTML 大小
        html = os.path.join("/tmp", "evolve_en", "report.html")
        if os.path.exists(html) and os.path.getsize(html) > 20000:
            scores["json_complete"] += 5
    else:
        scores["json_complete"] = 0
    
    # 4. 情感弧线精度 (15分)
    if d and "narrative_arc" in d:
        pts = d["narrative_arc"].get("points", [])
        scores["arc"] = 0
        if len(pts) > 10: scores["arc"] += 10
        conf = d["narrative_arc"].get("confidence", 0)
        if conf > 0.6: scores["arc"] += 5
    else:
        scores["arc"] = 0
    
    # === 中文专项测试 ===
    zh = run_analysis("/tmp/starwars_zh.txt", "zh",
        "卢克·天行者,达斯·维达,莱娅公主,韩·索罗,欧比旺·克诺比,楚巴卡,C-3PO,R2-D2,欧文,比格斯",
        "/tmp/evolve_zh")
    
    # 5. 中文角色匹配 (15分)
    scores["zh_network"] = 0
    if zh and "characters" in zh:
        nodes = zh["characters"].get("nodes", [])
        for n in nodes:
            if n.get("degree", 0) > 0:
                scores["zh_network"] = 15
                break
    
    # 6. 中文对话检测 (15分)
    scores["zh_dialogue"] = 0
    if zh and "pacing" in zh:
        pacing = zh["pacing"]
        if pacing:
            avg_dialogue = sum(p.get("dialogue_ratio", 0) for p in pacing) / len(pacing)
            if avg_dialogue > 0.05:
                scores["zh_dialogue"] = 15
            elif avg_dialogue > 0.01:
                scores["zh_dialogue"] = 7
    
    total = sum(scores.values())
    
    print(f"=== 评分明细 ===")
    for k, v in scores.items():
        print(f"  {k}: {v:.1f}")
    print(f"=== 总分: {total:.1f}/100 ===")
    return total

if __name__ == "__main__":
    # 英文基线测试
    d = run_analysis("/tmp/starwars_clean.txt", "en",
        "Luke Skywalker,Darth Vader,Princess Leia,Han Solo,Obi-Wan Kenobi,Biggs,Chewbacca,C-3PO,R2-D2,Owen Lars",
        "/tmp/evolve_en")
    
    total = score(d)
    print(f"SCORE: {total:.2f}")
