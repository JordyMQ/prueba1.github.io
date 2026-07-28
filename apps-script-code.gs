function doGet(e) {
  return ContentService.createTextOutput('Apps Script listo para recibir datos').setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || '{}');
    const spreadsheetUrl = 'https://docs.google.com/spreadsheets/d/1DoSHDIgeqKj8IZs7A9sc_hgRNUJ7zI81witowKrwCxs/edit';
    const spreadsheet = SpreadsheetApp.openByUrl(spreadsheetUrl);
    const sheet = spreadsheet.getSheetByName('Datos') || spreadsheet.insertSheet('Datos');

    const headers = [
      'timestamp',
      'locomotora',
      'fecha',
      'horometro',
      'millas',
      'kwh',
      'medidas_json'
    ];

    const existingHeaders = sheet.getRange(1, 1, 1, Math.max(headers.length, 1)).getValues()[0];
    const needsHeaders = existingHeaders.every((value) => value !== headers[0]);
    if (needsHeaders) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }

    const row = [
      new Date(),
      payload.locomotora || '',
      payload.fecha || '',
      payload.horometro || '',
      payload.millas || '',
      payload.kwh || '',
      JSON.stringify(payload.measures || {})
    ];

    sheet.appendRow(row);

    return ContentService.createTextOutput(JSON.stringify({ ok: true, row: sheet.getLastRow() }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
