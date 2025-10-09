#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$(pwd)}"
TS="$(date +%Y%m%d-%H%M%S)"
BK="$ROOT/.backup_docx2excel_$TS"

say(){ echo -e "\n==> $*"; }

cd "$ROOT"
test -f "server.js" || { echo "No parece la raíz del proyecto (falta server.js)"; exit 1; }

say "Backup selectivo en $BK"
mkdir -p "$BK/api/features" "$BK/public" "$BK/api"
for f in \
  api/docx2excel.js \
  api/features/docx2excel.feature.js \
  api/feature-loader.js \
  public/app.js \
  public/index.html \
  public/js/features/docx2excel.js \
  public/app-docx2excel.js
do
  [ -f "$f" ] && install -D "$f" "$BK/$f"
done

say "Escribiendo api/docx2excel.js"
mkdir -p api
cat > api/docx2excel.js <<'JS'
// api/docx2excel.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

module.exports = ({ upload, UPLOAD_DIR }) => {
  const router = express.Router();

  router.post('/', upload.single('file'), (req, res) => {
    const inPath = req.file?.path;
    if (!inPath) return res.status(400).json({ error: 'Archivo .docx requerido (campo "file")' });

    const base = (req.file.originalname || 'archivo.docx')
      .replace(/\.[^.]+$/, '')
      .replace(/[^\w\-]+/g, '_');

    const outPath = path.join(UPLOAD_DIR, `${base}.xlsx`);

    const py = path.join(process.cwd(), 'venv', 'bin', 'python');
    const cli = path.join(process.cwd(), 'tools', 'docx2excel_cli.py');

    const child = spawn(py, [cli, inPath, '-o', outPath], { stdio: ['ignore', 'pipe', 'pipe'] });

    let stderr = '';
    child.stderr.on('data', d => (stderr += d.toString()));

    child.on('close', (code) => {
      fs.promises.unlink(inPath).catch(() => {});
      if (code !== 0 || !fs.existsSync(outPath)) {
        return res.status(500).json({ error: 'Falló la conversión DOCX→Excel', detail: stderr.trim() });
      }
      res.download(outPath, path.basename(outPath), (err) => {
        fs.promises.unlink(outPath).catch(() => {});
        if (err) console.error(err);
      });
    });
  });

  return router;
};
JS

say "Ajustando api/features/docx2excel.feature.js"
mkdir -p api/features
cat > api/features/docx2excel.feature.js <<'JS'
// api/features/docx2excel.feature.js
module.exports = ({ express, UPLOAD_DIR, getUploader, storage }) => {
  const router = require('../docx2excel')({
    upload: getUploader('docx', storage),
    UPLOAD_DIR
  });
  return { name: 'docx2excel', path: '/api/docx2excel', router };
};
JS

say "Limpiando referencias antiguas en public/index.html (app-docx2excel.js)"
if [ -f public/index.html ]; then
  sed -i.bak '/app-docx2excel\.js/d' public/index.html || true
fi
[ -f public/app-docx2excel.js ] && rm -f public/app-docx2excel.js || true

say "Inyectando bloque DOCX→EXCEL en public/app.js (solo si falta)"
touch public/app.js
grep -q 'DOCX → EXCEL' public/app.js 2>/dev/null || grep -q 'dx2xl-run' public/app.js 2>/dev/null || cat >> public/app.js <<'JS'

/* ===== DOCX → EXCEL ===== */
(() => {
  const file = document.getElementById('dx2xl-file');
  const run  = document.getElementById('dx2xl-run');
  const msg  = document.getElementById('dx2xl-msg');

  if (!file || !run) return;

  const setMsg = (t, ok = false) => {
    if (!msg) return;
    msg.textContent = t || '';
    msg.classList.remove('ok', 'err');
    if (t) msg.classList.add(ok ? 'ok' : 'err');
  };

  run.addEventListener('click', async () => {
    const f = file.files?.[0];
    if (!f) { alert('Selecciona un .docx con tablas'); return; }

    run.disabled = true;
    setMsg('Procesando...');

    try {
      const fd = new FormData();
      fd.append('file', f);

      const res = await fetch('/api/docx2excel', { method: 'POST', body: fd });
      if (!res.ok) {
        let detail = '';
        try { const e = await res.json(); detail = e.error + (e.detail ? `: ${e.detail}` : ''); } catch {}
        throw new Error(detail || res.statusText);
      }

      const blob = await res.blob();
      const name = f.name.replace(/\.docx$/i, '') + '.xlsx';
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = name; a.click();
      URL.revokeObjectURL(url);

      setMsg('Listo ✅', true);
      setTimeout(() => setMsg(''), 3000);
    } catch (e) {
      setMsg(`Error: ${e.message || e}`, false);
    } finally {
      run.disabled = false;
    }
  });
})();
JS

if [ -f public/js/features/docx2excel.js ]; then
  echo "Eliminando public/js/features/docx2excel.js (ya integrado en app.js)"
  rm -f public/js/features/docx2excel.js || true
  rmdir public/js/features 2>/dev/null || true
  rmdir public/js 2>/dev/null || true
fi

echo -e "\nOK. Backup en: $BK"
