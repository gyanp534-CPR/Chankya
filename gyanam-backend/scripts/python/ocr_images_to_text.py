import re
from pathlib import Path

import pytesseract
from PIL import Image


def configure_tesseract() -> None:
    candidates = [
        Path(r"C:\Program Files\Tesseract-OCR\tesseract.exe"),
        Path(r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe"),
    ]
    for candidate in candidates:
        if candidate.exists():
            pytesseract.pytesseract.tesseract_cmd = str(candidate)
            return


def build_tesseract_config(oem: int = 1, psm: int = 6) -> str:
    return f"--oem {oem} --psm {psm}"


def should_use_image(file_path: Path) -> bool:
    return re.match(r"page-\d+\.clean\.png$", file_path.name) is not None


def extract_page_number(file_path: Path) -> int:
    match = re.search(r"page-(\d+)\.clean\.png", file_path.name)
    return int(match.group(1)) if match else 0


def ocr_images_to_text(image_dir: Path, output_path: Path, lang: str = "eng") -> None:
    configure_tesseract()
    config = build_tesseract_config()
    images = [item for item in image_dir.iterdir() if item.is_file() and should_use_image(item)]
    images.sort(key=extract_page_number)

    chunks: list[str] = []
    for image_path in images:
        try:
            image = Image.open(image_path)
        except Exception as exc:  # pylint: disable=broad-except
            chunks.append(f"-- OCR image {image_path.name} (failed to open: {exc}) --")
            continue
        text = pytesseract.image_to_string(image, lang=lang, config=config)
        chunks.append(f"-- OCR image {image_path.name} --")
        chunks.append(text.strip())
        chunks.append("")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(chunks).strip() + "\n", encoding="utf-8")


def main() -> None:
    root = Path(__file__).resolve().parents[2]
    image_dir = root / "data" / "pyq" / "papers" / "2017" / "gs1" / "raw" / "ocr-cleaned"
    output_path = root / "data" / "pyq" / "papers" / "2017" / "gs1" / "raw" / "question-paper.txt"

    if not image_dir.exists():
        raise FileNotFoundError(f"OCR cleaned directory not found: {image_dir}")

    ocr_images_to_text(image_dir=image_dir, output_path=output_path)
    print(f"Wrote OCR text to {output_path}")


if __name__ == "__main__":
    main()
