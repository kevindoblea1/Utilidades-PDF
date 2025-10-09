#!/usr/bin/env bash
set -euo pipefail
DOCX_PATH="${1:-}"
PORT="${PORT:-3000}"
SERVICE="${SERVICE:-utilidades-pdf}"

echo "Reiniciando servicio $SERVICE…"
sudo systemctl restart "$SERVICE"
sleep 1
sudo systemctl status "$SERVICE" -n 20 --no-pager || true

if [ -n "$DOCX_PATH" ] && [ -f "$DOCX_PATH" ]; then
  echo -e "\nProbando /api/docx2excel con: $DOCX_PATH"
  curl -f -X POST -F "file=@${DOCX_PATH}" "http://localhost:${PORT}/api/docx2excel" -o /tmp/test_docx2excel.xlsx \
    && echo "OK → /tmp/test_docx2excel.xlsx" \
    || echo "Fallo en la API (revisa journalctl)."
else
  echo "Consejo: pasa un .docx para test: $0 /ruta/archivo.docx"
fi

echo -e "\nLogs recientes:"
sudo journalctl -u "$SERVICE" -n 50 --no-pager || true
