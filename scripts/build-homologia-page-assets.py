#!/usr/bin/env python3
"""Render the rebuilt GF Homulogia PDF and export app-owned link hit areas."""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

import fitz


APP_PAGE_URI_PREFIX = "gfbible://homologia/page/"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--pages-dir", type=Path, default=Path("assets/homologia-pages"))
    parser.add_argument("--module", type=Path, default=Path("assets/homologia-pages.js"))
    parser.add_argument("--links", type=Path, default=Path("assets/homologia-links.json"))
    parser.add_argument("--scale", type=float, default=2.0)
    parser.add_argument("--quality", type=int, default=86)
    args = parser.parse_args()

    document = fitz.open(args.pdf)
    args.pages_dir.mkdir(parents=True, exist_ok=True)
    links_by_page: dict[str, list[dict]] = {}

    module_lines = ["const pages = ["]
    for page_number, page in enumerate(document, start=1):
        image_name = f"page-{page_number:03d}.jpg"
        pixmap = page.get_pixmap(matrix=fitz.Matrix(args.scale, args.scale), alpha=False)
        image_path = args.pages_dir / image_name
        temporary_path = image_path.with_suffix(".jpg.tmp")
        temporary_path.write_bytes(pixmap.tobytes("jpeg", jpg_quality=args.quality))
        os.replace(temporary_path, image_path)
        module_lines.append(f"  require('./homologia-pages/{image_name}'),")

        page_links = []
        for link in page.get_links():
            uri = str(link.get("uri") or "")
            rect = fitz.Rect(link["from"])
            action = None
            if uri.startswith(APP_PAGE_URI_PREFIX):
                target_text = uri.removeprefix(APP_PAGE_URI_PREFIX)
                if target_text.isdigit():
                    action = {"type": "page", "target": int(target_text)}
            elif uri:
                action = {"type": "url", "target": uri}
            if not action:
                continue
            page_links.append({
                **action,
                "x": round(rect.x0 / page.rect.width, 6),
                "y": round(rect.y0 / page.rect.height, 6),
                "width": round(rect.width / page.rect.width, 6),
                "height": round(rect.height / page.rect.height, 6),
            })
        if page_links:
            links_by_page[str(page_number)] = page_links

    module_lines.extend(["];", "", "export default pages;", ""])
    args.module.write_text("\n".join(module_lines), encoding="utf-8")
    args.links.write_text(json.dumps(links_by_page, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    document.close()


if __name__ == "__main__":
    main()
