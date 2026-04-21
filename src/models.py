"""数据模型定义 — 所有分析模块的输入/输出类型"""
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class Language(Enum):
    """支持的语言"""
    EN = "en"
    ZH = "zh"


class ArcShape(Enum):
    """六大叙事弧线类型 + 平坦"""
    RAGS_TO_RICHES = "rags_to_riches"
    RICHES_TO_RAGS = "riches_to_rags"
    MAN_IN_HOLE = "man_in_hole"
    ICHARUS = "icharus"
    OEDIPUS = "oedipus"
    CINDERELLA = "cinderella"
    FLAT = "flat"


@dataclass
class Segment:
    """文本段落"""
    index: int
    text: str
    tokens: list[str] = field(default_factory=list)
    start_char: int = 0
    end_char: int = 0


@dataclass
class ArcPoint:
    """弧线上的一个点"""
    segment_index: int
    sentiment_score: float = 0.0       # [-1, 1]
    raw_positive: float = 0.0
    raw_negative: float = 0.0


@dataclass
class NarrativeArcResult:
    """叙事弧线分析结果"""
    arc_shape: ArcShape = ArcShape.FLAT
    shape_confidence: float = 0.0       # [0, 1]
    arc_points: list[ArcPoint] = field(default_factory=list)
    overall_trajectory: float = 0.0     # 正=上升, 负=下降


@dataclass
class EmotionProfile:
    """单个段落的情感剖面"""
    segment_index: int
    emotions: dict[str, float] = field(default_factory=dict)  # 8 NRC 维度


@dataclass
class CharacterNode:
    """角色节点"""
    name: str
    mentions: int = 0
    centrality: float = 0.0


@dataclass
class CharacterEdge:
    """角色关系边"""
    source: str
    target: str
    weight: int = 0
    co_occurrences: list[int] = field(default_factory=list)  # 共现段落索引


@dataclass
class CharacterNetworkResult:
    """角色网络分析结果"""
    nodes: list[CharacterNode] = field(default_factory=list)
    edges: list[CharacterEdge] = field(default_factory=list)


@dataclass
class PacingPoint:
    """节奏分析单点"""
    segment_index: int
    sentence_length_avg: float = 0.0
    dialogue_ratio: float = 0.0
    description_ratio: float = 0.0
    action_density: float = 0.0        # 动词/总词数


@dataclass
class TextQualityMetrics:
    """文本质量指标"""
    ttr: float = 0.0                    # Type-Token Ratio
    avg_sentence_length: float = 0.0
    syntax_complexity: float = 0.0      # 嵌套深度均值
    vocabulary_richness: float = 0.0    # 高频词覆盖率
    readability_score: float = 0.0      # Flesch / 中文简化公式
    grade: str = "C"                    # A/B/C/D


@dataclass
class AdviceItem:
    """编剧建议条目"""
    dimension: str = ""
    severity: str = "info"              # info | warning | critical
    title: str = ""
    detail: str = ""
    suggestion: str = ""


@dataclass
class AnalysisReport:
    """完整分析报告"""
    language: Language = Language.EN
    total_segments: int = 0
    total_words: int = 0
    source_file: str = ""
    narrative_arc: NarrativeArcResult = field(default_factory=NarrativeArcResult)
    emotion_profiles: list[EmotionProfile] = field(default_factory=list)
    character_network: CharacterNetworkResult = field(default_factory=CharacterNetworkResult)
    pacing_points: list[PacingPoint] = field(default_factory=list)
    text_quality: TextQualityMetrics = field(default_factory=TextQualityMetrics)
    advice: list[AdviceItem] = field(default_factory=list)
