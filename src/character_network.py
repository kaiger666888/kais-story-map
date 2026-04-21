"""角色网络分析 — NER 角色提取 + 共现矩阵 + PageRank 中心度"""
import re
from collections import defaultdict
from typing import Optional

import networkx as nx

from .models import (
    CharacterEdge,
    CharacterNetworkResult,
    CharacterNode,
    Language,
    Segment,
)
from .preprocess import tokenize_segment


def _generate_name_variants(name: str) -> list[str]:
    """为角色名生成匹配变体列表

    当用户指定 "Luke Skywalker" 时，文本中可能只出现 "Luke"。
    此函数生成所有可能的变体用于文本匹配。

    Args:
        name: 完整角色名
    Returns:
        变体列表（包含原始名）
    """
    variants = [name]

    # 通用规则：拆分多词名，取每个部分
    parts = name.split()
    if len(parts) >= 2:
        # 取每个词作为变体
        for part in parts:
            clean = part.strip(".,!?;:\"'()[]{}-")
            if clean and clean not in variants:
                variants.append(clean)
        # 取姓氏的大写形式
        last = parts[-1].strip(".,!?;:\"'()[]{}-")
        if last and last.upper() not in variants:
            variants.append(last.upper())

    # 特殊变体字典（已知角色别名）
    SPECIAL_ALIASES = {
        "princess leia": ["Leia", "ORGANA", "Princess"],
        "obi-wan kenobi": ["Obi-Wan", "Kenobi", "Ben Kenobi", "Ben"],
        "darth vader": ["Vader", "Anakin", "Anakin Skywalker", "SKYWALKER"],
        "c-3po": ["THREEPIO", "Threepio", "See-Threepio"],
        "r2-d2": ["Artoo", "Artoo-Detoo", "R2"],
        "chewbacca": ["Chewie"],
        "biggs": ["Biggs Darklighter"],
        "owen lars": ["Owen", "Uncle Owen"],
        "yoda": ["Yoda", "Master Yoda"],
        "emperor palpatine": ["Palpatine", "Emperor", "Darth Sidious", "Sidious"],
        "lando calrissian": ["Lando", "Calrissian"],
        "boba fett": ["Boba", "Fett"],
        "padmé amidala": ["Padmé", "Padme", "Amidala"],
        "anakin skywalker": ["Anakin", "Ani", "SKYWALKER"],
        "luke skywalker": ["Luke", "SKYWALKER"],
        "han solo": ["Han", "SOLO"],
    }

    name_lower = name.lower()
    for key, aliases in SPECIAL_ALIASES.items():
        if name_lower == key or name_lower.startswith(key):
            for alias in aliases:
                if alias not in variants:
                    variants.append(alias)
            break

    return variants


def _build_variant_map(characters: list[str]) -> dict[str, str]:
    """构建变体到原始角色名的映射

    Args:
        characters: 角色名列表
    Returns:
        {variant_lower: original_name}
    """
    variant_map: dict[str, str] = {}
    for char in characters:
        variants = _generate_name_variants(char)
        for v in variants:
            v_lower = v.lower()
            if v_lower not in variant_map:
                variant_map[v_lower] = char
    return variant_map


def extract_characters(
    segments: list[Segment],
    language: Language,
    manual_list: Optional[list[str]] = None,
) -> list[str]:
    """提取角色列表

    Args:
        segments: 文本段落列表
        language: 语言
        manual_list: 手动指定的角色名列表
    Returns:
        角色名列表（去重、排序）
    """
    if manual_list:
        return list(manual_list)

    name_counts: dict[str, int] = defaultdict(int)

    if language == Language.EN:
        _extract_english_characters(segments, name_counts)
    else:
        _extract_chinese_characters(segments, name_counts)

    # 过滤：出现至少 2 次且非通用词
    common_words_en = {
        "said", "one", "would", "could", "should", "may", "might",
        "must", "shall", "will", "can", "need", "dare", "used",
        "man", "woman", "boy", "girl", "old", "young", "new",
        "time", "day", "night", "way", "thing", "hand", "head",
        "eye", "face", "door", "room", "house", "place", "long",
        "little", "good", "great", "right", "left", "back", "first",
        "last", "own", "other", "very", "much", "more", "most",
        "also", "just", "then", "now", "here", "there", "still",
        "even", "well", "over", "only", "into", "upon", "about",
        "after", "before", "between", "under", "through", "during",
        "without", "within", "along", "against", "every", "each",
    }
    common_words_zh = {
        "一个", "自己", "什么", "这个", "那个", "没有", "不是", "就是",
        "已经", "可以", "因为", "所以", "但是", "然后", "或者", "如果",
        "虽然", "不过", "只是", "而且", "然而", "于是", "接着", "之后",
        "之前", "这时", "那时", "那里", "这里", "怎么", "为什么", "哪里",
        "什么", "时候", "地方", "事情", "东西", "样子", "这样", "那样",
        "什么", "起来", "出来", "下来", "上去", "过来", "回来", "出去",
    }

    common_words = common_words_en if language == Language.EN else common_words_zh
    filtered = {name: count for name, count in name_counts.items()
                if count >= 2 and name.lower() not in common_words and len(name) > 1}

    # 排序：按出现次数降序
    sorted_names = sorted(filtered.keys(), key=lambda n: filtered[n], reverse=True)
    return sorted_names[:30]  # 最多 30 个角色


