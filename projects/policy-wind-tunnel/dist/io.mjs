/** Local-only import and export. No input is interpreted as HTML or code. */
export const CASE_FIELDS = Object.freeze([
  'id', 'customer', 'orderId', 'purchaseDate', 'requestDate', 'amount',
  'itemsReturned', 'totalItems', 'receipt', 'condition', 'note',
]);

const NUMBER_FIELDS = new Set(['amount', 'itemsReturned', 'totalItems']);
const MAX_CASES = 500;
const MAX_BYTES = 2 * 1024 * 1024;
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function numericValue(value) {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(trimmed)) {
    const number = Number(trimmed);
    if (Number.isFinite(number)) return number;
  }
  return trimmed;
}

function receiptValue(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value;
  if (value === 1) return true;
  if (value === 0) return false;
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toLowerCase();
  if (['true', 'yes', '1'].includes(trimmed)) return true;
  if (['false', 'no', '0'].includes(trimmed)) return false;
  if (['', 'null', 'unknown'].includes(trimmed)) return null;
  return value.trim();
}

function normalizeCases(input) {
  if (!Array.isArray(input)) throw new TypeError('The file must contain an array of cases.');
  if (!input.length) throw new TypeError('The file contains no cases.');
  if (input.length > MAX_CASES) throw new RangeError(`Import at most ${MAX_CASES} cases at a time.`);
  const seen = new Set();
  return input.map((source, index) => {
    if (!isObject(source)) throw new TypeError(`Case ${index + 1} must be an object.`);
    if (!own(source, 'id') || typeof source.id !== 'string' || !source.id.trim()) throw new TypeError(`Case ${index + 1} needs a nonempty text ID.`);
    const id = source.id.trim();
    if (id.length > 80) throw new TypeError(`Case ${index + 1} has an ID longer than 80 characters.`);
    if (seen.has(id)) throw new TypeError(`Duplicate case ID: ${id}.`);
    seen.add(id);
    const record = { id };
    for (const field of CASE_FIELDS) {
      if (field === 'id' || !own(source, field)) continue;
      const raw = source[field];
      let value;
      if (NUMBER_FIELDS.has(field)) value = numericValue(raw);
      else if (field === 'receipt') value = receiptValue(raw);
      else if (typeof raw === 'string') value = field === 'note' ? raw : raw.trim();
      else if (raw === null || ['number', 'boolean'].includes(typeof raw)) value = raw;
      else value = null;
      if (field === 'condition' && typeof value === 'string') value = value.toLowerCase();
      if (value !== undefined) record[field] = value;
    }
    return record;
  });
}

/** RFC-style quoted CSV with comma, CRLF/LF and embedded newlines. */
function csvRows(text) {
  const rows = [];
  let row = [], cell = '', quoted = false, closedQuote = false, line = 1;
  const pushCell = () => { row.push(cell); cell = ''; closedQuote = false; };
  const pushRow = () => {
    pushCell();
    if (row.some(value => value.trim() !== '')) rows.push(row);
    row = [];
    if (rows.length > MAX_CASES + 1) throw new RangeError(`Import at most ${MAX_CASES} cases at a time.`);
  };
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') { cell += '"'; index += 1; }
        else { quoted = false; closedQuote = true; }
      } else {
        cell += char;
        if (char === '\n') line += 1;
      }
      continue;
    }
    if (char === ',') { pushCell(); continue; }
    if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      pushRow(); line += 1; continue;
    }
    if (closedQuote) {
      if (char === ' ' || char === '\t') continue;
      throw new SyntaxError(`Unexpected text after a quoted CSV field near line ${line}.`);
    }
    if (char === '"') {
      if (cell.length) throw new SyntaxError(`A CSV quote must start a field near line ${line}.`);
      quoted = true;
    } else cell += char;
  }
  if (quoted) throw new SyntaxError(`Unclosed quoted CSV field near line ${line}.`);
  if (cell.length || row.length || closedQuote) pushRow();
  return rows;
}

