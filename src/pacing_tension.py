"""节奏张力分析 — 句长/对话比/描写比/动作密度"""
import re
from typing import Optional

from .models import Language, PacingPoint, Segment
from .nlp_utils import extract_dialogue_text, is_verb_english
from .preprocess import extract_sentences


def detect_dialogue(
    text: str,
    language: Language,
) -> float:
    """计算对话占比

    Args:
        text: 文本段落
        language: 语言
    Returns:
        对话文本长度 / 总文本长度
    """
    if not text.strip():
        return 0.0

    dialogue = extract_dialogue_text(text, language)
    return len(dialogue) / max(len(text), 1)


def compute_pacing(
    segments: list[Segment],
    language: Language,
) -> list[PacingPoint]:
    """计算每个段落的节奏指标

    Args:
        segments: 文本段落列表
        language: 语言
    Returns:
        PacingPoint 列表
    """
    points: list[PacingPoint] = []

    for seg in segments:
        sentences = extract_sentences(seg.text, language)
        tokens = seg.tokens if seg.tokens else []

        # 平均句长（词数/句数）
        avg_sent_len = len(tokens) / max(len(sentences), 1)

        # 对话比
        dialogue_ratio = detect_dialogue(seg.text, language)

        # 描写比（非对话、非动作的文本占比）
        description_ratio = _compute_description_ratio(seg.text, language, dialogue_ratio)

        # 动作密度（动词/总词数）
        action_density = _compute_action_density(tokens, language)

        points.append(PacingPoint(
            segment_index=seg.index,
            sentence_length_avg=avg_sent_len,
            dialogue_ratio=dialogue_ratio,
            description_ratio=description_ratio,
            action_density=action_density,
        ))

    return points


def compute_tension_curve(
    pacing_points: list[PacingPoint],
) -> list[float]:
    """计算加权张力曲线

    短句 + 对话多 → 高张力
    长句 + 描写多 → 低张力

    Args:
        pacing_points: 节奏分析点列表
    Returns:
        张力值列表 [0, 1]
    """
    if not pacing_points:
        return []

    tensions: list[float] = []
    for pp in pacing_points:
        # 短句贡献：句长越短张力越高（反向归一化）
        # 假设平均句长范围 5-40
        short_sentence_score = max(0, 1.0 - (pp.sentence_length_avg - 5) / 35.0)

        # 对话贡献：对话越多张力越高
        dialogue_score = pp.dialogue_ratio

        # 动作贡献
        action_score = min(pp.action_density * 3, 1.0)

        # 加权综合
        tension = (
            short_sentence_score * 0.35 +
            dialogue_score * 0.30 +
            action_score * 0.35
        )
        tensions.append(max(0.0, min(1.0, tension)))

    return tensions


def _compute_description_ratio(
    text: str,
    language: Language,
    dialogue_ratio: float,
) -> float:
    """计算描写文本占比

    Args:
        text: 文本段落
        language: 语言
        dialogue_ratio: 对话占比
    Returns:
        描写占比 [0, 1]
    """
    if not text.strip():
        return 0.0

    # 去除对话文本后的剩余文本即为描写
    dialogue = extract_dialogue_text(text, language)
    non_dialogue_len = max(len(text) - len(dialogue), 0)
    total_len = max(len(text), 1)

    return non_dialogue_len / total_len


def _compute_action_density(
    tokens: list[str],
    language: Language,
) -> float:
    """计算动作密度（动词/总词数）

    Args:
        tokens: 分词列表
        language: 语言
    Returns:
        动作密度 [0, 1]
    """
    if not tokens:
        return 0.0

    verb_count = 0

    if language == Language.EN:
        for token in tokens:
            if is_verb_english(token):
                verb_count += 1
    else:
        # 中文：使用 jieba 词性标注
        try:
            import jieba.posseg as pseg
            text = "".join(tokens)
            words = pseg.cut(text)
            for word, flag in words:
                if flag.startswith("v"):
                    verb_count += 1
        except Exception:
            # 降级：启发式
            action_chars = {"打", "跑", "走", "跳", "飞", "冲", "抓", "推", "拉",
                          "拿", "放", "看", "听", "说", "喊", "叫", "打", "踢",
                          "砍", "刺", "射", "投", "抛", "摔", "撞", "翻", "转",
                          "爬", "蹲", "跪", "站", "坐", "躺", "靠", "贴", "抱",
                          "背", "扛", "抬", "举", "挥", "摇", "摆", "拧", "扭",
                          "捏", "掐", "撕", "扯", "拉", "拽", "拖", "推", "挤"}
            for token in tokens:
                if any(c in action_chars for c in token):
                    verb_count += 1

    return verb_count / len(tokens)
