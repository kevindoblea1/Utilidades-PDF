#!/usr/bin/env bash
set -euo pipefail
ROOT="${1:-$(pwd)}"
cd "$ROOT"
python3 -m venv venv 2>/dev/null || true
source venv/bin/activate
pip install --upgrade pip
pip install pandas python-docx openpyxl
echo "Deps de Python listas."
