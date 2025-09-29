document.addEventListener('DOMContentLoaded', () => {
  // Tabs
  const tabButtons = document.querySelectorAll('.tab-btn');
  const panels = {
    compress: document.getElementById('panel-compress'),
    convert: document.getElementById('panel-convert'),
  };

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      Object.values(panels).forEach(p => p.classList.remove('active'));
      const key = btn.dataset.tab;
      panels[key]?.classList.add('active');
    });
  });

  // ----- Compresión -----
  const fileInput = document.getElementById('file');
  const presetSel = document.getElementById('preset');
  const goBtn = document.getElementById('go');
  const drop = document.getElementById('drop');

  if (drop) {
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
    drop.addEventListener('drop', e => {
      e.preventDefault(); drop.classList.remove('drag');
      if (e.dataTransfer.files?.length) fileInput.files = e.dataTransfer.files;
    });
  }

  if (goBtn) {
    goBtn.onclick = async () => {
      const file = fileInput.files?.[0];
      if (!file) { alert('Selecciona un PDF'); return; }
      const preset = presetSel.value;

      const form = new FormData();
      form.append('file', file);

      const res = await fetch(`/api/compress?preset=${encodeURIComponent(preset)}`, {
        method: 'POST',
        body: form
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Error: ${err.error || res.statusText}\n${err.detail || ''}`);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name.replace(/\.pdf$/i, '') + '-compressed.pdf';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    };
  }

  // ----- PDF → Word -----
  const fileInput2 = document.getElementById('file2');
  const goBtn2 = document.getElementById('go2');
  const ocrChk = document.getElementById('ocr');
  const drop2 = document.getElementById('drop2');

  if (drop2) {
    drop2.addEventListener('dragover', e => { e.preventDefault(); drop2.classList.add('drag'); });
    drop2.addEventListener('dragleave', () => drop2.classList.remove('drag'));
    drop2.addEventListener('drop', e => {
      e.preventDefault(); drop2.classList.remove('drag');
      if (e.dataTransfer.files?.length) fileInput2.files = e.dataTransfer.files;
    });
  }

  if (goBtn2) {
    goBtn2.onclick = async () => {
      const file = fileInput2.files?.[0];
      if (!file) { alert('Selecciona un PDF'); return; }

      const form = new FormData();
      form.append('file', file);

      const res = await fetch(`/api/pdf2word?ocr=${ocrChk?.checked ?? false}`, {
        method: 'POST',
        body: form
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(`Error: ${err.error || res.statusText}\n${err.detail || ''}`);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name.replace(/\.pdf$/i, '') + '.docx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    };
  }
});
