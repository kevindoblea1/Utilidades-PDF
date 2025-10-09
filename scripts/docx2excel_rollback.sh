#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-$(pwd)}"
cd "$ROOT"
BK="$(ls -d .backup_docx2excel_* 2>/dev/null | sort | tail -n1 || true)"
[ -z "$BK" ] && { echo "No hay backups .backup_docx2excel_*"; exit 1; }
echo "Restaurando desde $BK"
rsync -a "$BK/" "./"
echo "Restaurado."