function parseCsv(text) {
  const rows = csvRows(text);
  if (!rows.length) throw new TypeError('The CSV file is empty.');
  const fields = new Map(CASE_FIELDS.map(field => [field.toLowerCase(), field]));
  const seen = new Set();
  const headers = rows[0].map(header => {
    const key = header.trim().replace(/[ _-]/g, '').toLowerCase();
    const field = fields.get(key);
    if (field && seen.has(field)) throw new TypeError(`Duplicate CSV column: ${field}.`);
    if (field) seen.add(field);
    return field;
  });
  if (!seen.has('id')) throw new TypeError('The CSV file needs an id column.');
  return rows.slice(1).map((cells, index) => {
    if (cells.length > headers.length) throw new SyntaxError(`CSV record ${index + 2} has more fields than its header. Quote values containing commas.`);
    const record = {};
    headers.forEach((field, column) => {
      if (field && column < cells.length) record[field] = cells[column];
    });
    return record;
  });
}

export function parseCaseFile(text, filename = '') {
  if (typeof text !== 'string') throw new TypeError('File contents must be text.');
  if (new TextEncoder().encode(text).byteLength > MAX_BYTES) throw new RangeError('Import a file no larger than 2 MB.');
  const clean = text.replace(/^\uFEFF/, '');
  if (!clean.trim()) throw new TypeError('The file is empty.');
  const name = String(filename).toLowerCase();
  const looksJson = /^[\s]*[\[{]/.test(clean);
  let source;
  if (name.endsWith('.json') || looksJson) {
    let parsed;
    try { parsed = JSON.parse(clean); }
    catch { throw new SyntaxError('The JSON file is invalid. Check its brackets, commas, and quoted strings.'); }
    if (Array.isArray(parsed)) source = parsed;
    else if (isObject(parsed) && own(parsed, 'cases') && Array.isArray(parsed.cases)) source = parsed.cases;
    else if (isObject(parsed) && own(parsed, 'results') && Array.isArray(parsed.results)) {
      source = parsed.results.map((result, index) => {
        if (!isObject(result) || !own(result, 'record')) throw new TypeError(`Exported result ${index + 1} has no case record.`);
        return result.record;
      });
    } else throw new TypeError('JSON must contain an array, a cases array, or review results with case records.');
  } else {
    if (name && /\.[a-z0-9]+$/i.test(name) && !name.endsWith('.csv')) throw new TypeError('Choose a JSON or CSV file.');
    source = parseCsv(clean);
  }
  return normalizeCases(source);
}

function stableValue(value, seen = new Set(), depth = 0) {
  if (depth > 40) throw new TypeError('The review contains excessively nested data.');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value === undefined) return null;
  if (typeof value !== 'object') throw new TypeError('Review data must contain JSON-compatible values.');
  if (seen.has(value)) throw new TypeError('The review contains a circular reference.');
  seen.add(value);
  let result;
  if (Array.isArray(value)) result = value.map(item => stableValue(item, seen, depth + 1));
  else {
    result = Object.create(null);
    for (const key of Object.keys(value).sort()) {
      if (['__proto__', 'constructor', 'prototype'].includes(key) || value[key] === undefined) continue;
      result[key] = stableValue(value[key], seen, depth + 1);
    }
  }
  seen.delete(value);
  return result;
}

export function serializeReview(suite, meta = {}) {
  if (!isObject(suite) || !Array.isArray(suite.results)) throw new TypeError('A completed comparison with results is required.');
  const output = {
    schemaVersion: 1,
    provenance: 'deterministic-reference',
    generatedAt: new Date().toISOString(),
    policy: stableValue(suite.policy ?? null),
    implementations: stableValue(suite.implementations ?? null),
    cases: stableValue(suite.results.map(result => result.record)),
    results: stableValue(suite.results),
    summary: stableValue(suite.summary ?? null),
    meta: stableValue(meta),
  };
  return `${JSON.stringify(output, null, 2)}\n`;
}

function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  // Prefix dangerous spreadsheet formulas, including whitespace-obscured ones.
  // The apostrophe is deliberately retained on a subsequent CSV import.
  if (/^[\s\uFEFF]*[=+\-@]/u.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function casesToCSV(cases) {
  if (!Array.isArray(cases)) throw new TypeError('Cases must be an array.');
  const lines = [CASE_FIELDS.map(csvCell).join(',')];
  for (const record of cases) {
    if (!isObject(record)) throw new TypeError('Each case must be an object.');
    lines.push(CASE_FIELDS.map(field => csvCell(own(record, field) ? record[field] : undefined)).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}
