const PROJECTS_SHEET = 'Projects';
const SPOOLS_SHEET = 'Spools';

const PROJECT_HEADERS = ['id', 'name', 'ownerId', 'ownerEmail', 'createdAt'];
const SPOOL_HEADERS = ['id', 'projectId', 'name', 'ownerId', 'ownerEmail', 'drawingDataJson', 'bomJson', 'createdAt', 'updatedAt'];

function doGet(e) {
  const parameters = e && e.parameter ? e.parameter : {};
  const callback = sanitizeCallback_(parameters.callback || 'callback');
  const payload = parsePayload_(parameters.payload || '{}');
  const result = handle_(payload);

  return ContentService
    .createTextOutput(`${callback}(${JSON.stringify(result)});`)
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function doPost(e) {
  const rawPayload = e && e.parameter && e.parameter.payload
    ? e.parameter.payload
    : e && e.postData && e.postData.contents
      ? e.postData.contents
      : '{}';
  const payload = parsePayload_(rawPayload);
  const result = handle_(payload);

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function setupAcheroSpoolSheets() {
  getSheet_(PROJECTS_SHEET, PROJECT_HEADERS);
  getSheet_(SPOOLS_SHEET, SPOOL_HEADERS);
}

function handle_(payload) {
  try {
    validateToken_(payload.token || '');
    setupAcheroSpoolSheets();

    switch (payload.action) {
      case 'listProjects':
        return ok_(listProjects_(payload));
      case 'listSpools':
        return ok_(listSpools_(payload));
      case 'createProject':
        return ok_(createProject_(payload));
      case 'deleteProject':
        return ok_(deleteProject_(payload));
      case 'createSpool':
        return ok_(createSpool_(payload));
      case 'updateSpool':
        return ok_(updateSpool_(payload));
      case 'deleteSpool':
        return ok_(deleteSpool_(payload));
      case 'renameSpool':
        return ok_(renameSpool_(payload));
      default:
        throw new Error(`Accion no soportada: ${payload.action}`);
    }
  } catch (error) {
    return {
      ok: false,
      error: error && error.message ? error.message : String(error)
    };
  }
}

function listProjects_(payload) {
  const ownerId = requireString_(payload.ownerId, 'ownerId');
  return readObjects_(PROJECTS_SHEET, PROJECT_HEADERS)
    .filter((project) => project.ownerId === ownerId);
}

function listSpools_(payload) {
  const ownerId = requireString_(payload.ownerId, 'ownerId');
  const projectId = requireString_(payload.projectId, 'projectId');

  return readObjects_(SPOOLS_SHEET, SPOOL_HEADERS)
    .filter((spool) => spool.ownerId === ownerId && spool.projectId === projectId)
    .map((spool) => ({
      id: spool.id,
      projectId: spool.projectId,
      name: spool.name,
      ownerId: spool.ownerId,
      ownerEmail: spool.ownerEmail,
      drawingData: parsePayload_(spool.drawingDataJson || '{}'),
      bom: spool.bomJson ? parsePayload_(spool.bomJson) : null,
      createdAt: spool.createdAt,
      updatedAt: spool.updatedAt
    }));
}

function createProject_(payload) {
  const project = payload.project || {};
  const row = [
    requireString_(project.id, 'project.id'),
    requireString_(project.name, 'project.name'),
    requireString_(project.ownerId, 'project.ownerId'),
    requireString_(project.ownerEmail, 'project.ownerEmail'),
    project.createdAt || new Date().toISOString()
  ];

  withLock_(() => {
    const sheet = getSheet_(PROJECTS_SHEET, PROJECT_HEADERS);
    if (findRowIndexById_(sheet, project.id) !== -1) return;
    sheet.appendRow(row);
  });

  return project;
}

function deleteProject_(payload) {
  const ownerId = requireString_(payload.ownerId, 'ownerId');
  const projectId = requireString_(payload.projectId, 'projectId');

  withLock_(() => {
    const projectsSheet = getSheet_(PROJECTS_SHEET, PROJECT_HEADERS);
    const projectRow = findRowIndexById_(projectsSheet, projectId);
    if (projectRow === -1) return;

    const project = rowToObject_(PROJECT_HEADERS, projectsSheet.getRange(projectRow, 1, 1, PROJECT_HEADERS.length).getValues()[0]);
    assertOwner_(project.ownerId, ownerId);
    projectsSheet.deleteRow(projectRow);

    const spoolsSheet = getSheet_(SPOOLS_SHEET, SPOOL_HEADERS);
    const values = spoolsSheet.getDataRange().getValues();
    for (let row = values.length; row >= 2; row--) {
      const spool = rowToObject_(SPOOL_HEADERS, values[row - 1]);
      if (spool.projectId === projectId && spool.ownerId === ownerId) {
        spoolsSheet.deleteRow(row);
      }
    }
  });

  return { deleted: true };
}

function createSpool_(payload) {
  const spool = payload.spool || {};
  const projectId = requireString_(spool.projectId, 'spool.projectId');
  const ownerId = requireString_(spool.ownerId, 'spool.ownerId');

  withLock_(() => {
    const projectsSheet = getSheet_(PROJECTS_SHEET, PROJECT_HEADERS);
    const projectRow = findRowIndexById_(projectsSheet, projectId);
    if (projectRow === -1) throw new Error('Proyecto no encontrado');
    const project = rowToObject_(PROJECT_HEADERS, projectsSheet.getRange(projectRow, 1, 1, PROJECT_HEADERS.length).getValues()[0]);
    assertOwner_(project.ownerId, ownerId);

    const spoolsSheet = getSheet_(SPOOLS_SHEET, SPOOL_HEADERS);
    if (findRowIndexById_(spoolsSheet, spool.id) !== -1) return;
    spoolsSheet.appendRow([
      requireString_(spool.id, 'spool.id'),
      projectId,
      requireString_(spool.name, 'spool.name'),
      ownerId,
      requireString_(spool.ownerEmail, 'spool.ownerEmail'),
      JSON.stringify(spool.drawingData || {}),
      JSON.stringify(spool.bom || null),
      spool.createdAt || new Date().toISOString(),
      spool.updatedAt || new Date().toISOString()
    ]);
  });

  return spool;
}

function updateSpool_(payload) {
  const ownerId = requireString_(payload.ownerId, 'ownerId');
  const spool = payload.spool || {};

  withLock_(() => {
    const spoolsSheet = getSheet_(SPOOLS_SHEET, SPOOL_HEADERS);
    const row = findRowIndexById_(spoolsSheet, requireString_(spool.id, 'spool.id'));
    if (row === -1) throw new Error('Spool no encontrado');

    const existing = rowToObject_(SPOOL_HEADERS, spoolsSheet.getRange(row, 1, 1, SPOOL_HEADERS.length).getValues()[0]);
    assertOwner_(existing.ownerId, ownerId);
    if (existing.projectId !== spool.projectId) throw new Error('El spool no pertenece al proyecto indicado');

    spoolsSheet.getRange(row, 6, 1, 4).setValues([[
      JSON.stringify(spool.drawingData || {}),
      JSON.stringify(spool.bom || null),
      existing.createdAt,
      spool.updatedAt || new Date().toISOString()
    ]]);
  });

  return { updated: true };
}

function deleteSpool_(payload) {
  const ownerId = requireString_(payload.ownerId, 'ownerId');
  const spoolId = requireString_(payload.spoolId, 'spoolId');

  withLock_(() => {
    const sheet = getSheet_(SPOOLS_SHEET, SPOOL_HEADERS);
    const row = findRowIndexById_(sheet, spoolId);
    if (row === -1) throw new Error('Spool no encontrado');

    const existing = rowToObject_(SPOOL_HEADERS, sheet.getRange(row, 1, 1, SPOOL_HEADERS.length).getValues()[0]);
    assertOwner_(existing.ownerId, ownerId);
    sheet.deleteRow(row);
  });

  return { deleted: true };
}

function renameSpool_(payload) {
  const ownerId = requireString_(payload.ownerId, 'ownerId');
  const spoolId = requireString_(payload.spoolId, 'spoolId');
  const newName = requireString_(payload.newName, 'newName');

  withLock_(() => {
    const sheet = getSheet_(SPOOLS_SHEET, SPOOL_HEADERS);
    const row = findRowIndexById_(sheet, spoolId);
    if (row === -1) throw new Error('Spool no encontrado');

    const existing = rowToObject_(SPOOL_HEADERS, sheet.getRange(row, 1, 1, SPOOL_HEADERS.length).getValues()[0]);
    assertOwner_(existing.ownerId, ownerId);
    // Column 3 = name (1-indexed)
    sheet.getRange(row, 3).setValue(newName);
  });

  return { renamed: true };
}

function getSpreadsheet_() {
  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  return SpreadsheetApp.getActiveSpreadsheet();
}

function getSheet_(name, headers) {
  const spreadsheet = getSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);

  const currentHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  const needsHeaders = headers.some((header, index) => currentHeaders[index] !== header);
  if (needsHeaders) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function readObjects_(sheetName, headers) {
  const sheet = getSheet_(sheetName, headers);
  const values = sheet.getDataRange().getValues();
  return values.slice(1)
    .filter((row) => row.some((cell) => cell !== ''))
    .map((row) => rowToObject_(headers, row));
}

function rowToObject_(headers, row) {
  return headers.reduce((object, header, index) => {
    object[header] = row[index];
    return object;
  }, {});
}

function findRowIndexById_(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let index = 0; index < ids.length; index++) {
    if (ids[index][0] === id) return index + 2;
  }
  return -1;
}

function withLock_(callback) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}

function validateToken_(token) {
  const expected = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
  if (expected && token !== expected) throw new Error('Token invalido');
}

function assertOwner_(actualOwnerId, expectedOwnerId) {
  if (actualOwnerId !== expectedOwnerId) throw new Error('No autorizado');
}

function requireString_(value, field) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`Campo requerido: ${field}`);
  }
  return value;
}

function parsePayload_(raw) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error('JSON invalido');
  }
}

function sanitizeCallback_(callback) {
  return callback.replace(/[^\w.$]/g, '');
}

function ok_(data) {
  return {
    ok: true,
    data
  };
}
