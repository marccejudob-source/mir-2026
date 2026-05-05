// Script para recoger adjudicaciones del MIR y acumularlas
// Se ejecuta via GitHub Actions cada 2h

const fs = require('fs');
const path = require('path');
const https = require('https');

const DATA_FILE = path.join(__dirname, '..', 'data', 'adjudicadas_historial.json');
const TOKEN_URL = 'https://fse.sanidad.gob.es/hera/oauth/api/v1/oidc/token';
const ADJUDICADAS_URL = 'https://fse.sanidad.gob.es/hera/api/datos/convocatoria/getPlazasAdjudicadas?idTitulo=M';

function httpsRequest(url, options, body) {
    return new Promise((resolve, reject) => {
        const req = https.request(url, options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch(e) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
    });
}

async function getToken() {
    const body = JSON.stringify({
        client_id: 'FSEWEB',
        username: '',
        password: '',
        state: 'github-action-' + Date.now(),
        grant_type: 'client_no_identification'
    });

    const url = new URL(TOKEN_URL);
    const result = await httpsRequest(url, {
        method: 'POST',
        hostname: url.hostname,
        path: url.pathname,
        headers: {
            'Content-Type': 'application/json',
            'X-XSRF-TOKEN': 'cron-' + Date.now(),
            'Content-Length': Buffer.byteLength(body)
        }
    }, body);

    return result.data.token;
}

async function fetchAdjudicadas(token) {
    const url = new URL(ADJUDICADAS_URL);
    const result = await httpsRequest(url, {
        method: 'GET',
        hostname: url.hostname,
        path: url.pathname + url.search,
        headers: {
            'Authorization': `Bearer ${token}`,
            'X-XSRF-TOKEN': 'cron-' + Date.now(),
            'Accept': 'application/json'
        }
    });

    return result.data;
}

async function main() {
    console.log(`[${new Date().toISOString()}] Iniciando recogida de adjudicaciones MIR...`);

    // Cargar historial existente
    let historial = {};
    if (fs.existsSync(DATA_FILE)) {
        try {
            const raw = fs.readFileSync(DATA_FILE, 'utf8');
            const parsed = JSON.parse(raw);
            // Convert array to map by numorden for deduplication
            if (Array.isArray(parsed.adjudicaciones)) {
                parsed.adjudicaciones.forEach(a => {
                    historial[a.numorden] = a;
                });
            }
            console.log(`  Historial existente: ${Object.keys(historial).length} adjudicaciones`);
        } catch(e) {
            console.log('  Error leyendo historial, empezando de nuevo:', e.message);
        }
    } else {
        console.log('  No hay historial previo, empezando de nuevo');
    }

    // Obtener token
    const token = await getToken();
    console.log('  Token obtenido OK');

    // Obtener adjudicadas actuales
    const adjudicadas = await fetchAdjudicadas(token);
    console.log(`  API devolvió: ${adjudicadas.length} adjudicaciones`);

    // Merge: añadir nuevas al historial
    let nuevas = 0;
    adjudicadas.forEach(a => {
        if (!historial[a.numorden]) {
            nuevas++;
        }
        historial[a.numorden] = a; // Update or insert
    });

    console.log(`  Nuevas adjudicaciones: ${nuevas}`);
    console.log(`  Total acumulado: ${Object.keys(historial).length}`);

    // Guardar historial
    const output = {
        lastUpdate: new Date().toISOString(),
        totalAdjudicaciones: Object.keys(historial).length,
        adjudicaciones: Object.values(historial).sort((a, b) => a.numorden - b.numorden)
    };

    fs.writeFileSync(DATA_FILE, JSON.stringify(output, null, 2), 'utf8');
    console.log(`  Guardado en ${DATA_FILE}`);
    console.log(`[${new Date().toISOString()}] Hecho!`);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});