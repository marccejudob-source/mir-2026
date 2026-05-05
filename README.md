# 🩺 MIR 2026 - Dashboard de Adjudicaciones

Dashboard en tiempo real de la adjudicación de plazas MIR 2026.

**URL pública:** `https://TU_USUARIO.github.io/mir-2026/`

## 🚀 Cómo desplegarlo (5 minutos)

### 1. Crear cuenta GitHub
1. Ve a https://github.com/signup
2. Regístrate con tu email
3. Confirma el email

### 2. Crear repositorio
1. Ve a https://github.com/new
2. Nombre: `mir-2026`
3. Selecciona **Public**
4. NO marques "Add a README" (ya tenemos uno)
5. Click **Create repository**

### 3. Subir los archivos
1. En tu nuevo repo, click **"uploading an existing file"** (o el enlace que aparece)
2. Arrastra TODOS los archivos de esta carpeta (incluida la carpeta `.github`, `data`, `scripts`)
3. Click **Commit changes**

⚠️ **IMPORTANTE**: La carpeta `.github` puede estar oculta en Windows. Para verla:
- Abre el Explorador de archivos
- Ve a Ver → Mostrar → Elementos ocultos

### 4. Activar GitHub Pages
1. Ve a tu repo → **Settings** (pestaña arriba)
2. En el menú lateral, click **Pages**
3. En "Source" selecciona **Deploy from a branch**
4. Branch: **main**, carpeta: **/ (root)**
5. Click **Save**
6. Espera 2-3 minutos → tu web estará en `https://TU_USUARIO.github.io/mir-2026/`

### 5. Verificar que el cron funciona
1. Ve a tu repo → pestaña **Actions**
2. Deberías ver el workflow "Recoger Adjudicaciones MIR"
3. Click en él → **Run workflow** → **Run workflow** (para ejecutarlo manualmente la primera vez)
4. A partir de ahí se ejecutará solo cada 2 horas

## 📊 Cómo funciona

- **Cada 2 horas** GitHub Actions ejecuta un script que:
  - Llama a la API del Ministerio de Sanidad
  - Recoge las últimas 400 adjudicaciones disponibles
  - Las **acumula** con las anteriores (no pierde datos)
  - Guarda todo en `data/adjudicadas_historial.json`

- **Cuando un usuario abre la web:**
  - Descarga las vacantes en tiempo real de la API del Ministerio
  - Lee el historial acumulado de adjudicaciones del repo
  - También pide las últimas 400 adjudicaciones en vivo (por si hay nuevas desde el último cron)
  - Combina todo para mostrar datos completos

## ⚠️ Limitaciones

- La API del Ministerio solo devuelve las **últimas 400 adjudicaciones** por llamada
- Si se adjudican >400 plazas entre dos ejecuciones del cron (4h), se perderán algunas
- En la práctica adjudican ~100-200/día, así que con cron cada 2h no se pierde nada
- Las primeras ~298 adjudicaciones del MIR (anteriores al inicio del seguimiento) no están disponibles

## 🔧 Estructura

```
├── index.html                          # Dashboard web
├── data/
│   └── adjudicadas_historial.json     # Historial acumulado (se actualiza solo)
├── scripts/
│   └── fetch_adjudicadas.js           # Script de recogida (Node.js)
├── .github/
│   └── workflows/
│       └── cron.yml                   # GitHub Action (cron cada 2h)
└── README.md                          # Este archivo