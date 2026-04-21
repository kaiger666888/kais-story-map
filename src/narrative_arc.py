"""叙事弧线分析 — 滑动窗口情感打分 + 六大弧线 DTW 匹配"""
from typing import Optional

from .models import (
    ArcPoint,
    ArcShape,
    Language,
    NarrativeArcResult,
    Segment,
)
from .nlp_utils import (
    compute_sentiment_from_lexicon,
    dtw_distance,
    load_arc_shapes,
    load_nrc_lexicon,
    normalize_series,
    resample_series,
)


def compute_sentiment(
    tokens: list[str],
    language: Language,
) -> tuple[float, float]:
    """基于 NRC 词典计算正负情感得分

    Args:
        tokens: 分词列表
        language: 语言
    Returns:
        (positive_score, negative_score) 各归一化到 [0, 1]
    """
    lexicon = load_nrc_lexicon(language)
    return compute_sentiment_from_lexicon(tokens, lexicon)


def build_arc(
    segments: list[Segment],
    language: Language,
) -> NarrativeArcResult:
    """对每段打分 → 归一化 → 与六大模板 DTW 匹配 → 返回最优弧线

    Args:
        segments: 文本段落列表
        language: 语言
    Returns:
        NarrativeArcResult 包含弧线类型、置信度和各段得分
    """
    if not segments:
        return NarrativeArcResult()

    # 对每段计算情感
    arc_points: list[ArcPoint] = []
    for seg in segments:
        tokens = seg.tokens if seg.tokens else []
        pos, neg = compute_sentiment(tokens, language)
        sentiment = pos - neg  # [-1, 1]
        arc_points.append(ArcPoint(
            segment_index=seg.index,
            sentiment_score=sentiment,
            raw_positive=pos,
            raw_negative=neg,
        ))

    # 提取得分序列
    scores = [p.sentiment_score for p in arc_points]

    # 与模板匹配
    shape, confidence = classify_arc_shape(scores)

    # 计算整体轨迹（后半段平均 - 前半段平均）
    mid = len(scores) // 2
    first_half = sum(scores[:mid]) / max(mid, 1)
    second_half = sum(scores[mid:]) / max(len(scores) - mid, 1)
    trajectory = second_half - first_half

    return NarrativeArcResult(
        arc_shape=shape,
        shape_confidence=confidence,
        arc_points=arc_points,
        overall_trajectory=trajectory,
    )


def classify_arc_shape(
    scores: list[float],
) -> tuple[ArcShape, float]:
    """将情感序列与 6 种模板比较，返回最优 (形状, 置信度)

    Args:
        scores: 归一化后的情感得分序列
    Returns:
        (ArcShape, confidence)
    """
    if not scores:
        return ArcShape.FLAT, 0.0

    # 归一化到 [-1, 1]
    normalized = normalize_series(scores)

    # 加载模板
    templates = load_arc_shapes()

    # 将模板值从 [0, 1] 映射到 [-1, 1]
    mapped_templates: dict[str, list[float]] = {}
    for name, values in templates.items():
        mapped_templates[name] = [2.0 * v - 1.0 for v in values]

    # 重采样情感序列到模板长度
    target_len = 10
    resampled = resample_series(normalized, target_len)

    # 计算与每个模板的 DTW 距离
    distances: dict[str, float] = {}
    for name, template in mapped_templates.items():
        distances[name] = dtw_distance(resampled, template)

    # 找最优匹配
    if not distances:
        return ArcShape.FLAT, 0.0

    best_name = min(distances, key=distances.get)  # type: ignore
    best_dist = distances[best_name]

    # 置信度 = 1 - 归一化距离
    confidence = max(0.0, 1.0 - best_dist)

    # 如果置信度太低，标记为 flat
    if confidence < 0.2:
        return ArcShape.FLAT, confidence

    # 映射名称到枚举
    shape_map = {
        "rags_to_riches": ArcShape.RAGS_TO_RICHES,
        "riches_to_rags": ArcShape.RICHES_TO_RAGS,
        "man_in_hole": ArcShape.MAN_IN_HOLE,
        "icharus": ArcShape.ICHARUS,
        "oedipus": ArcShape.OEDIPUS,
        "cinderella": ArcShape.CINDERELLA,
    }

    return shape_map.get(best_name, ArcShape.FLAT), confidence
