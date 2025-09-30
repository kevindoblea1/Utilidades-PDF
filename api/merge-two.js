// api/merge-two.js
module.exports = ({ upload /*, UPLOAD_DIR */ }) => {
  const express = require('express');
  const fs = require('fs');
  const { PDFDocument } = require('pdf-lib');

  const router = express.Router();

  // Acepta POST a / (porque el router se monta en /api/merge-two)
  // y además /merge-two por si en algún momento lo montas en /api.
  router.post(['/', '/merge-two'],
    upload.fields([{ name: 'file1', maxCount: 1 }, { name: 'file2', maxCount: 1 }]),
    async (req, res) => {
      const f1 = req.files?.file1?.[0];
      const f2 = req.files?.file2?.[0];
      if (!f1 || !f2) return res.status(400).json({ error: 'Faltan file1 o file2' });

      try {
        const out = await PDFDocument.create();

        // Orden: archivo1 -> archivo2
        for (const f of [f1, f2]) {
          const buf = await fs.promises.readFile(f.path);
          const src = await PDFDocument.load(buf);
          const pages = await out.copyPages(src, src.getPageIndices());
          pages.forEach(p => out.addPage(p));
        }

        const bytes = await out.save();
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const nombre = `fusion_${ts}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${nombre}"`);
        res.send(Buffer.from(bytes));
      } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'No se pudo fusionar los PDFs' });
      } finally {
        // Limpieza de temporales
        try { if (f1?.path) fs.unlink(f1.path, () => {}); } catch {}
        try { if (f2?.path) fs.unlink(f2.path, () => {}); } catch {}
      }
    }
  );

  return router;
};
