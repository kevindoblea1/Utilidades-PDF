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
