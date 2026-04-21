"""数据导出 — JSON / CSV 序列化"""
import csv
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .models import (
    AdviceItem,
    AnalysisReport,
    ArcPoint,
    CharacterEdge,
    CharacterNode,
    EmotionProfile,
    Language,
    NarrativeArcResult,
    PacingPoint,
    TextQualityMetrics,
)
from .pacing_tension import compute_tension_curve


def to_json(report: AnalysisReport, path: str) -> None:
    """序列化为 JSON 文件

    Args:
        report: 完整分析报告
        path: 输出文件路径
    """
    data = _report_to_dict(report)

    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def to_csv(report: AnalysisReport, dir_path: str) -> list[str]:
    """导出多张 CSV 文件

    Args:
        report: 完整分析报告
        dir_path: 输出目录
    Returns:
        生成的文件路径列表
    """
    os.makedirs(dir_path, exist_ok=True)
    files: list[str] = []

    # arc.csv
    arc_path = os.path.join(dir_path, "arc.csv")
    with open(arc_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["segment", "score", "positive", "negative", "arc_shape", "confidence"])
        for pt in report.narrative_arc.arc_points:
            writer.writerow([
                pt.segment_index, f"{pt.sentiment_score:.4f}",
                f"{pt.raw_positive:.4f}", f"{pt.raw_negative:.4f}",
                report.narrative_arc.arc_shape.value,
                f"{report.narrative_arc.shape_confidence:.4f}",
            ])
    files.append(arc_path)

    # emotions.csv
    emo_path = os.path.join(dir_path, "emotions.csv")
    with open(emo_path, "w", newline="", encoding="utf-8") as f:
        dims = ["anger", "anticipation", "disgust", "fear", "joy", "sadness", "surprise", "trust"]
        writer = csv.writer(f)
        writer.writerow(["segment"] + dims + ["dominant_emotion"])
        for profile in report.emotion_profiles:
            dominant = max(profile.emotions, key=profile.emotions.get) if profile.emotions else ""
            writer.writerow(
                [profile.segment_index] +
                [f"{profile.emotions.get(d, 0):.4f}" for d in dims] +
                [dominant]
            )
    files.append(emo_path)

    # characters.csv
    char_path = os.path.join(dir_path, "characters.csv")
    with open(char_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["name", "mentions", "centrality", "top_connections", "connection_count"])
        for node in report.character_network.nodes:
            connections = [
                e.target if e.source == node.name else e.source
                for e in report.character_network.edges
                if e.source == node.name or e.target == node.name
            ][:5]
            writer.writerow([
                node.name, node.mentions, f"{node.centrality:.4f}",
                "; ".join(connections),
                len(connections),
            ])
    files.append(char_path)

    # character_edges.csv
    edge_path = os.path.join(dir_path, "character_edges.csv")
    with open(edge_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["source", "target", "weight"])
        for edge in report.character_network.edges:
            writer.writerow([edge.source, edge.target, edge.weight])
    files.append(edge_path)

    # pacing.csv
    tension = compute_tension_curve(report.pacing_points)
    pace_path = os.path.join(dir_path, "pacing.csv")
    with open(pace_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["segment", "avg_sentence_length", "dialogue_ratio", "description_ratio", "action_density", "tension"])
        for i, pp in enumerate(report.pacing_points):
            writer.writerow([
                pp.segment_index,
                f"{pp.sentence_length_avg:.2f}",
                f"{pp.dialogue_ratio:.4f}",
                f"{pp.description_ratio:.4f}",
                f"{pp.action_density:.4f}",
                f"{tension[i]:.4f}" if i < len(tension) else "0",
            ])
    files.append(pace_path)

    # quality.csv
    qual_path = os.path.join(dir_path, "quality.csv")
    with open(qual_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["ttr", "avg_sentence_length", "syntax_complexity", "vocabulary_richness", "readability_score", "grade"])
        q = report.text_quality
        writer.writerow([
            f"{q.ttr:.4f}", f"{q.avg_sentence_length:.2f}",
            f"{q.syntax_complexity:.2f}", f"{q.vocabulary_richness:.4f}",
            f"{q.readability_score:.2f}", q.grade,
        ])
    files.append(qual_path)

    # advice.csv
    adv_path = os.path.join(dir_path, "advice.csv")
    with open(adv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["dimension", "severity", "title", "detail", "suggestion"])
        for item in report.advice:
            writer.writerow([item.dimension, item.severity, item.title, item.detail, item.suggestion])
    files.append(adv_path)

    return files


