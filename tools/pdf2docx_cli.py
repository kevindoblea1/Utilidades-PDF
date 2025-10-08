#!/usr/bin/env python3
import os, sys, tempfile, re
import fitz  # PyMuPDF
from pdf2docx import Converter

def _has_real_text(doc, min_chars=50):
    """Devuelve True si hay texto unicode real en el PDF."""
    chars = 0
    for page in doc:
        txt = page.get_text("text") or ""
        chars += sum(ch.isalnum() for ch in txt)
        if chars >= min_chars:
            return True
    return False

def _ocr_pdf(in_pdf, lang="spa+eng", dpi=300):
    """Aplica OCR página a página y devuelve ruta a un PDF temporal OCRizado."""
    import pymupdf_ocr  # plugin oficial de PyMuPDF
    with fitz.open(in_pdf) as doc:
        # escribe el texto reconocido como capa "invisible" encima de la imagen
        pymupdf_ocr.ocr(doc, language=lang, dpi=dpi, fullpage=True)
        tmp_out = tempfile.mktemp(suffix=".pdf")
        doc.save(tmp_out)
        return tmp_out

def main():
    if len(sys.argv) < 3:
        print("Uso: pdf2docx_cli.py <input.pdf> <output.docx>", file=sys.stderr)
        sys.exit(2)

    in_pdf = sys.argv[1]
    out_docx = sys.argv[2]

    if not os.path.exists(in_pdf):
        raise FileNotFoundError(f"No existe: {in_pdf}")

    src_pdf = in_pdf
    with fitz.open(in_pdf) as d:
        needs_ocr = not _has_real_text(d)

    if needs_ocr:
        # OCR de respaldo para PDFs “sin texto” (como tu factura)
        src_pdf = _ocr_pdf(in_pdf, lang="spa+eng", dpi=300)

    cv = Converter(src_pdf)
    cv.convert(out_docx)
    cv.close()
    print("OK")

if __name__ == "__main__":
    main()
