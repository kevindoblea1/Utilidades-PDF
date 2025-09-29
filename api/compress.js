const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

module.exports = ({ upload, UPLOAD_DIR }) => {
  const router = express.Router();

  function compressWithGS(inputPath, outputPath, preset = '/ebook') {
    return new Promise((resolve, reject) => {
      const args = [
        '-sDEVICE=pdfwrite',
        '-dCompatibilityLevel=1.4',
        `-dPDFSETTINGS=${preset}`, // /screen, /ebook, /printer
        '-dNOPAUSE', '-dQUIET', '-dBATCH',
        `-sOutputFile=${outputPath}`,
        inputPath
      ];
      const gs = spawn('gs', args);
      let stderr = '';
      gs.stderr?.on('data', d => (stderr += d.toString()));
      gs.on('close', code => {
        if (code === 0 && fs.existsSync(outputPath)) resolve();
        else reject(new Error(stderr || `Ghostscript code ${code}`));
      });
    });
  }

  // POST /api/compress?preset=/ebook
  router.post('/', upload.single('file'), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'PDF requerido' });

      const preset = ['/screen','/ebook','/printer'].includes(req.query.preset)
        ? req.query.preset
        : '/ebook';

      const input = req.file.path;
      const outName = `${path.parse(req.file.filename).name}-compressed.pdf`;
      const output = path.join(UPLOAD_DIR, outName);

      await compressWithGS(input, output, preset);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${outName}"`);

      const stream = fs.createReadStream(output);
      stream.on('close', () => {
        fs.rm(input, { force: true }, () => {});
        fs.rm(output, { force: true }, () => {});
      });
      stream.pipe(res);
    } catch (err) {
      if (req.file?.path) fs.rm(req.file.path, { force: true }, () => {});
      return res.status(500).json({ error: 'Fallo al comprimir', detail: String(err.message || err) });
    }
  });

  return router;
};
