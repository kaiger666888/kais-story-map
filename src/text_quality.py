"""文本质量分析 — TTR / 句法复杂度 / 词汇丰富度 / 可读性评分"""
import math
from collections import Counter

from .models import Language, Segment, TextQualityMetrics
from .preprocess import extract_sentences, tokenize_segment


def compute_ttr(tokens: list[str]) -> float:
    """计算 Type-Token Ratio

    Args:
        tokens: 分词列表
    Returns:
        TTR 值 [0, 1]
    """
    if not tokens:
        return 0.0
    unique = set(t.lower() for t in tokens)
    return len(unique) / len(tokens)


def compute_syntax_complexity(
    sentences: list[str],
    language: Language,
) -> float:
    """计算句法复杂度（嵌套从句深度均值）

    英文使用 spaCy dependency tree，中文使用启发式标点统计

    Args:
        sentences: 句子列表
        language: 语言
    Returns:
        平均句法复杂度
    """
    if not sentences:
        return 0.0

    complexities: list[float] = []

    if language == Language.EN:
        complexities = _english_syntax_complexity(sentences)
    else:
        complexities = _chinese_syntax_complexity(sentences)

    if not complexities:
        return 0.0
    return sum(complexities) / len(complexities)


def compute_vocabulary_richness(tokens: list[str]) -> float:
    """计算词汇丰富度（前 1000 高频词覆盖率）

    Args:
        tokens: 分词列表
    Returns:
        词汇丰富度 [0, 1]，越高表示词汇越多样
    """
    if not tokens:
        return 0.0

    counter = Counter(t.lower() for t in tokens)
    total = len(tokens)
    top_n = min(100, len(counter))
    top_count = sum(count for _, count in counter.most_common(top_n))
    coverage = top_count / total

    # 丰富度 = 1 - 覆盖率（覆盖越低越丰富）
    return 1.0 - coverage


def compute_readability(
    sentences: list[str],
    tokens: list[str],
    language: Language,
) -> float:
    """计算可读性评分

    英文使用 Flesch Reading Ease
    中文使用简化公式

    Args:
        sentences: 句子列表
        tokens: 分词列表
        language: 语言
    Returns:
        可读性评分
    """
    if not sentences or not tokens:
        return 0.0

    if language == Language.EN:
        return _flesch_reading_ease(sentences, tokens)
    else:
        return _chinese_readability(sentences, tokens)


def compute_all_metrics(
    segments: list[Segment],
    sentences: list[str],
    language: Language,
) -> TextQualityMetrics:
    """汇总所有文本质量指标

    Args:
        segments: 文本段落列表
        sentences: 完整句子列表
        language: 语言
    Returns:
        TextQualityMetrics
    """
    # 合并所有 tokens
    all_tokens: list[str] = []
    for seg in segments:
        all_tokens.extend(seg.tokens if seg.tokens else [])

    ttr = compute_ttr(all_tokens)
    syntax = compute_syntax_complexity(sentences, language)
    vocab_richness = compute_vocabulary_richness(all_tokens)
    readability = compute_readability(sentences, all_tokens, language)

    # 平均句长
    avg_sent_len = len(all_tokens) / max(len(sentences), 1)

    # 综合评分等级
    grade = _compute_grade(ttr, syntax, vocab_richness, readability, language)

    return TextQualityMetrics(
        ttr=ttr,
        avg_sentence_length=avg_sent_len,
        syntax_complexity=syntax,
        vocabulary_richness=vocab_richness,
        readability_score=readability,
        grade=grade,
    )


def _english_syntax_complexity(sentences: list[str]) -> list[float]:
    """英文句法复杂度：使用 spaCy dependency tree 深度

    Args:
        sentences: 句子列表
    Returns:
        每句的复杂度列表
    """
    complexities: list[float] = []
    try:
        import spacy
        nlp = spacy.load("en_core_web_sm")
        for sent in sentences:
            doc = nlp(sent)
            max_depth = 0
            for token in doc:
                depth = 0
                current = token
                while current.head != current:
                    depth += 1
                    current = current.head
                    if depth > 20:
                        break
                max_depth = max(max_depth, depth)
            complexities.append(float(max_depth))
    except Exception:
        # 降级：基于逗号和从句连接词数量
        import re
        for sent in sentences:
            clauses = re.split(r',\s*(?:and|but|or|which|that|who|whom|where|when|while|because|if|although|since|unless|until|before|after)\b', sent, flags=re.IGNORECASE)
            complexities.append(float(max(len(clauses) - 1, 0)))
    return complexities


