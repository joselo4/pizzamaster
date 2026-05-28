# Render - pasos

1) Build Command: `bash render-build.sh`
2) Publish Directory: `dist`
3) Manual Deploy: **Clear build cache & deploy** (para evitar cache viejo).

Si el build vuelve a generar `dist/index.html` con `export default`, el script falla y Render no publica.
