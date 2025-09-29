// api/pdf2word.js
const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

module.exports = ({ upload, UPLOAD_DIR }) => {
  const router = express.Router();

  // ---------- PDF -> DOCX con LibreOffice (headless) ----------
  function convertPdfToDocx(inputPath, outDir) {
    return new Promise((resolve, reject) => {
      const absInput = path.isAbsolute(inputPath) ? inputPath : path.resolve(inputPath);
      const absOutDir = path.isAbsolute(outDir) ? outDir : path.resolve(outDir);
      if (!fs.existsSync(absInput)) return reject(new Error(`Input no existe: ${absInput}`));
      fs.mkdirSync(absOutDir, { recursive: true });

      // Perfil temporal para LO
      const runId = Date.now().toString(36);
      const loProfileDir = path.join(absOutDir, `lo_profile_${runId}`);
      fs.mkdirSync(loProfileDir, { recursive: true });
      const loProfileURI = 'file://' + loProfileDir.replace(/ /g, '%20');

      const envHeadless = {
        ...process.env,
        DISPLAY: '',
        SAL_USE_VCLPLUGIN: 'headless'
      };

      const runSoffice = (useFilter) => new Promise((res, rej) => {
        const args = [
          '--headless',
          `-env:UserInstallation=${loProfileURI}`,
          '--norestore', '--nolockcheck', '--nodefault',
          '--convert-to', 'docx:MS Word 2007 XML',
          ...(useFilter ? ['--infilter=writer_pdf_import'] : []),
          '--outdir', absOutDir,
          absInput
        ];
        const p = spawn('soffice', args, { cwd: absOutDir, env: envHeadless });

        let stderr = '', stdout = '';
        p.stderr?.on('data', d => (stderr += d.toString()));
        p.stdout?.on('data', d => (stdout += d.toString()));
        p.on('close', () => {
          // valida por archivo, no por código
          const files = fs.readdirSync(absOutDir)
            .filter(f => f.toLowerCase().endsWith('.docx'))
            .map(f => ({ f, t: fs.statSync(path.join(absOutDir, f)).mtimeMs }))
            .sort((a, b) => b.t - a.t);
          const outPath = files.length ? path.join(absOutDir, files[0].f) : null;
          if (outPath && fs.existsSync(outPath)) return res(outPath);
          const err = new Error(`soffice no generó DOCX\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`);
          err.stdout = stdout; err.stderr = stderr;
          rej(err);
        });
      });

      const runUnoconv = () => new Promise((res, rej) => {
        const args = ['-f', 'docx', '-o', absOutDir, absInput];
        const p = spawn('unoconv', args, { cwd: absOutDir, env: envHeadless });

        let stderr = '', stdout = '';
        p.stderr?.on('data', d => (stderr += d.toString()));
        p.stdout?.on('data', d => (stdout += d.toString()));
        p.on('close', () => {
          const files = fs.readdirSync(absOutDir)
            .filter(f => f.toLowerCase().endsWith('.docx'))
            .map(f => ({ f, t: fs.statSync(path.join(absOutDir, f)).mtimeMs }))
            .sort((a, b) => b.t - a.t);
          const outPath = files.length ? path.join(absOutDir, files[0].f) : null;
          if (outPath && fs.existsSync(outPath)) return res(outPath);
          rej(new Error(`unoconv no generó DOCX\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`));
        });
      });

      (async () => {
        try { return resolve(await runSoffice(true)); }
        catch (e1) {
          try { return resolve(await runSoffice(false)); }
          catch (e2) {
            try { return resolve(await runUnoconv()); }
            catch (e3) {
              throw new Error(`No se generó el DOCX.\n1) ${e1.message}\n2) ${e2.message}\n3) ${e3.message}`);
            }
          }
        }
      })()
      .catch(reject)
      .finally(() => {
        fs.rm(loProfileDir, { recursive: true, force: true }, () => {});
      });
    });
  }

  // ---------- OCR para PDFs escaneados ----------
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

  // ---------- Endpoint (router POST) ----------
  router.post('/', upload.single('file'), async (req, res) => {
    const applyOcr = String(req.query.ocr || 'false') === 'true';
    if (!req.file) return res.status(400).json({ error: 'PDF requerido' });

    const input = req.file.path;
    const base = path.parse(req.file.filename).name;
    const ocrPath = path.join(UPLOAD_DIR, `${base}-ocr.pdf`);
    let workIn;  // nombre de trabajo simple

    try {
      const sourcePdf = applyOcr ? await ocrPdf(input, ocrPath) : input;

      // Copia a un nombre "limpio" sin espacios/acentos
      workIn = path.join(UPLOAD_DIR, `work_${Date.now()}.pdf`);
      fs.copyFileSync(sourcePdf, workIn);

      const docxPath = await convertPdfToDocx(workIn, UPLOAD_DIR);

      const downloadName = req.file.originalname.replace(/\.pdf$/i, '') + '.docx';
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${downloadName}"`);

      const stream = fs.createReadStream(docxPath);
      stream.on('close', () => {
        fs.rm(input, { force: true }, () => {});
        if (applyOcr) fs.rm(ocrPath, { force: true }, () => {});
        if (workIn) fs.rm(workIn, { force: true }, () => {});
        fs.rm(docxPath, { force: true }, () => {});
      });
      stream.pipe(res);
    } catch (err) {
      console.error('[PDF2WORD] Error:', err?.message);
      fs.rm(input, { force: true }, () => {});
      fs.rm(ocrPath, { force: true }, () => {});
      if (workIn) fs.rm(workIn, { force: true }, () => {});
      return res.status(500).json({
        error: 'Fallo al convertir a Word',
        detail: String(err?.message || err)
      });
    }
  });

  return router;
};
