from __future__ import annotations

import argparse
from pathlib import Path

import fitz
import pytesseract
from PIL import Image, ImageFilter, ImageOps

DEFAULT_TESSERACT_PATHS = [
    Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe"),
    Path(r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe"),
]


def configure_tesseract() -> None:
    current = pytesseract.pytesseract.tesseract_cmd
    if current and Path(str(current)).exists():
        return

    for candidate in DEFAULT_TESSERACT_PATHS:
        if candidate.exists():
            pytesseract.pytesseract.tesseract_cmd = str(candidate)
            return


def preprocess_image(image: Image.Image) -> Image.Image:
    gray = ImageOps.grayscale(image)
    enhanced = ImageOps.autocontrast(gray)
    enhanced = enhanced.filter(ImageFilter.MedianFilter(size=3))
    enhanced = enhanced.filter(ImageFilter.SHARPEN)
    return enhanced


def render_page(page: fitz.Page, dpi: int) -> Image.Image:
    pix = page.get_pixmap(dpi=dpi)
    return Image.frombytes("RGB", [pix.width, pix.height], pix.samples)


def split_columns(image: Image.Image, gutter_ratio: float) -> tuple[Image.Image, Image.Image]:
    width, height = image.size
    gutter = max(10, int(width * gutter_ratio))
    mid = width // 2
    left_box = (0, 0, max(1, mid - gutter), height)
    right_box = (min(width - 1, mid + gutter), 0, width, height)
    return image.crop(left_box), image.crop(right_box)


def split_rows(image: Image.Image, gutter_ratio: float) -> tuple[Image.Image, Image.Image]:
    width, height = image.size
    gutter = max(10, int(height * gutter_ratio))
    mid = height // 2
    top_box = (0, 0, width, max(1, mid - gutter))
    bottom_box = (0, min(height - 1, mid + gutter), width, height)
    return image.crop(top_box), image.crop(bottom_box)


def build_tesseract_config(oem: int, psm: int) -> str:
    return f"--oem {oem} --psm {psm}"


INSTRUCTION_KEYWORDS = [
    "do not open this test booklet",
    "immediately after the commencement",
    "maximum marks",
    "time allowed",
    "test booklet contains 100 items",
    "each item comprises four responses",
    "roll number",
    "answer sheet",
    "penalty for wrong answers",
    "objective type question papers",
    "you have to mark all your responses",
    "test booklet series",
    "instructions",
]


def looks_like_instruction_page(text: str) -> bool:
    lower = text.lower()
    hits = sum(1 for kw in INSTRUCTION_KEYWORDS if kw in lower)
    return hits >= 3


def ocr_pdf_to_text(
    pdf_path: Path,
    out_path: Path,
    dpi: int,
    lang: str,
    split: bool,
    gutter_ratio: float,
    oem: int,
    psm: int,
) -> None:
    configure_tesseract()
    doc = fitz.open(pdf_path)
    parts: list[str] = []
    config = build_tesseract_config(oem, psm)

    for index, page in enumerate(doc, start=1):
        image = render_page(page, dpi=dpi)
        processed = preprocess_image(image)
        if split:
            left, right = split_columns(processed, gutter_ratio)
            top, bottom = split_rows(processed, gutter_ratio)
            left_text = pytesseract.image_to_string(left, lang=lang, config=config)
            right_text = pytesseract.image_to_string(right, lang=lang, config=config)
            top_text = pytesseract.image_to_string(top, lang=lang, config=config)
            bottom_text = pytesseract.image_to_string(bottom, lang=lang, config=config)
            if looks_like_instruction_page(left_text + right_text):
                parts.append(f"\n-- OCR page-{index}.png instruction --\n{left_text}\n{right_text}")
            else:
                parts.append(f"\n-- OCR page-{index}.png left --\n{left_text}")
                parts.append(f"\n-- OCR page-{index}.png right --\n{right_text}")
                parts.append(f"\n-- OCR page-{index}.png top --\n{top_text}")
                parts.append(f"\n-- OCR page-{index}.png bottom --\n{bottom_text}")
        else:
            text = pytesseract.image_to_string(processed, lang=lang, config=config)
            if looks_like_instruction_page(text):
                parts.append(f"\n-- OCR page-{index}.png instruction --\n{text}")
            else:
                parts.append(f"\n-- OCR page-{index}.png --\n{text}")

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(parts), encoding="utf-8")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="OCR a PDF into a text file for TS normalization.")
    parser.add_argument("--pdf", required=True, help="Input PDF path.")
    parser.add_argument("--out", required=True, help="Output text path.")
    parser.add_argument("--dpi", type=int, default=300, help="Render DPI.")
    parser.add_argument("--lang", default="eng+hin", help="Tesseract language packs (default: eng+hin).")
    parser.add_argument("--no-split", action="store_true", help="Disable left/right column split.")
    parser.add_argument("--gutter", type=float, default=0.01, help="Column gutter ratio (default: 0.01).")
    parser.add_argument("--oem", type=int, default=1, help="Tesseract OCR engine mode (default: 1).")
    parser.add_argument("--psm", type=int, default=6, help="Tesseract page segmentation mode (default: 6).")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    pdf_path = Path(args.pdf).expanduser().resolve()
    out_path = Path(args.out).expanduser().resolve()

    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    ocr_pdf_to_text(
        pdf_path,
        out_path,
        args.dpi,
        args.lang,
        split=not args.no_split,
        gutter_ratio=args.gutter,
        oem=args.oem,
        psm=args.psm,
    )
    print(f"Saved OCR text: {out_path}")


if __name__ == "__main__":
    main()