def json_schema() -> dict[str, Any]:
    """返回 JSON Schema 描述

    Returns:
        JSON Schema 字典
    """
    return {
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "StoryMap Analysis Report",
        "type": "object",
        "required": ["meta", "narrative_arc", "emotions", "characters", "pacing", "quality", "advice"],
        "properties": {
            "meta": {
                "type": "object",
                "properties": {
                    "source_file": {"type": "string"},
                    "language": {"type": "string", "enum": ["en", "zh"]},
                    "total_segments": {"type": "integer"},
                    "total_words": {"type": "integer"},
                    "generated_at": {"type": "string", "format": "date-time"},
                },
            },
            "narrative_arc": {"type": "object"},
            "emotions": {"type": "array"},
            "characters": {"type": "object"},
            "pacing": {"type": "array"},
            "quality": {"type": "object"},
            "advice": {"type": "array"},
        },
    }


def _get_node_degree(name: str, edges: list) -> int:
    """计算节点在边列表中的度数"""
    count = 0
    for e in edges:
        if e.source == name or e.target == name:
            count += 1
    return count


def _report_to_dict(report: AnalysisReport) -> dict[str, Any]:
    """将 AnalysisReport 转换为可序列化的字典

    Args:
        report: 完整分析报告
    Returns:
        字典
    """
    tension = compute_tension_curve(report.pacing_points)

    return {
        "meta": {
            "source_file": report.source_file,
            "language": report.language.value,
            "total_segments": report.total_segments,
            "total_words": report.total_words,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        },
        "narrative_arc": {
            "shape": report.narrative_arc.arc_shape.value,
            "confidence": report.narrative_arc.shape_confidence,
            "trajectory": report.narrative_arc.overall_trajectory,
            "points": [
                {
                    "segment": p.segment_index,
                    "score": round(p.sentiment_score, 4),
                    "positive": round(p.raw_positive, 4),
                    "negative": round(p.raw_negative, 4),
                }
                for p in report.narrative_arc.arc_points
            ],
        },
        "emotions": [
            {
                "segment": p.segment_index,
                **{k: round(v, 4) for k, v in p.emotions.items()},
            }
            for p in report.emotion_profiles
        ],
        "characters": {
            "nodes": [
                {
                    "name": n.name,
                    "mentions": n.mentions,
                    "centrality": round(n.centrality, 4),
                    "degree": _get_node_degree(n.name, report.character_network.edges),
                }
                for n in report.character_network.nodes
            ],
            "edges": [
                {
                    "source": e.source,
                    "target": e.target,
                    "weight": e.weight,
                }
                for e in report.character_network.edges
            ],
        },
        "pacing": [
            {
                "segment": p.segment_index,
                "avg_sentence_length": round(p.sentence_length_avg, 2),
                "dialogue_ratio": round(p.dialogue_ratio, 4),
                "description_ratio": round(p.description_ratio, 4),
                "action_density": round(p.action_density, 4),
                "tension": round(tension[i], 4) if i < len(tension) else 0,
            }
            for i, p in enumerate(report.pacing_points)
        ],
        "quality": {
            "ttr": round(report.text_quality.ttr, 4),
            "avg_sentence_length": round(report.text_quality.avg_sentence_length, 2),
            "syntax_complexity": round(report.text_quality.syntax_complexity, 2),
            "vocabulary_richness": round(report.text_quality.vocabulary_richness, 4),
            "readability_score": round(report.text_quality.readability_score, 2),
            "grade": report.text_quality.grade,
        },
        "advice": [
            {
                "dimension": a.dimension,
                "severity": a.severity,
                "title": a.title,
                "detail": a.detail,
                "suggestion": a.suggestion,
                "message": a.suggestion or a.detail or a.title,
            }
            for a in report.advice
        ],
    }
