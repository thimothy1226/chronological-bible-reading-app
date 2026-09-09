#!/usr/bin/env python3
"""Build the GF Homologia app PDF with app-routed links and no print page numbers."""

from __future__ import annotations

import argparse
from pathlib import Path

import fitz


APP_PAGE_URI = "gfbible://homologia/page/{page}"


def collect_links(document: fitz.Document) -> list[list[dict]]:
    links_by_page: list[list[dict]] = []
    for page in document:
        rebuilt = []
        for link in page.get_links():
            rect = fitz.Rect(link["from"])
            if link.get("uri"):
                rebuilt.append({"kind": fitz.LINK_URI, "from": rect, "uri": link["uri"]})
                continue
            destination = link.get("page")
            if isinstance(destination, str) and destination.isdigit():
                rebuilt.append({
                    "kind": fitz.LINK_URI,
                    "from": rect,
                    "uri": APP_PAGE_URI.format(page=int(destination)),
                })
            elif isinstance(destination, int) and destination >= 0:
                rebuilt.append({
                    "kind": fitz.LINK_URI,
                    "from": rect,
                    "uri": APP_PAGE_URI.format(page=destination + 1),
                })
        links_by_page.append(rebuilt)
    return links_by_page


def remove_print_page_numbers(document: fitz.Document) -> int:
    removed = 0
    for page_number, page in enumerate(document, start=1):
        redactions = 0
        words = [word for word in page.get_text("words") if word[1] <= 32]
        for index in range(len(words) - 2):
            left, number, right = words[index:index + 3]
            same_line = left[5:7] == number[5:7] == right[5:7]
            if same_line and left[4] == "-" and number[4] == str(page_number) and right[4] == "-":
                rect = fitz.Rect(left[:4]) | fitz.Rect(number[:4]) | fitz.Rect(right[:4])
                page.add_redact_annot(fitz.Rect(rect.x0 - 2, rect.y0 - 1, rect.x1 + 2, rect.y1 + 1), fill=(1, 1, 1))
                removed += 1
                redactions += 1
        if redactions:
            page.apply_redactions()
    return removed


def rebuild(source: Path, output: Path) -> tuple[int, int]:
    source_document = fitz.open(source)
    links_by_page = collect_links(source_document)

    output_document = fitz.open()
    output_document.insert_pdf(source_document)
    output_document.set_metadata({
        **source_document.metadata,
        "title": "GF호물로기아 7.5 - 앱용 PDF",
        "subject": "GF Bible 앱용 링크 재작성본",
    })

    for page in output_document:
        for link in page.get_links():
            page.delete_link(link)

    removed_numbers = remove_print_page_numbers(output_document)

    rebuilt_links = 0
    for page, links in zip(output_document, links_by_page):
        for link in links:
            page.insert_link(link)
            rebuilt_links += 1

    output.parent.mkdir(parents=True, exist_ok=True)
    output_document.save(output, garbage=4, deflate=True, clean=True)
    output_document.close()
    source_document.close()
    return removed_numbers, rebuilt_links


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    removed_numbers, rebuilt_links = rebuild(args.source, args.output)
    print(f"Removed {removed_numbers} print page numbers")
    print(f"Rebuilt {rebuilt_links} PDF links")


if __name__ == "__main__":
    main()
