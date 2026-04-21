"""NLP 工具函数 — 词典加载、情感打分、通用工具"""
import json
import os
from pathlib import Path
from typing import Optional

from .models import Language

# 获取 data 目录路径
_DATA_DIR = Path(__file__).parent.parent / "data"


def get_data_path(filename: str) -> Path:
    """获取 data 目录下文件路径

    Args:
        filename: 文件名
    Returns:
        完整路径
    """
    return _DATA_DIR / filename


def load_nrc_lexicon(language: Language) -> dict[str, list[str]]:
    """加载 NRC 情感词典

    Args:
        language: 语言
    Returns:
        {word: [emotion_tags]} 字典
    """
    if language == Language.ZH:
        path = get_data_path("nrc_zh.json")
    else:
        path = get_data_path("nrc_en.json")

    with open(path, "r", encoding="utf-8") as f:
        lexicon: dict[str, list[str]] = json.load(f)
    return lexicon


def load_arc_shapes() -> dict[str, list[float]]:
    """加载六大弧线模板

    Returns:
        {shape_name: [normalized_scores]} 字典
    """
    path = get_data_path("arc_shapes.json")
    with open(path, "r", encoding="utf-8") as f:
        shapes: dict[str, list[float]] = json.load(f)
    return shapes


def compute_sentiment_from_lexicon(
    tokens: list[str],
    lexicon: dict[str, list[str]],
) -> tuple[float, float]:
    """基于词典计算正负情感得分

    Args:
        tokens: 分词列表
        lexicon: NRC 词典
    Returns:
        (positive_score, negative_score) 归一化到 [0, 1]
    """
    if not tokens:
        return 0.0, 0.0

    pos_count = 0
    neg_count = 0
    matched = 0

    for token in tokens:
        tags = lexicon.get(token, [])
        if tags:
            matched += 1
            if "positive" in tags:
                pos_count += 1
            if "negative" in tags:
                neg_count += 1

    if matched == 0:
        return 0.0, 0.0

    pos_score = pos_count / matched
    neg_score = neg_count / matched
    return pos_score, neg_score


def normalize_series(values: list[float]) -> list[float]:
    """将数值序列归一化到 [-1, 1]

    Args:
        values: 原始数值列表
    Returns:
        归一化后的列表
    """
    if not values:
        return []
    if len(values) == 1:
        return [0.0]

    min_val = min(values)
    max_val = max(values)
    rng = max_val - min_val

    if rng < 1e-9:
        return [0.0] * len(values)

    return [2.0 * (v - min_val) / rng - 1.0 for v in values]


def resample_series(series: list[float], target_len: int) -> list[float]:
    """将序列重采样到目标长度

    Args:
        series: 原始序列
        target_len: 目标长度
    Returns:
        重采样后的序列
    """
    if not series:
        return []
    if len(series) == target_len:
        return series

    result: list[float] = []
    for i in range(target_len):
        pos = i * (len(series) - 1) / max(target_len - 1, 1)
        low = int(pos)
        high = min(low + 1, len(series) - 1)
        frac = pos - low
        result.append(series[low] * (1 - frac) + series[high] * frac)
    return result


def dtw_distance(series_a: list[float], series_b: list[float]) -> float:
    """动态时间规整距离

    Args:
        series_a: 序列 A
        series_b: 序列 B
    Returns:
        DTW 距离（归一化到 [0, 1]）
    """
    n, m = len(series_a), len(series_b)
    if n == 0 or m == 0:
        return 1.0

    # 使用简化 DTW（限制路径宽度以提升性能）
    INF = float("inf")
    dp: list[list[float]] = [[INF] * (m + 1) for _ in range(n + 1)]
    dp[0][0] = 0.0

    for i in range(1, n + 1):
        for j in range(1, m + 1):
            cost = (series_a[i - 1] - series_b[j - 1]) ** 2
            dp[i][j] = cost + min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])

    raw_dist = dp[n][m]
    # 归一化
    max_possible = sum(max(abs(a), abs(b)) ** 2 for a, b in zip(series_a, series_b))
    if max_possible < 1e-9:
        return 0.0
    return min(raw_dist / max_possible, 1.0)


def extract_dialogue_text(text: str, language: Language) -> str:
    """提取对话文本

    Args:
        text: 原始文本
        language: 语言
    Returns:
        对话文本
    """
    if language == Language.ZH:
        import re
        # 中文引号 "" '' 「」
        matches = re.findall(r'[""][^""]*[""]', text)
        matches += re.findall(r"[''][^'']*['']", text)
        return " ".join(matches)
    else:
        import re
        matches = re.findall(r'"[^"]*"', text)
        matches += re.findall(r"'[^']*'", text)
        return " ".join(matches)


def is_verb_english(word: str) -> bool:
    """启发式判断英文词是否为动词

    Args:
        word: 英文单词
    Returns:
        是否为动词
    """
    verb_suffixes = ("ing", "ed", "ize", "ise", "ify", "ate", "en")
    common_verbs = {
        "run", "walk", "go", "come", "take", "make", "do", "say", "get", "give",
        "find", "think", "tell", "become", "leave", "feel", "put", "bring", "begin",
        "show", "hear", "play", "move", "live", "believe", "hold", "bring", "happen",
        "write", "provide", "sit", "stand", "lose", "pay", "meet", "include", "continue",
        "set", "learn", "change", "lead", "understand", "watch", "follow", "stop",
        "create", "speak", "read", "allow", "add", "spend", "grow", "open", "walk",
        "win", "offer", "remember", "love", "consider", "appear", "buy", "wait",
        "serve", "die", "send", "expect", "build", "stay", "fall", "cut", "reach",
        "kill", "remain", "suggest", "raise", "pass", "sell", "require", "report",
        "decide", "pull", "fight", "throw", "hit", "push", "turn", "carry", "drive",
        "break", "catch", "keep", "draw", "choose", "wear", "pick", "receive",
        "join", "force", "cause", "produce", "agree", "support", "close", "enter",
        "wish", "try", "ask", "need", "use", "help", "talk", "start", "might",
        "want", "give", "day", "look", "work", "call", "try", "ask", "need",
    }
    word_lower = word.lower()
    if word_lower in common_verbs:
        return True
    for suffix in verb_suffixes:
        if word_lower.endswith(suffix) and len(word_lower) > len(suffix) + 1:
            return True
    return False
