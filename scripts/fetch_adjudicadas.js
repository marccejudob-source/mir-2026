// Script para recoger adjudicaciones y vacantes del MIR y guardarlas como JSON
// Se ejecuta via GitHub Actions cada 2h

const fs = require('fs');
const path = require('path');
const https = require('https');

const DATA_DIR = path.join(__dirname, '..', 'data');
const ADJ_FILE = path.join(DATA_DIR, 'adjudicadas_historial.json');
const VAC_FILE = path.join(DATA_DIR, 'vacantes.json');
const TOKEN_URL = 'https://fse.sanidad.gob.es/hera/oauth/api/v1/oidc/token';
const ADJUDICADAS_URL = 'https://fse.sanidad.gob.es/hera/api/datos/convocatoria/getPlazasAdjudicadas?idTitulo=M';
const VACANTES_URL = 'https://fse.sanidad.gob.es/hera/api/datos/convocatoria/getPlazasVacantes';

function httpsRequest(url, options, body) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const opts = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: options.headers || {}
        };
        const req = https.request(opts, (res) => {
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

    const result = await httpsRequest(TOKEN_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-XSRF-TOKEN': 'cron-' + Date.now(),
            'Content-Length': Buffer.byteLength(body)
        }
    }, body);

    return result.data.token;
}

async function fetchAdjudicadas(token) {
    const result = await httpsRequest(ADJUDICADAS_URL, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`,
            'X-XSRF-TOKEN': 'cron-' + Date.now(),
            'Accept': 'application/json'
        }
    });
    return result.data;
}

async function fetchVacantes(token) {
    let all = [], page = 0, totalPages = 1;
    while (page < totalPages) {
        const url = `${VACANTES_URL}?page=${page}&size=500`;
        const body = JSON.stringify({});
        const result = await httpsRequest(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'X-XSRF-TOKEN': 'cron-' + Date.now(),
                'Content-Length': Buffer.byteLength(body)
            }
        }, body);

        if (result.data && result.data.totalPages) {
            totalPages = result.data.totalPages;
            all = all.concat(result.data.data || []);
        } else {
            break;
        }
        page++;
    }
    return all.filter(p => p.codigoTitulacion === 'M');
}

async function main() {
    console.log(`[${new Date().toISOString()}] Iniciando recogida de datos MIR...`);

    // Cargar historial existente de adjudicaciones
    let historial = {};
    if (fs.existsSync(ADJ_FILE)) {
        try {
            const raw = fs.readFileSync(ADJ_FILE, 'utf8');
            const parsed = JSON.parse(raw);
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
        console.log('  No hay historial previo');
    }

    // Obtener token
    const token = await getToken();
    console.log('  Token obtenido OK');

    // 1. Obtener adjudicadas
    const adjudicadas = await fetchAdjudicadas(token);
    console.log(`  API adjudicadas: ${adjudicadas.length} registros`);

    let nuevas = 0;
    adjudicadas.forEach(a => {
        if (!historial[a.numorden]) nuevas++;
        historial[a.numorden] = a;
    });

    console.log(`  Nuevas adjudicaciones: ${nuevas}`);
    console.log(`  Total acumulado: ${Object.keys(historial).length}`);

    // Guardar adjudicaciones
    const adjOutput = {
        lastUpdate: new Date().toISOString(),
        totalAdjudicaciones: Object.keys(historial).length,
        adjudicaciones: Object.values(historial).sort((a, b) => a.numorden - b.numorden)
    };
    fs.writeFileSync(ADJ_FILE, JSON.stringify(adjOutput), 'utf8');
    console.log(`  Guardado adjudicaciones en ${ADJ_FILE}`);

    // 2. Obtener vacantes
    const vacantes = await fetchVacantes(token);
    console.log(`  API vacantes: ${vacantes.length} registros`);

    // Guardar vacantes
    const vacOutput = {
        lastUpdate: new Date().toISOString(),
        totalVacantes: vacantes.reduce((s, v) => s + v.numeroPlazas, 0),
        vacantes: vacantes
    };
    fs.writeFileSync(VAC_FILE, JSON.stringify(vacOutput), 'utf8');
    console.log(`  Guardado vacantes en ${VAC_FILE}`);

    console.log(`[${new Date().toISOString()}] ¡Hecho!`);
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});