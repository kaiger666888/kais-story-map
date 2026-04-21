"""编剧建议生成 — 12 条规则引擎检测问题模式"""
import statistics
from typing import Optional

from .models import (
    AdviceItem,
    AnalysisReport,
    ArcShape,
    CharacterEdge,
    CharacterNetworkResult,
    EmotionProfile,
    Language,
    NarrativeArcResult,
    PacingPoint,
    TextQualityMetrics,
)

# 8 维情绪中文名称映射
EMOTION_NAMES_ZH = {
    "anger": "愤怒", "anticipation": "期待", "disgust": "厌恶", "fear": "恐惧",
    "joy": "喜悦", "sadness": "悲伤", "surprise": "惊讶", "trust": "信任",
}
EMOTION_NAMES_EN = {
    "anger": "Anger", "anticipation": "Anticipation", "disgust": "Disgust", "fear": "Fear",
    "joy": "Joy", "sadness": "Sadness", "surprise": "Surprise", "trust": "Trust",
}

# 情感建议中的互补情绪
EMOTION_COMPLEMENT = {
    "anger": "anticipation", "anticipation": "joy", "disgust": "trust",
    "fear": "anticipation", "joy": "surprise", "sadness": "trust",
    "surprise": "joy", "trust": "joy",
}


def generate_advice(report: AnalysisReport) -> list[AdviceItem]:
    """从五维数据中检测问题模式 → 生成结构化建议

    Args:
        report: 完整分析报告
    Returns:
        AdviceItem 列表（按严重度排序）
    """
    is_zh = report.language == Language.ZH
    emotion_names = EMOTION_NAMES_ZH if is_zh else EMOTION_NAMES_EN

    rules = [
        lambda r: _check_arc_monotone(r, is_zh),
        lambda r: _check_opening_low(r, is_zh),
        lambda r: _check_midpoint_crisis(r, is_zh),
        lambda r: _check_ending_abrupt(r, is_zh),
        lambda r: _check_emotion_flat(r, is_zh, emotion_names),
        lambda r: _check_character_isolation(r, is_zh),
        lambda r: _check_character_overload(r, is_zh),
        lambda r: _check_pacing_monotone(r, is_zh),
        lambda r: _check_dialogue_balance(r, is_zh),
        lambda r: _check_vocabulary_richness(r, is_zh),
        lambda r: _check_sentence_variety(r, is_zh),
        lambda r: _check_readability(r, is_zh),
    ]

    items: list[AdviceItem] = []
    for rule in rules:
        result = rule(report)
        if result is not None:
            items.append(result)

    # 排序：critical > warning > info
    severity_order = {"critical": 0, "warning": 1, "info": 2}
    items.sort(key=lambda x: severity_order.get(x.severity, 3))

    return items


def _check_arc_monotone(report: AnalysisReport, is_zh: bool) -> Optional[AdviceItem]:
    """规则1：弧线平淡"""
    arc = report.narrative_arc
    if arc.shape_confidence < 0.3:
        if is_zh:
            return AdviceItem(
                dimension="叙事弧线",
                severity="warning",
                title="叙事弧线缺乏明确形状",
                detail=f"当前弧线类型为「{arc.arc_shape.value}」，置信度仅 {arc.shape_confidence:.0%}，读者难以感知故事走向变化。",
                suggestion="建议在故事 30% 和 70% 处设置明确的转折点，制造情感起伏。可以考虑引入意外事件、角色转变或冲突升级。",
            )
        else:
            return AdviceItem(
                dimension="Narrative Arc",
                severity="warning",
                title="Narrative arc lacks clear shape",
                detail=f"Current arc shape is '{arc.arc_shape.value}' with only {arc.shape_confidence:.0%} confidence. Readers may struggle to perceive the story's trajectory.",
                suggestion="Consider adding turning points at 30% and 70% of the story to create emotional variation. Introduce unexpected events, character transformations, or conflict escalation.",
            )
    return None


