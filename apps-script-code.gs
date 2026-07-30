function doGet(e) {
  return ContentService
    .createTextOutput('Apps Script listo para recibir mediciones')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || '{}');
    const spreadsheetUrl = 'https://docs.google.com/spreadsheets/d/1DoSHDIgeqKj8IZs7A9sc_hgRNUJ7zI81witowKrwCxs/edit';
    const spreadsheet = SpreadsheetApp.openByUrl(spreadsheetUrl);

    const summarySheet = getOrCreateSheet(spreadsheet, 'Mediciones_Resumen', [
      'summary_id',
      'timestamp',
      'locomotora',
      'fecha',
      'horometro',
      'millas',
      'kwh',
      'wheel_count'
    ]);

    const detailSheet = getOrCreateSheet(spreadsheet, 'Mediciones_Ruedas', [
      'summary_id',
      'wheel',
      'go',
      'ticnikes',
      'AT',
      'falje ticnikes',
      'heith tecnikes',
      'height_pulgadas'
    ]);

    const measures = Array.isArray(payload.measures) ? payload.measures : [];
    const timestamp = new Date();
    const summaryId = getSummaryIdForLocomotiveAndDate(summarySheet, payload.locomotora || '', payload.fecha || '');

    summarySheet.appendRow([
      summaryId,
      timestamp,
      payload.locomotora || '',
      payload.fecha || '',
      payload.horometro || '',
      payload.millas || '',
      payload.kwh || '',
      measures.length
    ]);

    const rows = measures.map(measure => [
      summaryId,
      measure.wheel || '',
      measure.gauge != null ? measure.gauge : '',
      measure.thickness != null ? measure.thickness : '',
      measure.at != null ? measure.at : '',
      measure.flange_thickness != null ? measure.flange_thickness : '',
      measure.height_gauge != null ? measure.height_gauge : '',
      measure.height_pulgadas != null ? measure.height_pulgadas : ''
    ]);

    if (rows.length > 0) {
      detailSheet.getRange(detailSheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true, rows: rows.length }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getOrCreateSheet(spreadsheet, name, headers) {
  const sheet = spreadsheet.getSheetByName(name) || spreadsheet.insertSheet(name);
  const currentCols = sheet.getMaxColumns();
  if (currentCols < headers.length) {
    sheet.insertColumnsAfter(currentCols, headers.length - currentCols);
  }
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  return sheet;
}

function getMeasurementCountForLocomotive(summarySheet, locomotora) {
  if (!locomotora) return 0;
  const lastRow = summarySheet.getLastRow();
  if (lastRow < 2) return 0;
  const values = summarySheet.getRange(2, 3, lastRow - 1, 1).getValues();
  return values.reduce((count, row) => count + (row[0] === locomotora ? 1 : 0), 0);
}

function getSummaryIdForLocomotiveAndDate(summarySheet, locomotora, fecha) {
  const locoKey = normalizeLocomotora(locomotora);
  const dateKey = normalizeDateValue(fecha);
  if (!locoKey || !dateKey) return `${locoKey}0001`;

  const lastRow = summarySheet.getLastRow();
  if (lastRow < 2) return `${locoKey}0001`;

  const values = summarySheet.getRange(2, 1, lastRow - 1, 4).getValues();
  let maxSeq = 0;
  let existingId = null;

  values.forEach(row => {
    const rowId = String(row[0] || '').trim();
    const rowLoc = normalizeLocomotora(row[2]);
    const rowDate = normalizeDateValue(row[3]);

    if (rowLoc === locoKey) {
      if (rowDate === dateKey) {
        existingId = rowId;
      }
      const seq = parseSummarySeq(rowId, locoKey);
      if (seq > maxSeq) {
        maxSeq = seq;
      }
    }
  });

  if (existingId) {
    return existingId;
  }

  const nextSeq = String(maxSeq + 1).padStart(4, '0');
  return `${locoKey}${nextSeq}`;
}

function normalizeLocomotora(value) {
  return String(value || '').trim();
}

function parseSummarySeq(summaryId, locomotora) {
  if (!summaryId.startsWith(locomotora)) return 0;
  const seq = summaryId.slice(locomotora.length);
  return /^[0-9]+$/.test(seq) ? Number(seq) : 0;
}

function normalizeDateValue(value) {
  if (!value) return '';
  if (value instanceof Date) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(value).trim();
}
