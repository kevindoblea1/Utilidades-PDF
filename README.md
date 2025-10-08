# Utilidades PDF (Node/Express + Python)

Herramienta web sencilla para **procesar archivos PDF**: convertir a Word (DOCX), comprimir, unir dos PDFs y convertir imágenes a PDF.  
Backend en **Node.js/Express** con **multer** para subida de archivos. La conversión PDF→DOCX usa un **venv de Python** y el script `tools/pdf2docx_cli.py` (basado en `pdf2docx` / `PyMuPDF`).

---

## Características

- **PDF → Word (DOCX)** `/api/pdf2word`
- **Comprimir PDF** `/api/compress`
- **Unir 2 PDFs** `/api/merge-two`
- **Imágenes (JPG/PNG) → PDF** `/api/img2pdf`
- UI estática en `public/` para usar desde el navegador.

---

## Requisitos

- **Node.js 18+** (recomendado LTS)
- **Python 3.10+** con `venv`
- Linux (probado en Ubuntu Server).

---

## Instalación rápida (desarrollo)

```bash
git clone https://github.com/kevindoblea1/Utilidades-PDF.git
cd Utilidades-PDF

# 1) Dependencias Node
npm ci   # o: npm install

# 2) Python venv para pdf2docx / PyMuPDF
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip

# Dependencias mínimas probadas
pip install "pdf2docx==0.5.6" "pymupdf==1.24.10" "opencv-python>=4.5" "lxml>=4.9" "python-docx>=0.8.10" "typing_extensions>=4.9" "fonttools" "fire"

# 3) Crear carpeta temporales si no existe
mkdir -p tmp
```

> **Nota:** El backend usará `venv/bin/python` para invocar `tools/pdf2docx_cli.py`.

---

## Estructura del proyecto

```
.
├─ api/
│  ├─ compress.js
│  ├─ img2pdf.js
│  ├─ merge-two.js
│  └─ pdf2word.js        # convoca tools/pdf2docx_cli.py dentro del venv
├─ public/               # front-end estático
├─ tools/
│  └─ pdf2docx_cli.py    # CLI de conversión PDF → DOCX
├─ tmp/                  # archivos subidos y resultados temporales
├─ venv/                 # entorno Python (no versionar)
├─ server.js             # Express app
├─ .gitignore
├─ LICENCE
├─ package.json
└─ README.md
```

---

## Arranque local

```bash
# Terminal 1 (para convertir): activar el venv una vez
source venv/bin/activate

# Terminal 2 (o la misma): levantar el server
node server.js
# o
PORT=3000 node server.js

# Navegar a
http://localhost:3000
```

---

## Endpoints (API)

Todos reciben `multipart/form-data` con **un campo por archivo**.

### 1) PDF → Word (DOCX)
- **POST** `/api/pdf2word`
- Campo: `pdf` (archivo PDF)
- Respuesta: descarga `.docx`

**Ejemplo curl**
```bash
curl -fSL -X POST http://localhost:3000/api/pdf2word \
  -F "pdf=@/ruta/al/archivo.pdf" \
  -o salida.docx
```

### 2) Comprimir PDF
- **POST** `/api/compress`
- Campo: `pdf` (archivo PDF)
- Respuesta: descarga `.pdf` comprimido

```bash
curl -fSL -X POST http://localhost:3000/api/compress \
  -F "pdf=@/ruta/al/archivo.pdf" -o comprimido.pdf
```

### 3) Unir 2 PDFs
- **POST** `/api/merge-two`
- Campos: `pdf1`, `pdf2`
- Respuesta: descarga `.pdf` unido

```bash
curl -fSL -X POST http://localhost:3000/api/merge-two \
  -F "pdf1=@/ruta/a.pdf" -F "pdf2=@/ruta/b.pdf" -o unido.pdf
```

### 4) Imágenes → PDF
- **POST** `/api/img2pdf`
- Campo: `image` (JPG o PNG)
- Respuesta: descarga `.pdf`

```bash
curl -fSL -X POST http://localhost:3000/api/img2pdf \
  -F "image=@/ruta/imagen.jpg" -o imagen.pdf
```

---

## Cómo funciona **PDF → DOCX**

1. El **router** `api/pdf2word.js` guarda el PDF en `tmp/` (con un nombre único).
2. Llama a:
   ```bash
   ./venv/bin/python tools/pdf2docx_cli.py <input.pdf> <output.docx>
   ```
3. Si termina ok, responde con `res.download(<output.docx>)`.
4. El archivo temporal se elimina cuando el envío finaliza.

### Ejecutar manualmente la CLI
```bash
./venv/bin/python tools/pdf2docx_cli.py "tmp/archivo.pdf" "tmp/salida.docx"
```

---

## Producción con **systemd**

Unidad de ejemplo `/etc/systemd/system/utilidades-pdf.service`:

```ini
[Unit]
Description=Utilidades PDF (Node.js)
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/it/pdfutilidad
Environment=PORT=3000
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=3
User=it
Group=it

[Install]
WantedBy=multi-user.target
```

Comandos:

```bash
sudo systemctl daemon-reload
sudo systemctl enable utilidades-pdf.service
sudo systemctl start utilidades-pdf.service

# Operación diaria
sudo systemctl status utilidades-pdf.service
sudo systemctl restart utilidades-pdf.service
sudo journalctl -u utilidades-pdf.service -f
```

> Si el servicio ya existe con otro nombre pero **activo**, basta con `restart`.

---

## `.gitignore` recomendado

```gitignore
# Node
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Python venv + caches
venv/
__pycache__/
*.pyc

# Archivos temporales y resultados
tmp/
*.log

# SO/editores
.DS_Store
Thumbs.db
.idea/
.vscode/
```

> Versiona el código de `api/`, `tools/`, `public/`, `server.js`, etc. No versionar `venv/` ni `tmp/`.

---

## Solución de problemas

- **Word dice que el DOCX es ilegible o corrupto**
  - Asegúrate de **descargar** el archivo con extensión `.docx` (el backend ya usa `res.download()`).
  - No intentes abrir el DOCX **parcial** (si la descarga fue interrumpida se corrompe).
  - Revisa logs: `journalctl -u utilidades-pdf.service -f`.

- **“No existe: tmp/<archivo>.pdf”**
  - El nombre real guardado por `multer` es único: `UUID-nombre_original.pdf`. Verifica con `ls tmp/` o usa el **curl** de ejemplo.

- **Nombres con espacios y acentos**
  - El server reemplaza espacios por `_` en el nombre almacenado, pero conserva el original para la descarga.

- **Aviso del navegador: “file was loaded over an insecure connection”**
  - Es un *warning* al descargar por **HTTP**. En producción usa **HTTPS** (Nginx/Traefik/Caddy como reverse proxy).

- **Dependencias Python**
  - Usa exactamente `pdf2docx==0.5.6` y `pymupdf==1.24.10`. Otras versiones pueden compilar bins pesados.
  - Si cambias de versión, borra y recrea el `venv`.

---

## Licencia

Este proyecto se distribuye bajo la licencia del archivo `LICENCE` presente en el repositorio.

---

## Créditos

- Conversión PDF→DOCX: [`pdf2docx`](https://pypi.org/project/pdf2docx/) + [`PyMuPDF`](https://pymupdf.readthedocs.io/).
- Backend: Node.js / Express / Multer.