def _check_opening_low(report: AnalysisReport, is_zh: bool) -> Optional[AdviceItem]:
    """规则2：开局低迷"""
    arc = report.narrative_arc
    points = arc.arc_points
    if not points:
        return None

    n_opening = max(1, len(points) // 5)
    opening_scores = [p.sentiment_score for p in points[:n_opening]]
    avg_opening = sum(opening_scores) / len(opening_scores)

    if avg_opening < -0.3:
        if is_zh:
            return AdviceItem(
                dimension="叙事弧线",
                severity="critical",
                title="开篇情感过于压抑",
                detail=f"前 {n_opening} 段平均情感得分 {avg_opening:.2f}，可能导致读者流失。",
                suggestion="建议在开篇加入正向元素（希望/幽默/温暖）作为钩子。可以先展现角色的魅力或一个引人入胜的场景，再逐步引入冲突。",
            )
        else:
            return AdviceItem(
                dimension="Narrative Arc",
                severity="critical",
                title="Opening too pessimistic",
                detail=f"Average sentiment of first {n_opening} segments is {avg_opening:.2f}, which may cause reader drop-off.",
                suggestion="Add positive elements (hope/humor/warmth) as a hook in the opening. Consider showcasing character appeal or an engaging scene before introducing conflict.",
            )
    return None


def _check_midpoint_crisis(report: AnalysisReport, is_zh: bool) -> Optional[AdviceItem]:
    """规则3：中点塌陷"""
    arc = report.narrative_arc
    points = arc.arc_points
    if len(points) < 6:
        return None

    # 40%-60% 段落
    start = int(len(points) * 0.4)
    end = int(len(points) * 0.6)
    mid_scores = [p.sentiment_score for p in points[start:end]]

    if len(mid_scores) < 2:
        return None

    variance = statistics.variance(mid_scores) if len(mid_scores) > 1 else 0.0
    if variance < 0.05:
        if is_zh:
            return AdviceItem(
                dimension="叙事弧线",
                severity="warning",
                title="中段张力不足",
                detail=f"中段（{start}-{end} 段）情感方差仅 {variance:.3f}，存在「第二幕塌陷」风险。",
                suggestion="建议在故事中段引入子冲突、反转或新角色，打破平淡。可以考虑提高赌注（stakes）或揭示关键秘密。",
            )
        else:
            return AdviceItem(
                dimension="Narrative Arc",
                severity="warning",
                title="Midpoint tension insufficient",
                detail=f"Mid-section (segments {start}-{end}) has sentiment variance of only {variance:.3f}, risking a 'second act slump'.",
                suggestion="Introduce sub-conflicts, reversals, or new characters in the middle. Consider raising stakes or revealing key secrets.",
            )
    return None


def _check_ending_abrupt(report: AnalysisReport, is_zh: bool) -> Optional[AdviceItem]:
    """规则4：结尾突兀"""
    arc = report.narrative_arc
    points = arc.arc_points
    if len(points) < 5:
        return None

    # 最后 10% 段落
    n_ending = max(1, len(points) // 10)
    ending_scores = [p.sentiment_score for p in points[-n_ending:]]

    if len(ending_scores) < 2:
        return None

    # 计算斜率
    if len(ending_scores) >= 2:
        slope = abs(ending_scores[-1] - ending_scores[0]) / max(len(ending_scores) - 1, 1)
        if slope > 1.5:
            if is_zh:
                return AdviceItem(
                    dimension="叙事弧线",
                    severity="warning",
                    title="结尾情感变化过于剧烈",
                    detail=f"结尾情感变化斜率 {slope:.2f}，可能显得仓促。",
                    suggestion="建议增加情感过渡段落，让结尾更加自然。可以在高潮后加入一段余韵或反思。",
                )
            else:
                return AdviceItem(
                    dimension="Narrative Arc",
                    severity="warning",
                    title="Ending emotional shift too abrupt",
                    detail=f"Ending emotional slope is {slope:.2f}, which may feel rushed.",
                    suggestion="Add emotional transition paragraphs for a more natural ending. Consider a denouement or reflection after the climax.",
                )
    return None


def _check_emotion_flat(
    report: AnalysisReport,
    is_zh: bool,
    emotion_names: dict[str, str],
) -> Optional[AdviceItem]:
    """规则5：情感单调"""
    profiles = report.emotion_profiles
    if not profiles:
        return None

    # 统计每维情绪在各段中为主导的次数
    dim_dominant_count: dict[str, int] = {}
    total_segments = len(profiles)

    for profile in profiles:
        if not profile.emotions:
            continue
        max_dim = max(profile.emotions, key=profile.emotions.get)  # type: ignore
        dim_dominant_count[max_dim] = dim_dominant_count.get(max_dim, 0) + 1

    # 检查是否 1-2 维持续主导 > 60%
    sorted_dims = sorted(dim_dominant_count.items(), key=lambda x: x[1], reverse=True)
    top_dims = sorted_dims[:2]
    top_total = sum(count for _, count in top_dims)

    if top_total > total_segments * 0.6 and len(top_dims) <= 2:
        top_emotion_name = emotion_names.get(top_dims[0][0], top_dims[0][0])
        # 建议补充的情绪
        suggested = EMOTION_COMPLEMENT.get(top_dims[0][0], "surprise")
        suggested_name = emotion_names.get(suggested, suggested)

        if is_zh:
            return AdviceItem(
                dimension="情感深度",
                severity="warning",
                title="情感光谱过窄",
                detail=f"8 维情绪中「{top_emotion_name}」持续主导 {top_total} / {total_segments} 段（{top_total/total_segments:.0%}），情感层次不足。",
                suggestion=f"建议丰富情绪层次，当前以「{top_emotion_name}」为主，可加入「{suggested_name}」等情绪增加立体感。",
            )
        else:
            return AdviceItem(
                dimension="Emotional Depth",
                severity="warning",
                title="Emotional spectrum too narrow",
                detail=f"Among 8 emotion dimensions, '{top_emotion_name}' dominates {top_total}/{total_segments} segments ({top_total/total_segments:.0%}), lacking emotional variety.",
                suggestion=f"Consider enriching emotional layers. Currently dominated by '{top_emotion_name}', try adding '{suggested_name}' and other emotions for depth.",
            )
    return None


def _check_character_isolation(report: AnalysisReport, is_zh: bool) -> Optional[AdviceItem]:
    """规则6：角色孤立"""
    network = report.character_network
    if not network.nodes or not network.edges:
        return None

    # 找出中心度 > 0.3 但无强连接的角色
    for node in network.nodes:
        if node.centrality > 0.3:
            strong_connections = sum(
                1 for e in network.edges
                if (e.source == node.name or e.target == node.name) and e.weight >= 2
            )
            if strong_connections == 0:
                if is_zh:
                    return AdviceItem(
                        dimension="角色网络",
                        severity="warning",
                        title=f"角色「{node.name}」缺乏有效互动",
                        detail=f"「{node.name}」中心度 {node.centrality:.3f}（较高），但与其他角色无强连接（共现 ≥ 2 次）。",
                        suggestion=f"建议增加「{node.name}」与其他角色的对话场景，建立更丰富的人际关系网。",
                    )
                else:
                    return AdviceItem(
                        dimension="Character Network",
                        severity="warning",
                        title=f"Character '{node.name}' lacks meaningful interaction",
                        detail=f"'{node.name}' has centrality {node.centrality:.3f} (relatively high) but no strong connections (co-occurrence ≥ 2) with other characters.",
                        suggestion=f"Consider adding dialogue scenes between '{node.name}' and other characters to build a richer relationship network.",
                    )
    return None


def _check_character_overload(report: AnalysisReport, is_zh: bool) -> Optional[AdviceItem]:
    """规则7：角色过多"""
    network = report.character_network
    if not network.nodes:
        return None

    count = len(network.nodes)
    if count > 15:
        # 检查尾部 30% 角色中心度
        n_tail = max(1, count // 3)
        tail_nodes = network.nodes[-n_tail:]
        low_centrality = sum(1 for n in tail_nodes if n.centrality < 0.01)

        if low_centrality > 0:
            if is_zh:
                return AdviceItem(
                    dimension="角色网络",
                    severity="info",
                    title="角色数量过多",
                    detail=f"当前共 {count} 个角色，其中 {low_centrality} 个角色中心度极低（< 0.01），读者可能混淆。",
                    suggestion="建议合并或删除低频角色，聚焦核心人物群。将次要角色的功能整合到主要角色中。",
                )
            else:
                return AdviceItem(
                    dimension="Character Network",
                    severity="info",
                    title="Too many characters",
                    detail=f"Currently {count} characters, with {low_centrality} having very low centrality (< 0.01), which may confuse readers.",
                    suggestion="Consider merging or removing low-frequency characters. Focus on the core cast and integrate secondary characters' functions into primary ones.",
                )
    return None


def _check_pacing_monotone(report: AnalysisReport, is_zh: bool) -> Optional[AdviceItem]:
    """规则8：节奏均匀"""
    from .pacing_tension import compute_tension_curve

    tension = compute_tension_curve(report.pacing_points)
    if len(tension) < 3:
        return None

    std = statistics.stdev(tension)
    if std < 0.1:
        if is_zh:
            return AdviceItem(
                dimension="节奏张力",
                severity="warning",
                title="节奏过于均匀",
                detail=f"张力曲线标准差仅 {std:.3f}，缺乏起伏变化。",
                suggestion="建议交替使用短句（紧张）和长句（舒缓）制造节奏变化。在关键情节前放慢节奏，在高潮时加快节奏。",
            )
        else:
            return AdviceItem(
                dimension="Pacing & Tension",
                severity="warning",
                title="Pacing too uniform",
                detail=f"Tension curve standard deviation is only {std:.3f}, lacking variation.",
                suggestion="Alternate short sentences (tense) and long sentences (relaxed) to create rhythm changes. Slow down before key moments and speed up during climaxes.",
            )
    return None


def _check_dialogue_balance(report: AnalysisReport, is_zh: bool) -> Optional[AdviceItem]:
    """规则9：对话失衡"""
    pacing = report.pacing_points
    if not pacing:
        return None

    global_dialogue = sum(p.dialogue_ratio for p in pacing) / len(pacing)
    ratio_pct = global_dialogue * 100

    if global_dialogue > 0.70:
        if is_zh:
            return AdviceItem(
                dimension="节奏张力",
                severity="warning",
                title="对话占比过高",
                detail=f"全局对话占比 {ratio_pct:.0f}%，可能导致缺乏场景描写和氛围营造。",
                suggestion="建议在对话之间穿插场景描写、环境渲染和人物内心活动，将对话比调整到 30%-50%。",
            )
        else:
            return AdviceItem(
                dimension="Pacing & Tension",
                severity="warning",
                title="Dialogue ratio too high",
                detail=f"Global dialogue ratio is {ratio_pct:.0f}%, potentially lacking scene description and atmosphere.",
                suggestion="Add scene descriptions, environmental details, and character inner thoughts between dialogues. Target 30%-50% dialogue ratio.",
            )
    elif global_dialogue < 0.15:
        if is_zh:
            return AdviceItem(
                dimension="节奏张力",
                severity="warning",
                title="对话占比过低",
                detail=f"全局对话占比仅 {ratio_pct:.0f}%，可能导致缺乏人物声音和角色塑造。",
                suggestion="建议增加角色对话场景，通过对话展现性格、推动情节。将对话比提升到 30%-50%。",
            )
        else:
            return AdviceItem(
                dimension="Pacing & Tension",
                severity="warning",
                title="Dialogue ratio too low",
                detail=f"Global dialogue ratio is only {ratio_pct:.0f}%, potentially lacking character voice and development.",
                suggestion="Add character dialogue scenes to reveal personality and advance the plot. Target 30%-50% dialogue ratio.",
            )
    return None


def _check_vocabulary_richness(report: AnalysisReport, is_zh: bool) -> Optional[AdviceItem]:
    """规则10：词汇贫乏"""
    quality = report.text_quality
    if quality.ttr < 0.4:
        if is_zh:
            return AdviceItem(
                dimension="文本质量",
                severity="info",
                title="词汇重复率偏高",
                detail=f"Type-Token Ratio (TTR) 为 {quality.ttr:.2f}，低于 0.4 基准线。",
                suggestion="建议使用同义词替换高频词，丰富词汇表达。可以使用词典查找近义词，避免同一词汇反复出现。",
            )
        else:
            return AdviceItem(
                dimension="Text Quality",
                severity="info",
                title="High vocabulary repetition",
                detail=f"Type-Token Ratio (TTR) is {quality.ttr:.2f}, below the 0.4 baseline.",
                suggestion="Replace frequently used words with synonyms. Use a thesaurus to find alternatives and avoid repetitive vocabulary.",
            )
    return None


def _check_sentence_variety(report: AnalysisReport, is_zh: bool) -> Optional[AdviceItem]:
    """规则11：句式单一"""
    pacing = report.pacing_points
    if len(pacing) < 3:
        return None

    sent_lengths = [p.sentence_length_avg for p in pacing]
    std = statistics.stdev(sent_lengths)

    if std < 0.3:
        if is_zh:
            return AdviceItem(
                dimension="文本质量",
                severity="info",
                title="句式结构变化不足",
                detail=f"平均句长标准差仅 {std:.2f}，句式变化不够。",
                suggestion="建议混合使用简单句、复合句和排比句。在紧张场景用短句，在抒情场景用长句。",
            )
        else:
            return AdviceItem(
                dimension="Text Quality",
                severity="info",
                title="Insufficient sentence variety",
                detail=f"Average sentence length standard deviation is only {std:.2f}, indicating monotonous sentence structure.",
                suggestion="Mix simple, compound, and parallel sentences. Use short sentences for tense scenes and longer ones for emotional moments.",
            )
    return None


def _check_readability(report: AnalysisReport, is_zh: bool) -> Optional[AdviceItem]:
    """规则12：可读性异常"""
    quality = report.text_quality
    # 基准值：英文 60-80，中文 50-70
    baseline = 70.0 if report.language == Language.EN else 60.0
    sigma = 15.0

    deviation = abs(quality.readability_score - baseline)
    if deviation > 2 * sigma:
        is_low = quality.readability_score < baseline
        if is_zh:
            if is_low:
                return AdviceItem(
                    dimension="文本质量",
                    severity="warning",
                    title="可读性偏低",
                    detail=f"可读性评分 {quality.readability_score:.1f}，低于基准线 {baseline}，可能流失读者。",
                    suggestion="建议缩短平均句长，使用更常见的词汇，减少复杂从句嵌套。",
                )
            else:
                return AdviceItem(
                    dimension="文本质量",
                    severity="info",
                    title="可读性偏高",
                    detail=f"可读性评分 {quality.readability_score:.1f}，远高于基准线 {baseline}。",
                    suggestion="如果这是有意为之的文学风格，可以保持。否则建议适当增加句长变化和词汇深度。",
                )
        else:
            if is_low:
                return AdviceItem(
                    dimension="Text Quality",
                    severity="warning",
                    title="Readability below normal",
                    detail=f"Readability score is {quality.readability_score:.1f}, below baseline of {baseline}, potentially losing readers.",
                    suggestion="Shorten average sentence length, use more common vocabulary, and reduce complex clause nesting.",
                )
            else:
                return AdviceItem(
                    dimension="Text Quality",
                    severity="info",
                    title="Readability above normal",
                    detail=f"Readability score is {quality.readability_score:.1f}, significantly above baseline of {baseline}.",
                    suggestion="If this is an intentional literary style, maintain it. Otherwise, consider adding more sentence length variation and vocabulary depth.",
                )
    return None
