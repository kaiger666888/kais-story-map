"""CLI 主入口 — argparse 命令行 + Jinja2 HTML 渲染"""
import argparse
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# 确保可以导入 src 下的模块
sys.path.insert(0, str(Path(__file__).parent))

from .models import (
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
from .preprocess import (
    detect_language,
    extract_sentences,
    split_into_segments,
    tokenize_segment,
    tokenize_text,
)
from .narrative_arc import build_arc
from .emotional_depth import compute_all_profiles
from .character_network import (
    build_co_occurrence_matrix,
    compute_network_metrics,
    extract_characters,
)
from .pacing_tension import compute_pacing, compute_tension_curve
from .text_quality import compute_all_metrics
from .screenwriter_advice import generate_advice
from .export import to_json, to_csv, _report_to_dict
from .pacing_tension import compute_tension_curve as _tension


def main() -> None:
    """argparse 入口"""
    parser = argparse.ArgumentParser(
        description="kais-story-map: 小说五维特性可视化分析",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("--input", "-i", required=True, help="输入文本文件路径 (.txt)")
    parser.add_argument("--output-dir", "-o", default="./output", help="输出目录 (默认: ./output)")
    parser.add_argument("--language", "-l", choices=["zh", "en"], default=None,
                        help="语言代码 (默认自动检测)")
    parser.add_argument("--characters", "-c", default=None,
                        help="手动指定角色名列表（逗号分隔）")
    parser.add_argument("--format", "-f", choices=["html", "json", "csv", "all"], default="html",
                        help="输出格式 (默认: html)")

    args = parser.parse_args()

    # 读取输入文件
    input_path = Path(args.input)
    if not input_path.exists():
        print(f"错误：文件不存在: {args.input}", file=sys.stderr)
        sys.exit(1)

    text = input_path.read_text(encoding="utf-8")
    if not text.strip():
        print("错误：文件内容为空", file=sys.stderr)
        sys.exit(1)

    # 语言检测
    lang = Language(args.language) if args.language else detect_language(text)

    # 角色列表
    manual_chars = None
    if args.characters:
        manual_chars = [c.strip() for c in args.characters.split(",") if c.strip()]

    # 执行分析
    report = run_analysis(text, language=lang, manual_characters=manual_chars)
    report.source_file = str(input_path)

    # 创建输出目录
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    # 导出
    fmt = args.format

    if fmt in ("html", "all"):
        html_path = str(output_dir / "report.html")
        render_html(report, html_path)
        print(f"✅ HTML 报告已生成: {html_path}")

    if fmt in ("json", "all"):
        json_path = str(output_dir / "report.json")
        to_json(report, json_path)
        print(f"✅ JSON 数据已生成: {json_path}")

    if fmt in ("csv", "all"):
        csv_dir = str(output_dir / "csv")
        files = to_csv(report, csv_dir)
        print(f"✅ CSV 文件已生成: {csv_dir}/ ({len(files)} files)")


def run_analysis(
    text: str,
    language: Optional[Language] = None,
    manual_characters: Optional[list[str]] = None,
) -> AnalysisReport:
    """编排完整分析管线

    Args:
        text: 完整文本
        language: 语言（None 则自动检测）
        manual_characters: 手动角色列表
    Returns:
        AnalysisReport
    """
    # 语言检测
    if language is None:
        language = detect_language(text)

    print(f"📖 语言: {language.value}")
    print(f"📝 文本长度: {len(text)} 字符")

    # 预处理：分段（默认窗口 200 词，步长 50，提高分析粒度）
    segments = split_into_segments(text, window_size=200, overlap=150, language=language)
    print(f"📊 分段数: {len(segments)}")

    # 预处理：分词
    for seg in segments:
        seg.tokens = tokenize_segment(seg, language)

    # 预处理：断句
    sentences = extract_sentences(text, language)
    print(f"📄 句子数: {len(sentences)}")

    # 全文分词
    all_tokens = tokenize_text(text, language)
    total_words = len(all_tokens)

    # 1. 叙事弧线
    print("🔄 分析叙事弧线...")
    narrative_arc = build_arc(segments, language)
    print(f"   弧线类型: {narrative_arc.arc_shape.value} (置信度: {narrative_arc.shape_confidence:.2f})")

    # 2. 情感深度
    print("🔄 分析情感深度...")
    emotion_profiles = compute_all_profiles(segments, language)

    # 3. 角色网络
    print("🔄 分析角色网络...")
    characters = extract_characters(segments, language, manual_characters)
    print(f"   检测到 {len(characters)} 个角色")
    edges = build_co_occurrence_matrix(characters, segments, language)
    character_network = compute_network_metrics(characters, edges)

    # 4. 节奏张力
    print("🔄 分析节奏张力...")
    pacing_points = compute_pacing(segments, language)

    # 5. 文本质量
    print("🔄 分析文本质量...")
    text_quality = compute_all_metrics(segments, sentences, language)
    print(f"   TTR: {text_quality.ttr:.3f}, 评分: {text_quality.grade}")

    # 组装报告
    report = AnalysisReport(
        language=language,
        total_segments=len(segments),
        total_words=total_words,
        narrative_arc=narrative_arc,
        emotion_profiles=emotion_profiles,
        character_network=character_network,
        pacing_points=pacing_points,
        text_quality=text_quality,
    )

    # 6. 编剧建议
    print("🔄 生成编剧建议...")
    report.advice = generate_advice(report)
    print(f"   生成 {len(report.advice)} 条建议")

    return report


def render_html(report: AnalysisReport, output_path: str) -> None:
    """Jinja2 渲染 HTML 报告

    Args:
        report: 完整分析报告
        output_path: 输出 HTML 文件路径
    """
    from jinja2 import Environment, FileSystemLoader

    template_dir = Path(__file__).parent.parent / "templates"
    env = Environment(
        loader=FileSystemLoader(str(template_dir)),
        autoescape=True,
    )

    template = env.get_template("report.html.j2")

    # 准备模板数据
    tension = compute_tension_curve(report.pacing_points)
    report_data = _report_to_dict(report)

    # 情感标签页颜色
    emotion_colors = {
        "anger": "#e74c3c",
        "anticipation": "#f39c12",
        "disgust": "#9b59b6",
        "fear": "#2c3e50",
        "joy": "#27ae60",
        "sadness": "#3498db",
        "surprise": "#e67e22",
        "trust": "#1abc9c",
    }

    html_content = template.render(
        report=report,
        report_data=json.dumps(report_data, ensure_ascii=False),
        tension=tension,
        emotion_colors=emotion_colors,
        generated_at=datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC"),
    )

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(html_content)


if __name__ == "__main__":
    main()