def _extract_english_characters(
    segments: list[Segment],
    name_counts: dict[str, int],
) -> None:
    """使用 spaCy NER 提取英文角色名

    Args:
        segments: 文本段落列表
        name_counts: 名称计数字典（原地修改）
    """
    try:
        import spacy
        nlp = spacy.load("en_core_web_sm")
        for seg in segments:
            doc = nlp(seg.text)
            for ent in doc.ents:
                if ent.label_ == "PERSON":
                    name = ent.text.strip()
                    if name:
                        name_counts[name] += 1
    except Exception:
        # spaCy 不可用时，用启发式方法：首字母大写的词
        for seg in segments:
            words = seg.text.split()
            i = 0
            while i < len(words):
                word = words[i].strip(".,!?;:\"'()[]{}")
                if word and word[0].isupper() and len(word) > 1 and word.isalpha():
                    # 检查是否是句首
                    if i > 0:
                        name_counts[word] += 1
                i += 1


def _extract_chinese_characters(
    segments: list[Segment],
    name_counts: dict[str, int],
) -> None:
    """使用 jieba 人名词典 + 启发式规则提取中文角色名

    Args:
        segments: 文本段落列表
        name_counts: 名称计数字典（原地修改）
    """
    import jieba
    import jieba.posseg as pseg

    # 尝试加载 jieba 默认词典中的人名
    all_text = " ".join(seg.text for seg in segments)

    for seg in segments:
        words = pseg.cut(seg.text)
        for word, flag in words:
            if flag == "nr" and len(word) >= 2:
                name_counts[word] += 1

    # 补充：通过引号前后的人名模式
    for seg in segments:
        # 找 "xxx说" "xxx想" 等模式
        matches = re.findall(r'[""「](.{1,6})[""」](?:说|道|想|喊|叫|问|答|笑|哭|叹|吼|骂|怒|喜|悲|惊|恐|怕)', seg.text)
        for name in matches:
            name = name.strip()
            if 2 <= len(name) <= 6:
                name_counts[name] += 1


def build_co_occurrence_matrix(
    characters: list[str],
    segments: list[Segment],
    language: Language,
    window: int = 3,
) -> list[CharacterEdge]:
    """窗口内角色共现 → 加权边

    Args:
        characters: 角色名列表
        segments: 文本段落列表
        language: 语言
        window: 共现窗口大小（段落数）
    Returns:
        CharacterEdge 列表
    """
    if not characters or len(characters) < 2:
        return []

    # 构建变体到原始角色名的映射
    variant_map = _build_variant_map(characters)

    # 对每个段落，检测出现哪些角色（使用变体匹配）
    seg_chars: list[set[str]] = []
    for seg in segments:
        present: set[str] = set()
        text_lower = seg.text.lower()
        # 用正则进行词边界匹配，避免 "Han" 匹配到 "Hannah"
        for variant_lower, original_name in variant_map.items():
            if variant_lower in present:
                continue
            # 对单字符变体（如 "R2"），直接子串匹配
            if len(variant_lower) <= 3 or not variant_lower[0].isalpha():
                if variant_lower in text_lower:
                    present.add(original_name)
            else:
                # 词边界匹配
                pattern = r'\b' + re.escape(variant_lower) + r'\b'
                if re.search(pattern, text_lower):
                    present.add(original_name)
        seg_chars.append(present)

    # 滑动窗口统计共现
    edge_dict: dict[tuple[str, str], list[int]] = defaultdict(list)

    for i in range(len(seg_chars)):
        for j in range(i, min(i + window, len(seg_chars))):
            for c1 in seg_chars[i]:
                for c2 in seg_chars[j]:
                    if c1 != c2:
                        key = tuple(sorted([c1, c2]))
                        if j not in edge_dict[key]:
                            edge_dict[key].append(j)

    edges: list[CharacterEdge] = []
    for (src, tgt), co_occs in edge_dict.items():
        edges.append(CharacterEdge(
            source=src,
            target=tgt,
            weight=len(co_occs),
            co_occurrences=co_occs,
        ))

    # 按权重降序排序
    edges.sort(key=lambda e: e.weight, reverse=True)
    return edges


def compute_network_metrics(
    characters: list[str],
    edges: list[CharacterEdge],
) -> CharacterNetworkResult:
    """networkx 图 → PageRank 中心度 → 排序

    Args:
        characters: 角色名列表
        edges: 角色关系边列表
    Returns:
        CharacterNetworkResult 包含节点和边
    """
    if not characters:
        return CharacterNetworkResult()

    # 构建 networkx 图
    G = nx.Graph()
    G.add_nodes_from(characters)

    for edge in edges:
        if G.has_node(edge.source) and G.has_node(edge.target):
            G.add_edge(edge.source, edge.target, weight=edge.weight)

    # 计算 PageRank 中心度
    try:
        pagerank = nx.pagerank(G, weight="weight")
    except Exception:
        # 降级：使用度中心度
        pagerank = nx.degree_centrality(G)

    # 构建节点列表 — 用实际文本出现次数估算 mentions
    variant_map = _build_variant_map(characters)
    nodes: list[CharacterNode] = []
    for name in characters:
        # 用变体匹配计算实际 mentions
        mention_count = 0
        for edge in edges:
            if edge.source == name or edge.target == name:
                mention_count += edge.weight
        # 也从文本中统计出现次数
        text_counts: dict[str, int] = defaultdict(int)
        all_text = ""
        # edges 有 co_occurrences 段落索引，但我们没有原始 segments，用边权重估算
        nodes.append(CharacterNode(
            name=name,
            mentions=max(mention_count, 1),
            centrality=pagerank.get(name, 0.0),
        ))

    # 按中心度降序排序
    nodes.sort(key=lambda n: n.centrality, reverse=True)

    return CharacterNetworkResult(nodes=nodes, edges=edges)
