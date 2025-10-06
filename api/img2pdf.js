// api/img2pdf.js
const express = require('express');
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

module.exports = ({ upload /* solo imágenes */, UPLOAD_DIR }) => {
  const router = express.Router();

  // util: mm -> puntos PDF
  const mm2pt = mm => (mm * 72) / 25.4;

  // tamaños en mm
  const PAGE_MM = {
    A4:     { w: 210,   h: 297 },
    LETTER: { w: 215.9, h: 279.4 }
  };

  // POST /api/img2pdf?size=A4&margin=10
  router.post('/', upload.single('file'), async (req, res) => {
    const tmp = req.file?.path;
    if (!tmp) return res.status(400).json({ error: 'Imagen requerida' });

    try {
      const size   = String(req.query.size || 'A4').toUpperCase();
      const margin = Math.max(0, Number(req.query.margin ?? 10)); // mm
      const page   = PAGE_MM[size] || PAGE_MM.A4;

      const pageW = mm2pt(page.w);
      const pageH = mm2pt(page.h);
      const marginPt = mm2pt(margin);

      const pdf = await PDFDocument.create();

      const buf = await fs.promises.readFile(tmp);
      const isJpg = /jpe?g$/i.test(req.file.originalname) || req.file.mimetype === 'image/jpeg';
      const isPng = /png$/i.test(req.file.originalname)   || req.file.mimetype === 'image/png';
      if (!isJpg && !isPng) {
        throw new Error('Formato no soportado. Usa JPG o PNG.');
      }

      const image = isJpg ? await pdf.embedJpg(buf) : await pdf.embedPng(buf);
      const imgW = image.width;
      const imgH = image.height;

      const contentW = pageW - 2 * marginPt;
      const contentH = pageH - 2 * marginPt;

      // escalar manteniendo proporción
      const scale = Math.min(contentW / imgW, contentH / imgH, 1);
      const drawW = imgW * scale;
      const drawH = imgH * scale;

      const page1 = pdf.addPage([pageW, pageH]);
      page1.drawImage(image, {
        x: (pageW - drawW) / 2,
        y: (pageH - drawH) / 2,
        width: drawW,
        height: drawH
      });

      const bytes = await pdf.save();
      const outName = req.file.originalname.replace(/\.(jpe?g|png)$/i, '') + '.pdf';

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${outName}"`);
      res.send(Buffer.from(bytes));
    } catch (e) {
      console.error('[IMG2PDF] Error:', e?.message || e);
      res.status(500).json({ error: 'No se pudo convertir la imagen a PDF', detail: String(e?.message || e) });
    } finally {
      // limpieza
      try { if (req.file?.path) fs.unlink(req.file.path, () => {}); } catch {}
    }
  });

  return router;
};
