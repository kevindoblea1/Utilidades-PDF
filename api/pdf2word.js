// api/pdf2word.js
const express = require('express');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { spawn } = require('child_process');

module.exports = ({ upload, UPLOAD_DIR }) => {
  const router = express.Router();

  const PYTHON = path.join(__dirname, '..', 'venv', 'bin', 'python');           // venv
  const SCRIPT = path.join(__dirname, '..', 'tools', 'pdf2docx_cli.py');       // CLI

  function encodeRFC5987(v) {
    return encodeURIComponent(v)
      .replace(/'/g, "%27")
      .replace(/\(/g, "%28")
      .replace(/\)/g, "%29")
      .replace(/\*/g, "%2A");
  }

  function runPython(inPdf, outDocx) {
    return new Promise((resolve, reject) => {
      const proc = spawn(PYTHON, [SCRIPT, inPdf, outDocx], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, LANG: 'C.UTF-8' }
      });

      let stderr = '';
      proc.stderr.on('data', (d) => (stderr += d.toString()));

      proc.on('error', reject);
      proc.on('close', (code) => {
        if (code === 0) return resolve();
        reject(new Error(`python exit ${code}: ${stderr.trim()}`));
      });
    });
  }

  async function safeUnlink(p) { try { await fsp.unlink(p); } catch { /* ignore */ } }

  router.post('/', upload.single('file'), async (req, res) => {
    if (!req.file) return res.status(400).send('Falta el archivo PDF');

    const inPdf = req.file.path; // absoluto en tmp
    const base = path.basename(inPdf).replace(/\.pdf$/i, '');
    const outDocx = path.join(UPLOAD_DIR, `${base}.docx`);

    try {
      // 1) Convertir
      await runPython(inPdf, outDocx);

      // 2) Validar que el .docx realmente existe y no está vacío
      const st = await fsp.stat(outDocx);
      if (!st.size || st.size < 1024) {
        throw new Error(`DOCX inválido (tamaño ${st.size} bytes)`);
      }

      // 3) Enviar como binario (stream)
      const downloadName = (req.file.originalname || 'archivo.pdf').replace(/\.pdf$/i, '') + '.docx';
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      // filename (compat) + filename* (UTF-8)
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${downloadName}"; filename*=UTF-8''${encodeRFC5987(downloadName)}`
      );
      res.setHeader('X-Docx-Bytes', String(st.size)); // útil para depurar en el navegador

      const stream = fs.createReadStream(outDocx);
      stream.on('close', async () => {
        await safeUnlink(inPdf);
        await safeUnlink(outDocx);
      });
      stream.pipe(res);
    } catch (err) {
      await safeUnlink(inPdf);
      await safeUnlink(outDocx);
      res.status(500).send(`Error convirtiendo: ${err.message}`);
    }
  });

  return router;
};
