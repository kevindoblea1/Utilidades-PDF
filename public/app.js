// public/app.js
document.addEventListener('DOMContentLoaded', () => {
  // ---- Navegación de pestañas ----
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const tab = btn.dataset.tab;
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      document.getElementById(`panel-${tab}`)?.classList.add('active');
    });
  });

  // ---- Util: descargar Blob ----
  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  // =========================
  //  Compresión de PDF
  // =========================
  const fileInput = document.getElementById('file');
  const presetSel = document.getElementById('preset');
  const goBtn     = document.getElementById('go');
  const drop      = document.getElementById('drop');

  if (drop) {
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
    drop.addEventListener('drop', e => {
      e.preventDefault(); drop.classList.remove('drag');
      if (e.dataTransfer.files?.length) fileInput.files = e.dataTransfer.files;
    });
  }

  if (goBtn) {
    goBtn.addEventListener('click', async () => {
      const file = fileInput?.files?.[0];
      if (!file) return alert('Selecciona un PDF');

      const fd = new FormData();
      fd.append('file', file);

      try {
        const res = await fetch(`/api/compress?preset=${encodeURIComponent(presetSel.value)}`, {
          method: 'POST', body: fd
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return alert(`Error: ${err.error || res.statusText}\n${err.detail || ''}`);
        }
        const blob = await res.blob();
        downloadBlob(blob, file.name.replace(/\.pdf$/i, '') + '-compressed.pdf');
      } catch (e) {
        alert(`Fallo de red: ${e.message || e}`);
      }
    });
  }

  // =========================
  //  PDF → Word
  // =========================
  const fileInput2 = document.getElementById('file2');
  const goBtn2     = document.getElementById('go2');
  const ocrChk     = document.getElementById('ocr');
  const drop2      = document.getElementById('drop2');

  if (drop2) {
    drop2.addEventListener('dragover', e => { e.preventDefault(); drop2.classList.add('drag'); });
    drop2.addEventListener('dragleave', () => drop2.classList.remove('drag'));
    drop2.addEventListener('drop', e => {
      e.preventDefault(); drop2.classList.remove('drag');
      if (e.dataTransfer.files?.length) fileInput2.files = e.dataTransfer.files;
    });
  }

  if (goBtn2) {
    goBtn2.addEventListener('click', async () => {
      const file = fileInput2?.files?.[0];
      if (!file) return alert('Selecciona un PDF');

      const fd = new FormData();
      fd.append('file', file);

      try {
        const res = await fetch(`/api/pdf2word?ocr=${ocrChk?.checked ?? false}`, {
          method: 'POST', body: fd
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          return alert(`Error: ${err.error || res.statusText}\n${err.detail || ''}`);
        }
        const blob = await res.blob();
        downloadBlob(blob, file.name.replace(/\.pdf$/i, '') + '.docx');
      } catch (e) {
        alert(`Fallo de red: ${e.message || e}`);
      }
    });
  }

  // =========================
  //  Fusionar 2 PDFs
  // =========================
  const mergeForm = document.getElementById('mergeForm');
  const mergeMsg  = document.getElementById('mergeMsg');
  const drop3     = document.getElementById('drop3');
  const goMerge   = document.getElementById('goMerge');
  const f1 = mergeForm?.querySelector('input[name="file1"]');
  const f2 = mergeForm?.querySelector('input[name="file2"]');

  if (drop3 && f1 && f2) {
    drop3.addEventListener('dragover', e => { e.preventDefault(); drop3.classList.add('drag'); });
    drop3.addEventListener('dragleave', () => drop3.classList.remove('drag'));
    drop3.addEventListener('drop', e => {
      e.preventDefault(); drop3.classList.remove('drag');
      const files = e.dataTransfer.files;
      if (!files?.length) return;
      const pdfs = [...files].filter(f => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
      if (pdfs[0]) { const dt1 = new DataTransfer(); dt1.items.add(pdfs[0]); f1.files = dt1.files; }
      if (pdfs[1]) { const dt2 = new DataTransfer(); dt2.items.add(pdfs[1]); f2.files = dt2.files; }
    });
  }

  if (mergeForm && f1 && f2) {
    mergeForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      mergeMsg.textContent = 'Procesando...';
      mergeMsg.classList.remove('ok', 'err');
      if (goMerge) goMerge.disabled = true;

      try {
        if (!f1.files?.[0] || !f2.files?.[0]) throw new Error('Selecciona ambos archivos');

        const fd = new FormData();
        fd.append('file1', f1.files[0]);
        fd.append('file2', f2.files[0]);

        const res = await fetch('/api/merge-two', { method: 'POST', body: fd });
        if (!res.ok) {
          let msg = 'Error al fusionar';
          try { const j = await res.json(); msg = j.error || msg; }
          catch { const t = await res.text(); if (t && t.length < 200) msg = t; }
          throw new Error(msg);
        }

        const blob = await res.blob();
        const ts   = new Date().toISOString().replace(/[:.]/g, '-');
        downloadBlob(blob, `fusion_${ts}.pdf`);
        mergeMsg.textContent = 'Listo: archivo descargado.'; mergeMsg.classList.add('ok');
        setTimeout(() => { mergeMsg.textContent = ''; mergeMsg.classList.remove('ok'); }, 2300);
        mergeForm.reset();
      } catch (err) {
        mergeMsg.textContent = err.message || 'No se pudo fusionar los PDFs';
        mergeMsg.classList.remove('ok'); mergeMsg.classList.add('err');
      } finally {
        if (goMerge) goMerge.disabled = false;
      }
    });
  }

  // =========================
  //  Imagen → PDF
  // =========================
  const imgInput = document.getElementById('imgFile');
  const goImgPdf = document.getElementById('goImgPdf');

  if (goImgPdf) {
    goImgPdf.addEventListener('click', async () => {
      const f = imgInput?.files?.[0];
      if (!f) return alert('Selecciona una imagen JPG o PNG');
      const size   = document.getElementById('page').value;
      const margin = document.getElementById('margin').value || 10;

      const fd = new FormData();
      fd.append('file', f);

      try {
        const r = await fetch(`/api/img2pdf?size=${encodeURIComponent(size)}&margin=${encodeURIComponent(margin)}`, {
          method: 'POST', body: fd
        });
        if (!r.ok) {
          let msg = 'Error';
          try { const e = await r.json(); msg = `${e.error}${e.detail ? `: ${e.detail}` : ''}`; } catch {}
          return alert(msg);
        }
        const blob = await r.blob();
        downloadBlob(blob, f.name.replace(/\.(jpe?g|png)$/i, '') + '.pdf');
      } catch (e) {
        alert(`Fallo de red: ${e.message || e}`);
      }
    });
  }
});
