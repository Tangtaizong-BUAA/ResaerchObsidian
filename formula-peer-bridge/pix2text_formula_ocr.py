#!/usr/bin/env python3
import sys
from contextlib import redirect_stdout
from pathlib import Path


def clean_latex(text: str) -> str:
    text = (text or "").strip()
    for prefix, suffix in (("$$", "$$"), ("\\[", "\\]"), ("\\(", "\\)"), ("$", "$")):
        if text.startswith(prefix) and text.endswith(suffix):
            text = text[len(prefix) : len(text) - len(suffix)].strip()
    return text


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: pix2text_formula_ocr.py image_path", file=sys.stderr)
        return 2

    image_path = Path(sys.argv[1])
    if not image_path.exists():
        print(f"image not found: {image_path}", file=sys.stderr)
        return 2

    try:
        with redirect_stdout(sys.stderr):
            from pix2text import Pix2Text, merge_line_texts
    except Exception as exc:
        print(
            "Pix2Text is not installed for this Python. Install it on the Mac with: "
            "python3 -m pip install pix2text",
            file=sys.stderr,
        )
        print(str(exc), file=sys.stderr)
        return 3

    try:
        with redirect_stdout(sys.stderr):
            p2t = Pix2Text()

        with redirect_stdout(sys.stderr):
            latex = p2t.recognize_formula(str(image_path), batch_size=1)
        if isinstance(latex, list):
            latex = "\n\n".join(clean_latex(item) for item in latex if clean_latex(item))
        else:
            latex = clean_latex(str(latex))

        if not latex:
            with redirect_stdout(sys.stderr):
                outs = p2t.recognize(str(image_path), resized_shape=768)
            latex = clean_latex(merge_line_texts(outs, auto_line_break=True))

        if not latex:
            print("Pix2Text returned an empty result", file=sys.stderr)
            return 4

        print(latex)
        return 0
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 5


if __name__ == "__main__":
    raise SystemExit(main())
