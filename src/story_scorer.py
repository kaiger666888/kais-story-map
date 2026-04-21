#!/usr/bin/env python3
"""
故事质量评分系统 v2 — 类型感知权重
核心思想：不同类型的好故事有不同的"理想形状"
"""
import json, sys, os, math
from typing import Optional

# ============================================================
# 故事类型定义：每种类型有不同的"理想特征"和权重
# ============================================================

STORY_TYPES = {
    "power_fantasy": {
        "name": "爽文/热血",
        "description": "主角碾压、打脸、升级流",
        "ideal": {
            "arc_shape": ["cinderella", "rags_to_riches", "icarus"],  # 先抑后扬或持续上升
            "tension_mean_min": 0.55,    # 全程高压
            "tension_amplitude_min": 0.3, # 要有高潮爆发
            "pacing_change_rate_min": 0.04,
            "dialogue_ratio_range": (0.15, 0.45),  # 对话驱动
            "avg_sentence_len_max": 25,  # 短句制造紧迫感
            "network_density_range": (0.4, 0.8),  # 允许星形网络
            "dominant_emotions_ok": True,  # 允许情绪集中在2-3个
        },
        "weights": {
            "arc": 0.25,        # 弧线重要（爽感曲线）
            "emotion": 0.15,     # 情感相对次要（爽文靠张力）
            "network": 0.15,     # 网络结构不太重要
            "pacing": 0.30,      # 节奏最重要（爽感来源）
            "text_quality": 0.15, # 文本质量一般
        }
    },
    "classic_narrative": {
        "name": "经典叙事",
        "description": "英雄之旅、文学小说、电影剧本",
        "ideal": {
            "arc_shape": ["man_in_a_hole", "cinderella", "oedipus"],  # 需要曲折
            "tension_amplitude_min": 0.25,  # 明显的高低起伏
            "pacing_change_rate_min": 0.05,  # 张弛有度
            "network_density_range": (0.3, 0.7),  # 多中心网络
            "secondary_hubs_min": 2,  # 至少2个次中心
            "emotion_coverage_min": 6,   # 情感丰富
            "dominant_emotion_ratio_max": 0.35,  # 不依赖单一情绪
            "dialogue_ratio_range": (0.15, 0.40),
            "sentence_len_variance_min": 3,  # 句长有变化
        },
        "weights": {
            "arc": 0.20,
            "emotion": 0.25,     # 情感丰富度很重要
            "network": 0.20,     # 角色关系很重要
            "pacing": 0.20,
            "text_quality": 0.15,
        }
    },
    "suspense": {
        "name": "悬疑/惊悚",
        "description": "推理、恐怖、心理惊悚",
        "ideal": {
            "tension_mean_min": 0.50,     # 持续紧张
            "tension_amplitude_min": 0.20,
            "pacing_change_rate_min": 0.03, # 缓慢铺垫
            "fear_ratio_min": 0.15,        # 恐惧感要强
            "trust_ratio_max": 0.10,       # 信任感低（不信任氛围）
            "dialogue_ratio_range": (0.10, 0.35),
            "network_density_range": (0.3, 0.7),  # 复杂关系网
            "secondary_hubs_min": 2,
        },
        "weights": {
            "arc": 0.15,
            "emotion": 0.25,     # 情绪氛围最重要
            "network": 0.20,     # 关系网揭示线索
            "pacing": 0.25,      # 节奏控制最重要
            "text_quality": 0.15,
        }
    },
    "romance": {
        "name": "言情/情感",
        "description": "爱情、家庭、成长",
        "ideal": {
            "joy_ratio_min": 0.15,          # 喜悦感
            "sadness_ratio_min": 0.10,       # 悲伤感
            "trust_ratio_min": 0.10,         # 信任感
            "dialogue_ratio_range": (0.20, 0.50),  # 对话密集
            "avg_sentence_len_range": (10, 35),
            "network_density_range": (0.3, 0.7),
            "secondary_hubs_min": 1,
        },
        "weights": {
            "arc": 0.15,
            "emotion": 0.30,     # 情感深度最核心
            "network": 0.25,     # 人物关系最重要
            "pacing": 0.15,
            "text_quality": 0.15,
        }
    },
    "epic": {
        "name": "史诗/历史",
        "description": "战争、历史、宏大叙事",
        "ideal": {
            "arc_shape": ["man_in_a_hole", "icarus", "cinderella"],
            "emotion_coverage_min": 7,
            "network_density_range": (0.4, 0.8),  # 大量角色
            "character_count_min": 8,
            "secondary_hubs_min": 3,  # 多条支线
            "tension_amplitude_min": 0.30,
            "avg_sentence_len_range": (15, 50),  # 允许长句
            "syntax_complexity_min": 1.0,
        },
        "weights": {
            "arc": 0.15,
            "emotion": 0.20,
            "network": 0.25,     # 角色网络最核心
            "pacing": 0.15,
            "text_quality": 0.25, # 文本质量重要
        }
    },
}

