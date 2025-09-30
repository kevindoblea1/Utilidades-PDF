const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const { randomUUID } = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// Carpeta temporales
const UPLOAD_DIR = path.join(__dirname, 'tmp');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Multer compartido (PDF hasta 50MB)
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

// Archivos estáticos (UI)
app.use(express.static(path.join(__dirname, 'public')));

// Montar módulos (routers)
app.use('/api/compress',  require('./api/compress')({ upload, UPLOAD_DIR }));
app.use('/api/pdf2word',  require('./api/pdf2word')({ upload, UPLOAD_DIR }));
app.use('/api/merge-two', require('./api/merge-two')({ upload, UPLOAD_DIR })); // NUEVO

app.listen(PORT, '0.0.0.0', () =>
  console.log(`Utilidades PDF Inalma en http://localhost:${PORT}`)
);
