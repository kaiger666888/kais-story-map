"""情感深度分析 — NRC 8 维情绪统计"""
from .models import EmotionProfile, Language, Segment
from .nlp_utils import load_nrc_lexicon

# 8 维情绪名称
EMOTION_DIMENSIONS = [
    "anger", "anticipation", "disgust", "fear",
    "joy", "sadness", "surprise", "trust",
]


def compute_emotion_profile(
    tokens: list[str],
    lexicon: dict[str, list[str]],
    segment_index: int = 0,
) -> EmotionProfile:
    """统计单个段落的 8 维情绪

    Args:
        tokens: 分词列表
        lexicon: NRC 词典 {word: [emotion_tags]}
        segment_index: 段落索引
    Returns:
        EmotionProfile 包含 8 维情绪得分
    """
    emotions: dict[str, float] = {dim: 0.0 for dim in EMOTION_DIMENSIONS}
    total_matched = 0

    for token in tokens:
        tags = lexicon.get(token, [])
        if tags:
            total_matched += 1
            for dim in EMOTION_DIMENSIONS:
                if dim in tags:
                    emotions[dim] += 1

    # 归一化：每维得分 = 出现次数 / 匹配总词数
    if total_matched > 0:
        for dim in EMOTION_DIMENSIONS:
            emotions[dim] = emotions[dim] / total_matched

    return EmotionProfile(
        segment_index=segment_index,
        emotions=emotions,
    )


def compute_all_profiles(
    segments: list[Segment],
    language: Language,
) -> list[EmotionProfile]:
    """批量计算所有段落的情感剖面

    Args:
        segments: 文本段落列表
        language: 语言
    Returns:
        EmotionProfile 列表
    """
    lexicon = load_nrc_lexicon(language)
    profiles: list[EmotionProfile] = []

    for seg in segments:
        tokens = seg.tokens if seg.tokens else []
        profile = compute_emotion_profile(tokens, lexicon, seg.index)
        profiles.append(profile)

    return profiles