# ============================================================
# 类型检测：基于文本特征自动分类
# ============================================================

def detect_story_type(d: dict) -> str:
    """基于分析数据自动检测故事类型"""
    scores = {}

    # 提取特征
    pts = d.get("narrative_arc", {}).get("points", [])
    emo = d.get("emotions", [])
    cn = d.get("characters", {})
    pacing = d.get("pacing", [])
    quality = d.get("text_quality", {})

    # --- 特征计算 ---
    # 张力均值
    tensions = [p.get("tension", 0) for p in pacing] if pacing else [0.5]
    tension_mean = sum(tensions) / len(tensions)

    # 张力振幅
    tension_amp = max(tensions) - min(tensions) if tensions else 0

    # 张力变化率
    chg = [abs(tensions[i] - tensions[i-1]) for i in range(1, len(tensions))]
    pacing_change = sum(chg) / len(chg) if chg else 0

    # 对话比例
    dlg = [p.get("dialogue_ratio", 0) for p in pacing] if pacing else [0]
    dialogue_mean = sum(dlg) / len(dlg)

    # 平均句长
    sl = [p.get("avg_sentence_length", 20) for p in pacing] if pacing else [20]
    avg_sl = sum(sl) / len(sl)

    # 句长方差
    sl_var = sum((s - avg_sl)**2 for s in sl) / len(sl) if sl else 0
    sentence_variance = math.sqrt(sl_var)

    # 角色数
    nodes = cn.get("nodes", [])
    edges = cn.get("edges", [])
    n_chars = len(nodes)
    max_edges = n_chars * (n_chars - 1) / 2 if n_chars > 1 else 1
    density = len(edges) / max_edges if max_edges > 0 else 0

    # 次中心节点数（degree > 核心节点 degree 的 30%）
    if nodes:
        max_deg = max(n.get("degree", 0) for n in nodes)
        threshold = max_deg * 0.3 if max_deg > 0 else 0
        secondary_hubs = sum(1 for n in nodes if 0 < n.get("degree", 0) < max_deg and n.get("degree", 0) >= threshold)
    else:
        secondary_hubs = 0

    # 情感分布
    dims = ["anger", "anticipation", "disgust", "fear", "joy", "sadness", "surprise", "trust"]
    dim_ratios = {}
    for dim in dims:
        vals = [p.get(dim, 0) for p in emo] if emo else [0]
        total = sum(vals)
        dim_ratios[dim] = total / len(vals) if vals else 0

    # 主导情绪数（占比>20%的）
    dominant = sum(1 for v in dim_ratios.values() if v > 0.20)

    # 情感覆盖（峰值>15%的）
    coverage = sum(1 for dim in dims if any(p.get(dim, 0) > 0.15 for p in emo))

    # --- 类型打分 ---
    # 策略：寻找每种类型的"唯一指纹"
    # 不共享分数，每种类型只有自己特有的信号才能得分

    # ===== 爽文 (power_fantasy) =====
    # 指纹：极短句(<8) AND NOT 恐惧主导
    pf_score = 0
    fear_r = dim_ratios.get("fear", 0)
    trust_r = dim_ratios.get("trust", 0)
    is_fear_dominant = fear_r > 0.15 and fear_r > trust_r
    if avg_sl < 8 and not is_fear_dominant: pf_score += 50  # 极短句=爽文铁证(但非恐惧)
    elif avg_sl < 8 and is_fear_dominant: pf_score -= 30     # 短句+恐惧=悬疑不是爽文
    elif avg_sl < 12:
        if nodes and len(nodes) > 1:
            degrees = sorted([n.get("degree", 0) for n in nodes], reverse=True)
            if degrees[0] > 0 and degrees[0] > sum(degrees[1:]) * 0.5:
                pf_score += 40   # 短句+星形
                # 但如果 fear<0.10 且 joy+sad 都高，可能是言情
                joy_r = dim_ratios.get("joy", 0)
                sad_r = dim_ratios.get("sadness", 0)
                if fear_r < 0.10 and joy_r > 0.15 and sad_r > 0.15:
                    pf_score -= 20  # 降低爽文分，让言情胜出
        elif dominant <= 2:
            pf_score += 25   # 短句+情绪集中
    scores["power_fantasy"] = pf_score

    # ===== 经典叙事 (classic_narrative) =====
    # 指纹：多角色(>=5) + 多次中心(>=2) + 对话低(<15%) + 情感覆盖广(>=6)
    cl_score = 0
    if n_chars >= 5 and secondary_hubs >= 2 and dialogue_mean < 0.15:
        cl_score += 40                               # 经典铁证组合
    elif coverage >= 6 and dialogue_mean < 0.20:
        cl_score += 30
    elif coverage >= 6 and dialogue_mean < 0.25:
        cl_score += 15
    # 经典叙事允许 fear 较高（战争场景）
    if secondary_hubs >= 2 and n_chars >= 5 and tension_amp > 0.3:
        cl_score += 10
    # 反信号
    if avg_sl < 10: cl_score -= 20
    if dominant <= 1: cl_score -= 15
    scores["classic_narrative"] = cl_score

    # ===== 悬疑/惊悚 (suspense) =====
    # 指纹：fear>trust AND 次中心>=2 (复杂关系网中的恐惧)
    su_score = 0
    fear_r = dim_ratios.get("fear", 0)
    trust_r = dim_ratios.get("trust", 0)
    if fear_r > trust_r and secondary_hubs >= 2: su_score += 45  # 独占组合
    elif fear_r > trust_r and secondary_hubs >= 1: su_score += 25
    elif fear_r > 0.10 and n_chars >= 4: su_score += 15
    # 反信号
    if dim_ratios.get("joy", 0) > 0.25: su_score -= 20
    scores["suspense"] = su_score

    # ===== 言情/情感 (romance) =====
    # 指纹：joy+sad 都高 AND trust 较高 AND fear较低 AND 对话较高
    ro_score = 0
    joy_r = dim_ratios.get("joy", 0)
    sad_r = dim_ratios.get("sadness", 0)
    trust_r = dim_ratios.get("trust", 0)
    fear_r = dim_ratios.get("fear", 0)
    is_romance_emo = joy_r > 0.15 and sad_r > 0.15 and fear_r < 0.15
    if is_romance_emo and dialogue_mean > 0.15: ro_score += 50  # 独占：悲喜交织+对话+无恐惧
    elif is_romance_emo: ro_score += 35
    elif joy_r > 0.10 and sad_r > 0.10: ro_score += 20
    # 反信号
    if fear_r > 0.20: ro_score -= 25
    if dim_ratios.get("disgust", 0) > 0.15: ro_score -= 15
    scores["romance"] = ro_score

    # ===== 史诗/历史 (epic) =====
    # 指纹：大量角色(>=10) OR (>=6角色 AND >=3次中心)
    ep_score = 0
    if n_chars >= 10: ep_score += 50                 # 独占：超多角色
    elif n_chars >= 6 and secondary_hubs >= 3: ep_score += 40  # 独占组合
    elif n_chars >= 6 and secondary_hubs >= 2: ep_score += 20
    elif n_chars >= 5: ep_score += 10
    # 反信号
    if avg_sl < 8: ep_score -= 20
    if dominant <= 1: ep_score -= 10
    scores["epic"] = ep_score

    # 返回最高分类型
    best = max(scores, key=scores.get)
    return best, scores


