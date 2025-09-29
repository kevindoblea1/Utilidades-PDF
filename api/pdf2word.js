// api/pdf2word.js
const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

module.exports = ({ upload, UPLOAD_DIR }) => {
  const router = express.Router();

  // ---- Conversión PDF -> DOCX usando LibreOffice en modo headless ----
  function convertPdfToDocx(inputPath, outDir) {
    return new Promise((resolve, reject) => {
      // Perfil temporal por ejecución (evita bloqueos de LO)
      const runId = Date.now().toString(36);
      const loProfileDir = path.join(outDir, `lo_profile_${runId}`);
      fs.mkdirSync(loProfileDir, { recursive: true });
      const loProfileURI = 'file://' + loProfileDir.replace(/ /g, '%20');

      // Rutas ABSOLUTAS
      const absInput = path.isAbsolute(inputPath) ? inputPath : path.resolve(inputPath);
      const absOutDir = path.isAbsolute(outDir) ? outDir : path.resolve(outDir);

      const args = [
        '--headless',
        `-env:UserInstallation=${loProfileURI}`,
        '--norestore', '--nolockcheck', '--nodefault',
        '--convert-to', 'docx:MS Word 2007 XML',
        '--infilter=writer_pdf_import',
        '--outdir', absOutDir,
        absInput
      ];

      const p = spawn('soffice', args, {
        cwd: absOutDir,
        env: {
          ...process.env,
          DISPLAY: '',                 // evita intentar abrir X11
          SAL_USE_VCLPLUGIN: 'headless'
        }
      });

      let stderr = '', stdout = '';
      p.stderr?.on('data', d => (stderr += d.toString()));
      p.stdout?.on('data', d => (stdout += d.toString()));

      p.on('close', code => {
        try {
          // Localiza el DOCX más reciente en la carpeta de salida
          const files = fs.readdirSync(absOutDir)
            .filter(f => f.toLowerCase().endsWith('.docx'))
            .map(f => ({ f, t: fs.statSync(path.join(absOutDir, f)).mtimeMs }))
            .sort((a, b) => b.t - a.t);

          const outPath = files.length ? path.join(absOutDir, files[0].f) : null;

          if (code !== 0) {
            throw new Error(`LibreOffice code ${code}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`);
          }
          if (!outPath || !fs.existsSync(outPath)) {
            throw new Error(`No se generó el DOCX\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`);
          }
          resolve(outPath);
        } catch (e) {
          reject(e);
        } finally {
          fs.rm(loProfileDir, { recursive: true, force: true }, () => {});
        }
      });
    });
  }

  // ---- OCR (opcional) para PDFs escaneados ----
  function ocrPdf(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
      const args = [
        '--language', 'spa+eng',
        '--output-type', 'pdf',
        '--skip-text',
        inputPath, outputPath
      ];
      const p = spawn('ocrmypdf', args);
      let stderr = '', stdout = '';
      p.stderr?.on('data', d => (stderr += d.toString()));
      p.stdout?.on('data', d => (stdout += d.toString()));
      p.on('close', code => {
        if (code !== 0) {
          return reject(new Error(`ocrmypdf code ${code}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`));
        }
        if (!fs.existsSync(outputPath)) {
          return reject(new Error(`No se generó el PDF OCR\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`));
        }
        resolve(outputPath);
      });
    });
  }

  // ---- Endpoint: POST /api/pdf2word?ocr=true|false ----
  router.post('/', upload.single('file'), async (req, res) => {
    const applyOcr = String(req.query.ocr || 'false') === 'true';
    if (!req.file) return res.status(400).json({ error: 'PDF requerido' });

    const input = req.file.path;
    const base = path.parse(req.file.filename).name;
    const ocrPath = path.join(UPLOAD_DIR, `${base}-ocr.pdf`);

    try {
      const sourcePdf = applyOcr ? await ocrPdf(input, ocrPath) : input;
      const docxPath = await convertPdfToDocx(sourcePdf, UPLOAD_DIR);

      const downloadName = req.file.originalname.replace(/\.pdf$/i, '') + '.docx';
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);

      const stream = fs.createReadStream(docxPath);
      stream.on('close', () => {
        fs.rm(input, { force: true }, () => {});
        if (applyOcr) fs.rm(ocrPath, { force: true }, () => {});
        fs.rm(docxPath, { force: true }, () => {});
      });
      stream.pipe(res);
    } catch (err) {
      console.error('[PDF2WORD] Error:', err?.message);
      fs.rm(input, { force: true }, () => {});
      fs.rm(ocrPath, { force: true }, () => {});
      return res.status(500).json({
        error: 'Fallo al convertir a Word',
        detail: String(err?.message || err)
      });
    }
  });

  return router;
};
