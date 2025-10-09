// api/feature-loader.js
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const mime = require('mime-types');

function getUploader(kind, storage) {
  const base = { storage, limits: { fileSize: 50 * 1024 * 1024 } };

  if (kind === 'pdf') {
    return multer({
      ...base,
      fileFilter: (_r, f, cb) => {
        const t = f.mimetype || mime.lookup(f.originalname);
        cb(t === 'application/pdf' ? null : new Error('Solo se aceptan archivos PDF'),
           t === 'application/pdf');
      }
    });
  }

  if (kind === 'img') {
    return multer({
      ...base,
      limits: { fileSize: 30 * 1024 * 1024 },
      fileFilter: (_r, f, cb) => {
        const t = (f.mimetype || mime.lookup(f.originalname) || '') + '';
        const ok = /^image\/(jpeg|png)$/.test(t);
        cb(ok ? null : new Error('Solo se aceptan imágenes JPG o PNG'), ok);
      }
    });
  }

  if (kind === 'docx') {
    return multer({
      ...base,
      limits: { fileSize: 30 * 1024 * 1024 },
      fileFilter: (_r, f, cb) => {
        const t = (f.mimetype || mime.lookup(f.originalname) || '') + '';
        const ok = t === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
                   /\.docx$/i.test(f.originalname);
        cb(ok ? null : new Error('Solo se aceptan archivos .docx'), ok);
      }
    });
  }

  // sin archivos
  return (_req, _res, next) => next();
}

function isEnabled(name) {
  const key = `ENABLE_${name.replace(/[^A-Za-z0-9]/g, '_').toUpperCase()}`;
  if (process.env[key] != null) return /^(1|true|yes)$/i.test(process.env[key]);
  // por defecto: habilitado en dev, deshabilitado en prod
  return process.env.NODE_ENV !== 'production';
}

function loadFeatures(app, { UPLOAD_DIR, storage, rootDir = process.cwd() } = {}) {
  const dir = path.join(rootDir, 'api', 'features');
  if (!fs.existsSync(dir)) return;

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.feature.js'));
  for (const f of files) {
    const filePath = path.join(dir, f);
    try {
      const factory = require(filePath);
      const ctx = { express, UPLOAD_DIR, rootDir, getUploader, storage };
      const meta = factory(ctx);

      if (!meta || !meta.path || !meta.router) {
        console.warn(`[features] ${f} no exporta { path, router }`);
        continue;
      }

      const name = meta.name || f.replace(/\.feature\.js$/, '');
      if (!isEnabled(name)) {
        console.log(`[features] ${name} DESHABILITADO (flag/env)`);
        continue;
      }

      app.use(meta.path, meta.router);
      console.log(`[features] montado ${name} en ${meta.path}`);
    } catch (e) {
      console.error(`[features] fallo cargando ${f}:`, e.message);
    }
  }
}

module.exports = { loadFeatures, getUploader };