# ============================================================
# 加权评分
# ============================================================

def score_story(d: dict, story_type: str = None) -> dict:
    """对故事进行类型感知的质量评分"""

    if story_type is None:
        story_type, type_scores = detect_story_type(d)
    else:
        type_scores = {}

    st = STORY_TYPES[story_type]
    ideal = st["ideal"]
    weights = st["weights"]

    # 提取特征（同 detect_story_type）
    pts = d.get("narrative_arc", {}).get("points", [])
    emo = d.get("emotions", [])
    cn = d.get("characters", {})
    pacing = d.get("pacing", [])
    quality = d.get("text_quality", {})

    tensions = [p.get("tension", 0) for p in pacing] if pacing else [0.5]
    tension_mean = sum(tensions) / len(tensions)
    tension_amp = max(tensions) - min(tensions) if tensions else 0
    chg = [abs(tensions[i] - tensions[i-1]) for i in range(1, len(tensions))]
    pacing_change = sum(chg) / len(chg) if chg else 0
    dlg = [p.get("dialogue_ratio", 0) for p in pacing] if pacing else [0]
    dialogue_mean = sum(dlg) / len(dlg)
    sl = [p.get("avg_sentence_length", 20) for p in pacing] if pacing else [20]
    avg_sl = sum(sl) / len(sl)
    sl_var = sum((s - avg_sl)**2 for s in sl) / len(sl) if sl else 0
    sentence_variance = math.sqrt(sl_var)
    nodes = cn.get("nodes", [])
    edges = cn.get("edges", [])
    n_chars = len(nodes)
    max_edges = n_chars * (n_chars - 1) / 2 if n_chars > 1 else 1
    density = len(edges) / max_edges if max_edges > 0 else 0
    if nodes:
        max_deg = max(n.get("degree", 0) for n in nodes)
        threshold = max_deg * 0.5 if max_deg > 0 else 0
        secondary_hubs = sum(1 for n in nodes if 0 < n.get("degree", 0) < max_deg and n.get("degree", 0) >= threshold)
    else:
        secondary_hubs = 0
    dims = ["anger", "anticipation", "disgust", "fear", "joy", "sadness", "surprise", "trust"]
    dim_totals = {}
    for dim in dims:
        vals = [p.get(dim, 0) for p in emo] if emo else [0]
        dim_totals[dim] = sum(vals) / len(vals) if vals else 0
    coverage = sum(1 for dim in dims if any(p.get(dim, 0) > 0.15 for p in emo))
    dominant = sum(1 for v in dim_totals.values() if v > 0.20)
    total_dim = sum(dim_totals.values()) if dim_totals else 1
    dominant_ratio = max(dim_totals.values()) / total_dim if total_dim > 0 else 0
    arc_conf = d.get("narrative_arc", {}).get("confidence", 0)
    arc_shape = d.get("narrative_arc", {}).get("shape", "")

    # ---- 逐维度评分（0-100）----

    # 1. 弧线评分
    arc_score = 0
    if arc_conf > 0.8: arc_score += 30
    elif arc_conf > 0.6: arc_score += 20
    elif arc_conf > 0.4: arc_score += 10
    if tension_amp > 0.4: arc_score += 30
    elif tension_amp > 0.3: arc_score += 20
    elif tension_amp > 0.2: arc_score += 10
    # 转折次数（情感方向变化）
    if len(pts) > 2:
        turns = sum(1 for i in range(2, len(pts))
                    if (pts[i]['score'] - pts[i-1]['score']) * (pts[i-1]['score'] - pts[i-2]['score']) < 0)
        if turns >= 3: arc_score += 25
        elif turns >= 2: arc_score += 15
        elif turns >= 1: arc_score += 8
    # 有最低谷和最高峰
    if len(pts) > 0:
        if min(p['score'] for p in pts) < -0.3: arc_score += 8
        if max(p['score'] for p in pts) > 0.5: arc_score += 7
    arc_score = min(arc_score, 100)

    # 2. 情感深度评分
    emo_score = 0
    # 覆盖度
    emo_score += coverage * 8  # 最多 64
    # 主导情绪合理性
    if ideal.get("dominant_emotions_ok"):
        # 爽文等类型允许集中
        if dominant <= 3: emo_score += 18
        elif dominant <= 5: emo_score += 10
    else:
        # 经典叙事等需要分散
        if dominant_ratio < 0.25: emo_score += 18
        elif dominant_ratio < 0.35: emo_score += 10
    # 情感峰值强度
    peak_count = sum(1 for dim in dims if any(p.get(dim, 0) > 0.5 for p in emo))
    emo_score += peak_count * 3  # 最多 24
    # 类型特有情感
    if "fear_ratio_min" in ideal and dim_totals.get("fear", 0) >= ideal["fear_ratio_min"]:
        emo_score += 5
    if "joy_ratio_min" in ideal and dim_totals.get("joy", 0) >= ideal["joy_ratio_min"]:
        emo_score += 5
    emo_score = min(emo_score, 100)

    # 3. 角色网络评分
    net_score = 0
    # 密度
    dr = ideal.get("network_density_range", (0.2, 0.8))
    if dr[0] <= density <= dr[1]: net_score += 25
    elif density > 0: net_score += 10
    # 次中心
    sh_min = ideal.get("secondary_hubs_min", 1)
    if secondary_hubs >= sh_min: net_score += 30
    elif secondary_hubs >= sh_min - 1: net_score += 15
    # 角色数
    if ideal.get("character_count_min", 0) and n_chars >= ideal["character_count_min"]:
        net_score += 15
    elif n_chars >= 3: net_score += 8
    # 连接梯度（不完全图才有意义）
    if edges:
        wts = [e.get("weight", 1) for e in edges]
        w_range = max(wts) - min(wts) if len(wts) > 1 else 0
        if w_range > 0: net_score += 15
        elif len(edges) > 0: net_score += 5
    else:
        net_score += 5  # 零连接也给点分
    # 核心节点不要独占所有连接
    if nodes:
        top_deg = max(n.get("degree", 0) for n in nodes)
        if top_deg < len(edges) * 0.6: net_score += 15
    net_score = min(net_score, 100)

    # 4. 节奏张力评分
    pac_score = 0
    # 张力振幅
    amp_min = ideal.get("tension_amplitude_min", 0.2)
    if tension_amp >= amp_min: pac_score += 25
    elif tension_amp >= amp_min * 0.6: pac_score += 12
    # 变化率
    cr_min = ideal.get("pacing_change_rate_min", 0.03)
    if pacing_change >= cr_min: pac_score += 20
    elif pacing_change >= cr_min * 0.5: pac_score += 10
    # 张力均值
    tm_min = ideal.get("tension_mean_min", 0)
    if tm_min > 0 and tension_mean >= tm_min: pac_score += 15
    else: pac_score += 10  # 没有最低要求则给基础分
    # 对话比例
    dr2 = ideal.get("dialogue_ratio_range", (0.1, 0.5))
    if dr2[0] <= dialogue_mean <= dr2[1]: pac_score += 20
    elif dialogue_mean > 0: pac_score += 8
    # 句长方差
    sv_min = ideal.get("sentence_len_variance_min", 0)
    if sv_min > 0 and sentence_variance >= sv_min: pac_score += 10
    elif sentence_variance > 1: pac_score += 5
    # 高潮存在
    if tension_amp > 0.3:
        max_t_idx = tensions.index(max(tensions))
        if max_t_idx < len(tensions) * 0.8: pac_score += 10  # 高潮不在最后=有铺垫
    pac_score = min(pac_score, 100)

    # 5. 文本质量评分
    txt_score = 0
    ttr = quality.get("ttr", 0)
    if ttr > 0.15: txt_score += 25
    elif ttr > 0.10: txt_score += 15
    elif ttr > 0.05: txt_score += 8
    # 句长合适度
    slr = ideal.get("avg_sentence_len_range", (8, 40))
    if slr[0] <= avg_sl <= slr[1]: txt_score += 25
    elif avg_sl > 0: txt_score += 10
    # 句法复杂度
    sc_min = ideal.get("syntax_complexity_min", 0)
    if sc_min > 0 and quality.get("syntax_complexity", 0) >= sc_min: txt_score += 20
    elif quality.get("syntax_complexity", 0) > 0.5: txt_score += 10
    # 句长变化
    if sentence_variance > 5: txt_score += 15
    elif sentence_variance > 2: txt_score += 8
    # 词汇丰富度
    if quality.get("vocabulary_richness", 0) > 0.5: txt_score += 15
    elif quality.get("vocabulary_richness", 0) > 0.3: txt_score += 8
    txt_score = min(txt_score, 100)

    # ---- 加权总分 ----
    raw_total = (
        arc_score * weights["arc"] +
        emo_score * weights["emotion"] +
        net_score * weights["network"] +
        pac_score * weights["pacing"] +
        txt_score * weights["text_quality"]
    )

    return {
        "story_type": story_type,
        "story_type_name": st["name"],
        "type_scores": type_scores,
        "dimensions": {
            "arc": {"score": arc_score, "weight": weights["arc"], "label": "叙事弧线"},
            "emotion": {"score": emo_score, "weight": weights["emotion"], "label": "情感深度"},
            "network": {"score": net_score, "weight": weights["network"], "label": "角色网络"},
            "pacing": {"score": pac_score, "weight": weights["pacing"], "label": "节奏张力"},
            "text_quality": {"score": txt_score, "weight": weights["text_quality"], "label": "文本质量"},
        },
        "total": round(raw_total, 1),
        "grade": "S" if raw_total >= 85 else "A" if raw_total >= 70 else "B" if raw_total >= 55 else "C" if raw_total >= 40 else "D",
    }


if __name__ == "__main__":
    import sys
    for f in sys.argv[1:]:
        with open(f) as fp:
            d = json.load(fp)
        r = score_story(d)
        print(f"\n{'='*50}")
        print(f"  📊 {os.path.basename(f)}")
        print(f"{'='*50}")
        print(f"  检测类型: {r['story_type_name']} ({r['story_type']})")
        print(f"  总分: {r['total']}/100  评级: {r['grade']}")
        print(f"\n  维度评分:")
        for k, v in r['dimensions'].items():
            bar = '█' * (v['score'] // 5) + '░' * (20 - v['score'] // 5)
            print(f"    {v['label']:8} [{v['score']:3d}/100] {bar}  (权重{v['weight']:.0%})")
        print(f"\n  类型置信度:")
        for t, s in sorted(r['type_scores'].items(), key=lambda x:-x[1]):
            name = STORY_TYPES[t]["name"]
            bar = '█' * (s // 5) + '░' * (20 - s // 5)
            print(f"    {name:12} {s:3d}/100 {bar}")
