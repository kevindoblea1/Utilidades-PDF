// public/app-docx2excel.js
document.addEventListener('DOMContentLoaded', () => {
  const drop   = document.getElementById('drop5');
  const input  = document.getElementById('dx2xl-file');
  const runBtn = document.getElementById('dx2xl-run');
  const msg    = document.getElementById('dx2xl-msg');

  const setMsg = (text, ok = false) => {
    msg.textContent = text || '';
    msg.classList.remove('ok', 'err');
    if (text) msg.classList.add(ok ? 'ok' : 'err');
  };

  // Drag & drop
  if (drop) {
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('drag'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
    drop.addEventListener('drop', e => {
      e.preventDefault(); drop.classList.remove('drag');
      const files = [...(e.dataTransfer?.files || [])]
        .filter(f => /\.docx$/i.test(f.name) || /wordprocessingml\.document/.test(f.type));
      if (files[0]) {
        const dt = new DataTransfer();
        dt.items.add(files[0]);
        input.files = dt.files;
      }
    });
  }

  // Acción principal
  if (runBtn) {
    runBtn.addEventListener('click', async () => {
      const f = input?.files?.[0];
      if (!f) return alert('Selecciona un archivo .docx');

      runBtn.disabled = true;
      setMsg('Procesando...');

      try {
        const fd = new FormData();
        fd.append('file', f);

        const res = await fetch('/api/docx2excel', { method: 'POST', body: fd });
        if (!res.ok) {
          let detail = '';
          try { const e = await res.json(); detail = e.error + (e.detail ? `: ${e.detail}` : ''); } catch {}
          throw new Error(detail || res.statusText);
        }

        const blob = await res.blob();
        const name = f.name.replace(/\.docx$/i, '') + '.xlsx';
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(url);

        setMsg('Listo ✅', true);
        setTimeout(() => setMsg(''), 3000);
      } catch (e) {
        setMsg(`Error: ${e.message || e}`, false);
      } finally {
        runBtn.disabled = false;
      }
    });
  }
});