def _chinese_syntax_complexity(sentences: list[str]) -> list[float]:
    """中文句法复杂度：基于标点符号嵌套层级

    Args:
        sentences: 句子列表
    Returns:
        每句的复杂度列表
    """
    complexities: list[float] = []
    for sent in sentences:
        # 统计嵌套标点层级
        depth = 0
        max_depth = 0
        open_puncts = "（〔【《「"
        close_puncts = "）〕】》」"
        comma_like = "，、；："
        # 逗号增加一层
        for ch in sent:
            if ch in open_puncts:
                depth += 1
                max_depth = max(max_depth, depth)
            elif ch in close_puncts:
                depth = max(0, depth - 1)
            elif ch in comma_like:
                depth += 1
                max_depth = max(max_depth, depth)
        complexities.append(float(max_depth))
    return complexities


def _flesch_reading_ease(sentences: list[str], tokens: list[str]) -> float:
    """Flesch Reading Ease 可读性评分

    Args:
        sentences: 句子列表
        tokens: 分词列表
    Returns:
        Flesch 评分（0-100，越高越易读）
    """
    total_words = len(tokens)
    total_sentences = len(sentences)

    # 统计音节数（简化估算）
    total_syllables = 0
    for token in tokens:
        total_syllables += _count_syllables(token)

    if total_words == 0 or total_sentences == 0:
        return 0.0

    score = (
        206.835
        - 1.015 * (total_words / total_sentences)
        - 84.6 * (total_syllables / total_words)
    )
    return max(0.0, min(100.0, score))


def _count_syllables(word: str) -> int:
    """估算英文单词的音节数

    Args:
        word: 英文单词
    Returns:
        音节数
    """
    word = word.lower().strip()
    if not word:
        return 0
    # 简化估算：元音组数
    vowels = "aeiouy"
    count = 0
    prev_vowel = False
    for ch in word:
        is_vowel = ch in vowels
        if is_vowel and not prev_vowel:
            count += 1
        prev_vowel = is_vowel
    # 词尾 e 通常不发音
    if word.endswith("e") and count > 1:
        count -= 1
    return max(count, 1)


def _chinese_readability(sentences: list[str], tokens: list[str]) -> float:
    """中文可读性评分（简化公式）

    基于平均句长和词汇难度

    Args:
        sentences: 句子列表
        tokens: 分词列表
    Returns:
        可读性评分（0-100）
    """
    if not sentences or not tokens:
        return 0.0

    avg_sent_len = len(tokens) / len(sentences)

    # 中文可读性：句长越短越易读
    # 基准：平均句长 10-15 字较易读
    score = 100 - (avg_sent_len - 10) * 3
    return max(0.0, min(100.0, score))


def _compute_grade(
    ttr: float,
    syntax: float,
    vocab: float,
    readability: float,
    language: Language,
) -> str:
    """计算综合评分等级

    Args:
        ttr: Type-Token Ratio
        syntax: 句法复杂度
        vocab: 词汇丰富度
        readability: 可读性评分
        language: 语言
    Returns:
        等级 A/B/C/D
    """
    # 标准化各项到 [0, 1]
    ttr_score = min(ttr / 0.6, 1.0)  # TTR > 0.6 很好
    syntax_score = min(syntax / 5.0, 1.0) if syntax > 0 else 0.5
    vocab_score = min(vocab / 0.8, 1.0)
    read_score = readability / 100.0 if language == Language.EN else readability / 100.0

    # 加权平均
    overall = (
        ttr_score * 0.25 +
        syntax_score * 0.20 +
        vocab_score * 0.25 +
        read_score * 0.30
    )

    if overall >= 0.75:
        return "A"
    elif overall >= 0.55:
        return "B"
    elif overall >= 0.35:
        return "C"
    else:
        return "D"
