// Interacciones: autocompletar fecha, guardar en localStorage, imprimir y limpiar
document.addEventListener('DOMContentLoaded', () => {
    const appScriptUrlInput = document.getElementById('appScriptUrl');
    const inpLoc = document.getElementById('inpLocomotora');
    const inpFecha = document.getElementById('inpFecha');
    const inpHor = document.getElementById('inpHorometro');
    const inpMillas = document.getElementById('inpMillas');
    const inpKwh = document.getElementById('inpKwh');

    // Default date
    if (inpFecha && !inpFecha.value) inpFecha.value = new Date().toISOString().slice(0,10);

    // Load saved data
    const saved = JSON.parse(localStorage.getItem('medicion-ruedas') || '{}');
    if (saved.locomotora && inpLoc) inpLoc.value = saved.locomotora;
    if (saved.fecha && inpFecha) inpFecha.value = saved.fecha;
    if (saved.horometro && inpHor) inpHor.value = saved.horometro;
    if (saved.millas && inpMillas) inpMillas.value = saved.millas;
    if (saved.kwh && inpKwh) inpKwh.value = saved.kwh;

    const locoMap = {
        50: 'GE', 52: 'GE', 55: 'GE', 56: 'GE', 57: 'GE',
        31: 'GP40', 32: 'GP40', 33: 'GP40', 34: 'GP40', 35: 'GP40',
        60: 'SD70', 61: 'SD70',
        70: 'GP31ECO', 71: 'GP31ECO',
        80: 'SD70MAC', 81: 'SD70MAC'
    };

    const locoWheelCount = {
        GE: 8,
        GP40: 8,
        GP31ECO: 8,
        SD70: 12,
        SD70MAC: 12
    };

    const locoMessage = document.getElementById('locomotiveMessage');

    function setLocomotiveMessage(text, isError = false) {
        if (!locoMessage) return;
        locoMessage.textContent = text;
        locoMessage.classList.toggle('error', isError);
    }

    function getLocomotiveModel(value) {
        const number = Number(String(value).trim());
        if (!Number.isInteger(number) || number <= 0) return null;
        return locoMap[number] || null;
    }

    function updateLocomotiveRows() {
        const model = getLocomotiveModel(inpLoc ? inpLoc.value : '');
        const table = document.querySelector('.sec-1-grid table');
        if (!table) return;
        const rows = Array.from(table.querySelectorAll('tbody tr'));
        if (!model) {
            rows.forEach(row => row.style.display = 'table-row');
            if (inpLoc && inpLoc.value.trim().length > 0) {
                setLocomotiveMessage('Locomotora no existe en la lista.', true);
            } else {
                setLocomotiveMessage('', false);
            }
            return;
        }

        const visibleRows = locoWheelCount[model] || 12;
        rows.forEach((row, index) => {
            row.style.display = index < visibleRows ? 'table-row' : 'none';
        });
        setLocomotiveMessage(`Serie ${model} detectada: ${visibleRows} ruedas visibles.`, false);
    }

    const refreshView = () => {
        // Placeholder for future visual refresh logic
    };

    function validateMeasures() {
        const problems = [];
        const inputs = Array.from(document.querySelectorAll('input[data-field]'));
        inputs.forEach(inp => {
            inp.classList.remove('invalid');
            const field = inp.getAttribute('data-field');
            const valRaw = inp.value;
            if (valRaw === '') return; // empty allowed
            const val = Number(valRaw);
            let min = -Infinity, max = Infinity;
            if (field === 'thickness') { min = 0.1; max = 5; }
            if (field === 'flange_thickness') { min = 0; max = 3; }
            if (field === 'at') { min = 0; max = 30; }
            if (field === 'height_pulgadas') { min = 0; max = 10; }
            if (field === 'height_gauge') { min = 0; max = 30; }
            if (field === 'gauge') { min = 0; max = 50; }
            if (!isFinite(val)) {
                inp.classList.add('invalid');
                problems.push(`${inp.getAttribute('data-wheel')} ${field}: valor no numérico`);
            } else if (val < min || val > max) {
                inp.classList.add('invalid');
                problems.push(`${inp.getAttribute('data-wheel')} ${field}: valor fuera de rango (${min} - ${max})`);
            }
        });
        return problems;
    }

    function computeSummary() {
        const wheelGauges = [];
        const thicknesses = [];
        const atValues = [];
        const flangeThicknesses = [];
        const heightGauges = [];
        const flangeHeights = [];
        const table = document.querySelector('.sec-1-grid table');
        const elCountMeasured = document.getElementById('countMeasured');
        const elAvg = document.getElementById('avgThickness');
        const elAvgFlange = document.getElementById('avgFlangeThickness');
        const elAvgFlangeHeight = document.getElementById('avgFlangeHeight');
        const elMaxDiff = document.getElementById('maxDiff');
        const elCountAlert = document.getElementById('countAlert');
        const elCountCritical = document.getElementById('countCritical');
        const elMonths = document.getElementById('monthsToCritical');
        const monthlyInput = document.getElementById('inpMonthlyWear');
        const alertThreshold = 1.0625; // 1 1/16"
        const criticalThreshold = 0.1875; // 3/16"

        let countAlert = 0, countCritical = 0;
        let countAtAlert = 0, countAtCritical = 0, countHeightAlert = 0, countHeightCritical = 0;
        let measuredCount = 0;

        if (table) {
            const rows = table.querySelectorAll('tbody tr');
            const highlightField = (inp, isCritical, isWarning) => {
                if (!inp) return;
                const cell = inp.closest('td');
                if (cell) {
                    cell.classList.toggle('critical-cell', isCritical);
                    cell.classList.toggle('warning-cell', !isCritical && isWarning);
                }
                inp.classList.toggle('critical', isCritical);
                inp.classList.toggle('warning', !isCritical && isWarning);
            };
            rows.forEach(row => {
                if (row.style.display === 'none') return;
                row.querySelectorAll('td.warning-cell, td.critical-cell').forEach(td => {
                    td.classList.remove('warning-cell', 'critical-cell');
                });
                row.querySelectorAll('input.warning, input.critical').forEach(inp => {
                    inp.classList.remove('warning', 'critical');
                });
                const getVal = (field) => {
                    const inp = row.querySelector(`input[data-field="${field}"]`);
                    if (!inp) return null;
                    const v = inp.value.trim();
                    return v === '' ? null : Number(v);
                };
                const gauge = getVal('gauge');
                const thickness = getVal('thickness');
                const at = getVal('at');
                const flangeThickness = getVal('flange_thickness');
                const heightGauge = getVal('height_gauge');
                const heightPulg = getVal('height_pulgadas');

                const thicknessInput = row.querySelector('input[data-field="thickness"]');
                const atInput = row.querySelector('input[data-field="at"]');
                const heightGaugeInput = row.querySelector('input[data-field="height_gauge"]');

                if ([gauge, thickness, at, flangeThickness, heightGauge, heightPulg].some(value => value != null)) {
                    measuredCount++;
                }
                if (gauge != null) wheelGauges.push(gauge);
                if (thickness != null) thicknesses.push(thickness);
                if (at != null) atValues.push(at);
                if (flangeThickness != null) flangeThicknesses.push(flangeThickness);
                if (heightGauge != null) heightGauges.push(heightGauge);
                if (heightPulg != null) flangeHeights.push(heightPulg);

                const thicknessCritical = thickness != null && thickness < criticalThreshold;
                const thicknessWarning = thickness != null && thickness < alertThreshold;
                const atCritical = at != null && at >= 9;
                const atWarning = at != null && at >= 8;
                const heightCritical = heightGauge != null && heightGauge >= 22;
                const heightWarning = heightGauge != null && heightGauge >= 21;

                highlightField(thicknessInput, thicknessCritical, thicknessWarning);
                highlightField(atInput, atCritical, atWarning);
                highlightField(heightGaugeInput, heightCritical, heightWarning);

                if (thickness != null) {
                    if (thickness < criticalThreshold) countCritical++;
                    else if (thickness < alertThreshold) countAlert++;
                }
                if (at != null) {
                    if (at >= 9) countAtCritical++;
                    else if (at >= 8) countAtAlert++;
                }
                if (heightGauge != null) {
                    if (heightGauge >= 22) countHeightCritical++;
                    else if (heightGauge >= 21) countHeightAlert++;
                }
            });
        }

        const avgGauge = wheelGauges.length ? wheelGauges.reduce((a,b)=>a+b,0)/wheelGauges.length : null;
        const avgThickness = thicknesses.length ? thicknesses.reduce((a,b)=>a+b,0)/thicknesses.length : null;
        const avgAt = atValues.length ? atValues.reduce((a,b)=>a+b,0)/atValues.length : null;
        const avgHeightGauge = heightGauges.length ? heightGauges.reduce((a,b)=>a+b,0)/heightGauges.length : null;
        const maxDiff = wheelGauges.length ? Math.max(...wheelGauges) - Math.min(...wheelGauges) : null;

        if (elCountMeasured) elCountMeasured.textContent = String(measuredCount);
        if (measuredCount === 0) {
            if (elAvg) elAvg.textContent = '-';
            if (elAvgFlange) elAvgFlange.textContent = '-';
            if (elAvgFlangeHeight) elAvgFlangeHeight.textContent = '-';
            if (elMaxDiff) elMaxDiff.textContent = '-';
            if (elCountAlert) elCountAlert.textContent = '0';
            if (elCountCritical) elCountCritical.textContent = '0';
            if (elMonths) elMonths.textContent = '-';
            const elAtAlert = document.getElementById('countAtAlert');
            const elAtCritical = document.getElementById('countAtCritical');
            const elHeightAlert = document.getElementById('countHeightAlert');
            const elHeightCritical = document.getElementById('countHeightCritical');
            if (elAtAlert) elAtAlert.textContent = '0';
            if (elAtCritical) elAtCritical.textContent = '0';
            if (elHeightAlert) elHeightAlert.textContent = '0';
            if (elHeightCritical) elHeightCritical.textContent = '0';
            return;
        }

        if (elAvg) elAvg.textContent = avgGauge != null ? avgGauge.toFixed(3) : '-';
        if (elAvgFlange) elAvgFlange.textContent = avgAt != null ? avgAt.toFixed(3) : '-';
        if (elAvgFlangeHeight) elAvgFlangeHeight.textContent = avgHeightGauge != null ? avgHeightGauge.toFixed(3) : '-';
        if (elMaxDiff) elMaxDiff.textContent = maxDiff != null ? maxDiff.toFixed(3) : '-';
        if (elCountAlert) elCountAlert.textContent = String(countAlert);
        if (elCountCritical) elCountCritical.textContent = String(countCritical);
        const elAtAlert = document.getElementById('countAtAlert');
        const elAtCritical = document.getElementById('countAtCritical');
        const elHeightAlert = document.getElementById('countHeightAlert');
        const elHeightCritical = document.getElementById('countHeightCritical');
        if (elAtAlert) elAtAlert.textContent = String(countAtAlert);
        if (elAtCritical) elAtCritical.textContent = String(countAtCritical);
        if (elHeightAlert) elHeightAlert.textContent = String(countHeightAlert);
        if (elHeightCritical) elHeightCritical.textContent = String(countHeightCritical);

        let months = '-';
        const monthlyWear = monthlyInput ? Number(monthlyInput.value) : 0.03125;
        if (monthlyWear > 0 && avgThickness != null) {
            const remaining = avgThickness - criticalThreshold;
            if (remaining > 0) months = (remaining / monthlyWear).toFixed(1);
            else months = '0';
        }
        if (elMonths) elMonths.textContent = months;
    }

    async function saveToGoogleSheets(payload) {
        const url = (appScriptUrlInput ? appScriptUrlInput.value : '').trim() || (window.APPS_SCRIPT_URL || '').trim();
        if (!url || url.includes('TU_URL_DEL_WEB_APP')) {
            return { ok: false, message: 'No se configuró la URL del Web App de Apps Script.' };
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const text = await response.text();
        if (!response.ok) {
            throw new Error(`Error ${response.status}: ${text}`);
        }

        try {
            return { ok: true, result: JSON.parse(text) };
        } catch {
            return { ok: true, result: text };
        }
    }

    const btnSave = document.getElementById('btnSave');
    if (btnSave) btnSave.addEventListener('click', async () => {
        const data = {
            locomotora: inpLoc ? inpLoc.value : undefined,
            fecha: inpFecha ? inpFecha.value : undefined,
            horometro: inpHor ? inpHor.value : undefined,
            millas: inpMillas ? inpMillas.value : undefined,
            kwh: inpKwh ? inpKwh.value : undefined,
            measures: {}
        };

        // Collect table numeric inputs
        const table = document.querySelector('.sec-1-grid table');
        if (table) {
            const rows = table.querySelectorAll('tbody tr');
            rows.forEach(row => {
                const wheel = row.querySelector('td') && row.querySelector('td').textContent.trim();
                if (!wheel) return;
                data.measures[wheel] = {};
                const inputs = row.querySelectorAll('input[data-field]');
                inputs.forEach(inp => {
                    const field = inp.getAttribute('data-field');
                    const val = inp.value;
                    data.measures[wheel][field] = val === '' ? null : Number(val);
                });
            });
        }

        // Validate before saving
        const problems = validateMeasures();
        if (problems.length) {
            alert('No se puede guardar. Corrige los siguientes errores:\n- ' + problems.join('\n- '));
            return;
        }

        localStorage.setItem('medicion-ruedas', JSON.stringify(data));
        refreshView();

        try {
            const sheetResult = await saveToGoogleSheets(data);
            if (sheetResult.ok) {
                alert('Guardado localmente y enviado a Google Sheets');
            } else {
                alert('Guardado localmente. No se pudo enviar a Google Sheets: ' + sheetResult.message);
            }
        } catch (error) {
            console.error('Error al enviar a Google Sheets:', error);
            alert('Guardado localmente, pero no se pudo enviar a Google Sheets. Revisa la URL del Web App.');
        }
    });

    const btnPrint = document.getElementById('btnPrint');
    if (btnPrint) btnPrint.addEventListener('click', () => window.print());

    const btnClear = document.getElementById('btnClear');
    if (btnClear) btnClear.addEventListener('click', () => {
        if (!confirm('Limpiar campos y datos guardados?')) return;
        localStorage.removeItem('medicion-ruedas');
        if (inpLoc) inpLoc.value = '';
        if (inpHor) inpHor.value = '';
        if (inpMillas) inpMillas.value = '';
        if (inpKwh) inpKwh.value = '';
        if (inpFecha) inpFecha.value = new Date().toISOString().slice(0,10);
        const tableInputs = document.querySelectorAll('input[data-wheel]');
        tableInputs.forEach(i => i.value = '');
    });

    const allInputs = Array.from(document.querySelectorAll('input'));
    allInputs.forEach(el => el.addEventListener('keydown', (e) => { if (e.key === 'Enter') btnSave && btnSave.click(); }));

    if (saved.measures) {
        const table = document.querySelector('.sec-1-grid table');
        if (table) {
            const rows = table.querySelectorAll('tbody tr');
            rows.forEach(row => {
                const wheel = row.querySelector('td') && row.querySelector('td').textContent.trim();
                if (!wheel) return;
                const inputs = row.querySelectorAll('input[data-field]');
                inputs.forEach(inp => {
                    const field = inp.getAttribute('data-field');
                    if (saved.measures[wheel] && saved.measures[wheel][field] != null) {
                        inp.value = saved.measures[wheel][field];
                    }
                });
            });
        }
    }

    if (inpLoc) {
        inpLoc.addEventListener('input', () => {
            updateLocomotiveRows();
            computeSummary();
        });
    }

    document.querySelectorAll('input[data-field]').forEach(i => i.addEventListener('input', () => { computeSummary(); validateMeasures(); }));

    updateLocomotiveRows();
    computeSummary();
});