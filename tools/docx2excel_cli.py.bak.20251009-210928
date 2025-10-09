#!/usr/bin/env python3
from __future__ import annotations
import argparse, re
from pathlib import Path
from typing import List, Tuple
import pandas as pd
from docx import Document

def _clean(s:str)->str: return re.sub(r"\s+"," ",(s or "").strip())

def extract_tables(docx_path:Path)->Tuple[List[pd.DataFrame], List[str]]:
    doc = Document(str(docx_path))
    dfs, names = [], []

    # Si no hay tablas, volcamos párrafos como texto plano
    if not doc.tables:
        lines = [_clean(p.text) for p in doc.paragraphs if _clean(p.text)]
        if lines:
            return [pd.DataFrame({"Texto": lines})], ["ContenidoPlano"]
        return [pd.DataFrame({"Mensaje": ["El documento no contiene tablas ni texto."]})], ["Vacio"]

    for i, t in enumerate(doc.tables, 1):
        rows = [[ _clean(c.text) for c in r.cells ] for r in t.rows]
        if not rows: 
            continue

        headers = rows[0] if rows else []
        headers = [h if h else f"Col{j+1}" for j, h in enumerate(headers)]

        # Deduplicar nombres de columna
        seen = {}
        dedup = []
        for h in headers:
            if h in seen:
                seen[h] += 1
                dedup.append(f"{h}_{seen[h]}")
            else:
                seen[h] = 1
                dedup.append(h)

        body = rows[1:]
        maxlen = max([len(dedup)] + [len(r) for r in body] or [len(dedup)])
        if len(dedup) < maxlen:
            dedup += [f"Col{j+1}" for j in range(len(dedup), maxlen)]
        body = [ r + [""]*(maxlen - len(r)) for r in body ]

        dfs.append(pd.DataFrame(body, columns=dedup))
        names.append(f"Tabla{i}")

    return dfs, names

def write_xlsx(dfs:List[pd.DataFrame], names:List[str], out_path:Path, include_combined=True):
    out_path = out_path.with_suffix(".xlsx")
    out_path.parent.mkdir(parents=True, exist_ok=True)

    combined = None
    if include_combined and len(dfs) > 1:
        try:
            combined = pd.concat(dfs, ignore_index=True, sort=False)
        except Exception:
            combined = None

    with pd.ExcelWriter(out_path, engine="xlsxwriter") as w:
        for df, name in zip(dfs, names):
            df.to_excel(w, index=False, sheet_name=(name or "Hoja")[:31])
        if combined is not None and not combined.empty:
            combined.to_excel(w, index=False, sheet_name="Combinado")

    print(str(out_path))

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("input", type=Path)
    ap.add_argument("-o", "--output", type=Path, default=None)
    ap.add_argument("--no-combined", action="store_true")
    args = ap.parse_args()

    if not args.input.exists():
        raise SystemExit(f"❌ No existe: {args.input}")

    dfs, names = extract_tables(args.input)
    write_xlsx(dfs, names, args.output or args.input.with_suffix(".xlsx"), include_combined=not args.no_combined)
