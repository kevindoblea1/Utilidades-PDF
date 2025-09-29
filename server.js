const express = require('express');
const multer = require('multer');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const { randomUUID } = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, 'tmp');

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) =>
    cb(null, `${randomUUID()}-${file.originalname.replace(/\s+/g, "_")}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const type = file.mimetype || mime.lookup(file.originalname);
    if (type === 'application/pdf') cb(null, true);
    else cb(new Error('Solo se aceptan archivos PDF'));
  }
});

app.use(express.static(path.join(__dirname, 'public')));

function compressWithGS(inputPath, outputPath, preset = '/ebook') {
  return new Promise((resolve, reject) => {
    const args = [
      '-sDEVICE=pdfwrite',
      '-dCompatibilityLevel=1.4',
      `-dPDFSETTINGS=${preset}`,
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

app.post('/api/compress', upload.single('file'), async (req, res) => {
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

app.listen(PORT, '0.0.0.0', () =>
  console.log(`Utilidades PDF Inalma en http://localhost:${PORT}`)
);
