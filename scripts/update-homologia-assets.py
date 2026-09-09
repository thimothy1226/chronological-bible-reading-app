#!/usr/bin/env python3
"""Update GF Homologia text pages and embed one link-preserving full PDF."""

from __future__ import annotations

import argparse
import base64
import json
import re
from collections import Counter
from pathlib import Path

import pdfplumber


def rgb_to_hex(value) -> str:
    if value is None:
        return "#000000"
    if isinstance(value, (int, float)):
        channels = [float(value)] * 3
    else:
        channels = list(value)
        if len(channels) == 1:
            channels *= 3
        elif len(channels) == 4:
            c, m, y, k = channels
            channels = [(1 - c) * (1 - k), (1 - m) * (1 - k), (1 - y) * (1 - k)]
    channels = [max(0, min(255, round(float(channel) * 255))) for channel in channels[:3]]
    return "#" + "".join(f"{channel:02X}" for channel in channels)


def char_style(char: dict) -> tuple:
    font = str(char.get("fontname") or "")
    return (
        rgb_to_hex(char.get("non_stroking_color")),
        round(float(char.get("size") or 28), 2),
        False,
        "italic" in font.lower() or "oblique" in font.lower(),
    )


def styled_line_spans(line: dict) -> list[dict]:
    text = line["text"]
    chars = [char for char in line.get("chars", []) if str(char.get("text", "")).strip()]
    fallback = char_style(chars[0]) if chars else ("#000000", 28.0, False, False)
    cursor = 0
    styled_chars = []
    last_style = fallback

    for character in text:
        if character.isspace():
            styled_chars.append((character, last_style))
            continue
        if cursor < len(chars):
            last_style = char_style(chars[cursor])
            cursor += 1
        styled_chars.append((character, last_style))

    spans = []
    for character, style in styled_chars:
        if spans and spans[-1]["_style"] == style:
            spans[-1]["text"] += character
        else:
            color, size, bold, italic = style
            spans.append({
                "text": character,
                "color": color,
                "size": size,
                "bold": bold,
                "italic": italic,
                "_style": style,
            })
    for span in spans:
        span.pop("_style", None)
    return spans


def dominant_line_style(line: dict) -> tuple:
    styles = [char_style(char) for char in line.get("chars", []) if str(char.get("text", "")).strip()]
    return Counter(styles).most_common(1)[0][0] if styles else ("#000000", 28.0, False, False)


def extract_page_blocks(page) -> list[dict]:
    lines = page.extract_text_lines(layout=False, strip=True, return_chars=True)
    lines = [
        line for line in lines
        if not (float(line.get("top", 0)) < 30 and re.fullmatch(r"-\s*\d+\s*-", line["text"].strip()))
        and "책 처음으로 이동" not in line["text"]
        and "첫페이지로 이동" not in line["text"]
    ]

    blocks = []
    previous_line = None
    for line in lines:
        color, size, _, _ = dominant_line_style(line)
        new_block = previous_line is None
        if previous_line is not None:
            previous_color, previous_size, _, _ = dominant_line_style(previous_line)
            top_gap = float(line["top"]) - float(previous_line["top"])
            style_changed = abs(size - previous_size) > 1.5 or color != previous_color
            new_block = top_gap > 48 or (style_changed and top_gap > 32)

        if new_block:
            if previous_line is None:
                gap = 2
            else:
                top_gap = float(line["top"]) - float(previous_line["top"])
                gap = 24 if top_gap > 48 else 16
            blocks.append({
                "align": "left",
                "background": None,
                "baseSize": size,
                "indent": 0,
                "spans": [],
                "gap": gap,
            })
        elif blocks[-1]["spans"]:
            prior = blocks[-1]["spans"][-1]
            blocks[-1]["spans"].append({
                "text": "\n",
                "color": prior["color"],
                "size": prior["size"],
                "bold": prior["bold"],
                "italic": prior["italic"],
            })

        blocks[-1]["spans"].extend(styled_line_spans(line))
        previous_line = line

    return blocks


def write_pdf_module(pdf_path: Path, output_path: Path) -> None:
    encoded = base64.b64encode(pdf_path.read_bytes()).decode("ascii")
    chunk_size = 60_000
    chunks = [encoded[index:index + chunk_size] for index in range(0, len(encoded), chunk_size)]
    lines = ["const chunks = ["]
    lines.extend(f"  '{chunk}'," for chunk in chunks)
    lines.extend(["];", "", "export default chunks.join('');", ""])
    output_path.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--data", type=Path, default=Path("assets/homologia.json"))
    parser.add_argument("--pdf-module", type=Path, default=Path("assets/homologia-pdf.js"))
    parser.add_argument("--version", required=True)
    parser.add_argument("--changed-pages", required=True, help="Comma-separated PDF page numbers")
    args = parser.parse_args()

    changed_pages = {int(value) for value in args.changed_pages.split(",") if value.strip()}
    data = json.loads(args.data.read_text(encoding="utf-8"))
    pages_by_number = {int(page["page"]): page for page in data["pages"]}

    with pdfplumber.open(args.pdf) as pdf:
        if len(pdf.pages) != int(data["totalPages"]):
            raise ValueError(f"Expected {data['totalPages']} PDF pages, found {len(pdf.pages)}")
        for page_number in sorted(changed_pages):
            pages_by_number[page_number] = {
                "page": page_number,
                "blocks": extract_page_blocks(pdf.pages[page_number - 1]),
            }

    data["title"] = f"GF호물로기아 {args.version}"
    data["pages"] = [pages_by_number[number] for number in sorted(pages_by_number)]
    args.data.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    write_pdf_module(args.pdf, args.pdf_module)


if __name__ == "__main__":
    main()
