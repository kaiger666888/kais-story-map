"""文本预处理 — 语言检测、分段、分词、断句"""
import re
import unicodedata
from typing import Optional

from .models import Language, Segment


def detect_language(text: str) -> Language:
    """基于 CJK 字符占比判断中英文

    Args:
        text: 输入文本
    Returns:
        Language 枚举值
    """
    if not text:
        return Language.EN
    cjk_count = sum(1 for ch in text if '\u4e00' <= ch <= '\u9fff')
    ratio = cjk_count / len(text)
    return Language.ZH if ratio > 0.15 else Language.EN


def split_into_segments(
    text: str,
    window_size: int = 500,
    overlap: int = 100,
    language: Language = Language.EN,
) -> list[Segment]:
    """滑动窗口分段

    Args:
        text: 完整文本
        window_size: 窗口大小（英文按词数，中文按字数）
        overlap: 重叠大小
        language: 语言
    Returns:
        Segment 列表
    """
    segments: list[Segment] = []

    if language == Language.ZH:
        # 中文按字数分段
        chars = text
        step = window_size - overlap
        if step <= 0:
            step = window_size
        i = 0
        idx = 0
        while i < len(chars):
            end = min(i + window_size, len(chars))
            seg_text = chars[i:end]
            # 尝试在句号处断开
            if end < len(chars):
                last_period = max(seg_text.rfind('。'), seg_text.rfind('！'),
                                  seg_text.rfind('？'), seg_text.rfind('\n'))
                if last_period > window_size * 0.3:
                    end = i + last_period + 1
                    seg_text = chars[i:end]
            segments.append(Segment(
                index=idx,
                text=seg_text,
                start_char=i,
                end_char=end,
            ))
            idx += 1
            i += step if (i + step) <= len(chars) else window_size
    else:
        # 英文按词数分段
        words = text.split()
        step = window_size - overlap
        if step <= 0:
            step = window_size
        i = 0
        idx = 0
        while i < len(words):
            end_idx = min(i + window_size, len(words))
            chunk = words[i:end_idx]
            # 尝试在句号处断开
            if end_idx < len(words):
                # 找最后一个句号结尾的词
                for j in range(len(chunk) - 1, -1, -1):
                    if chunk[j].rstrip('.,!?;:').endswith('.'):
                        end_idx = i + j + 1
                        chunk = words[i:end_idx]
                        break
            seg_text = ' '.join(chunk)
            start_pos = len(' '.join(words[:i]))
            segments.append(Segment(
                index=idx,
                text=seg_text,
                start_char=start_pos,
                end_char=start_pos + len(seg_text),
            ))
            idx += 1
            i += step if (i + step) <= len(words) else window_size

    return segments


def tokenize_segment(segment: Segment, language: Language) -> list[str]:
    """对段落进行分词

    Args:
        segment: 文本段落
        language: 语言
    Returns:
        分词结果列表
    """
    text = segment.text
    if not text.strip():
        return []

    if language == Language.ZH:
        import jieba
        tokens = jieba.lcut(text)
        # 过滤空白和标点
        tokens = [t for t in tokens if t.strip() and not _is_punctuation_zh(t)]
        return tokens
    else:
        try:
            import nltk
            tokens = nltk.word_tokenize(text)
            tokens = [t.lower() for t in tokens if t.strip() and t.isalpha()]
            return tokens
        except Exception:
            # 降级：简单分词
            tokens = re.findall(r'[a-zA-Z]+', text.lower())
            return tokens


def extract_sentences(text: str, language: Language) -> list[str]:
    """断句

    Args:
        text: 完整文本
        language: 语言
    Returns:
        句子列表
    """
    if not text.strip():
        return []

    if language == Language.ZH:
        # 中文按标点断句
        sentences = re.split(r'[。！？\n]+', text)
        sentences = [s.strip() for s in sentences if s.strip()]
        return sentences
    else:
        try:
            import nltk
            sentences = nltk.sent_tokenize(text)
            return [s.strip() for s in sentences if s.strip()]
        except Exception:
            # 降级：按句号断句
            sentences = re.split(r'[.!?]+', text)
            return [s.strip() for s in sentences if s.strip()]


def _is_punctuation_zh(char: str) -> bool:
    """判断是否为中文标点"""
    if len(char) > 1:
        # jieba 可能输出多字符 token
        return all(
            unicodedata.category(c).startswith('P') or c in '，。！？；：""''（）、…—·《》【】'
            for c in char
        )
    cp = ord(char)
    if (0x3000 <= cp <= 0x303F) or (0xFF00 <= cp <= 0xFFEF):
        return True
    return unicodedata.category(char).startswith('P')


def tokenize_text(text: str, language: Language) -> list[str]:
    """对完整文本分词（不分段）

    Args:
        text: 完整文本
        language: 语言
    Returns:
        分词结果列表
    """
    seg = Segment(index=0, text=text)
    return tokenize_segment(seg, language)
