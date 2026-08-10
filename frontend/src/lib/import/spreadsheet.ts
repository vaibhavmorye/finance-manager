import * as XLSX from 'xlsx'

export type SheetMatrix = (string | number | boolean | Date | null | undefined)[][]

export interface WorkbookData {
  sheetNames: string[]
  sheets: Record<string, SheetMatrix>
}

function normalizeCell(v: unknown): string | number | boolean | Date | null {
  if (v == null || v === '') return null
  if (v instanceof Date) return v
  if (typeof v === 'number' || typeof v === 'boolean') return v
  const s = String(v).replace(/^\uFEFF/, '').trim()
  return s === '' ? null : s
}

/** Format a Date using local calendar parts (avoids UTC day-shift from toISOString). */
export function formatLocalDate(d: Date): string {
  if (!Number.isFinite(d.getTime())) return ''
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Normalize trade/report dates to YYYY-MM-DD.
 * Prefers Indian DD/MM/YYYY when ambiguous (day or month > 12 clears it up).
 */
export function normalizeDateString(raw: string): string {
  const s = raw.replace(/^\uFEFF/, '').trim()
  if (!s) return ''

  // Already ISO date or datetime
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  // DD-MM-YYYY or DD/MM/YYYY (optional time)
  const dmy = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})(?:\s|T|$)/)
  if (dmy) {
    const a = Number(dmy[1])
    const b = Number(dmy[2])
    const yyyy = dmy[3]
    // If first part > 12 → must be D/M/Y; if second > 12 → must be M/D/Y (US)
    let dd: number
    let mm: number
    if (a > 12 && b <= 12) {
      dd = a
      mm = b
    } else if (b > 12 && a <= 12) {
      mm = a
      dd = b
    } else {
      // Ambiguous — prefer Indian D/M/Y
      dd = a
      mm = b
    }
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
    }
  }

  // Excel-ish formatted short year: D/M/YY
  const dmyShort = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2})(?:\s|T|$)/)
  if (dmyShort) {
    const a = Number(dmyShort[1])
    const b = Number(dmyShort[2])
    const yy = Number(dmyShort[3])
    const yyyy = yy >= 70 ? 1900 + yy : 2000 + yy
    let dd: number
    let mm: number
    if (a > 12 && b <= 12) {
      dd = a
      mm = b
    } else if (b > 12 && a <= 12) {
      mm = a
      dd = b
    } else {
      dd = a
      mm = b
    }
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
    }
  }

  return s
}

/** Convert Excel serial / Date / string into YYYY-MM-DD when possible. */
export function cellDate(v: unknown): string {
  if (v == null || v === '') return ''
  if (v instanceof Date) return formatLocalDate(v)
  if (typeof v === 'number' && Number.isFinite(v) && v > 20000 && v < 80000) {
    const parsed = XLSX.SSF.parse_date_code(v)
    if (parsed && parsed.y > 1990) {
      return `${parsed.y}-${String(parsed.m).padStart(2, '0')}-${String(parsed.d).padStart(2, '0')}`
    }
  }
  return normalizeDateString(String(v))
}

/**
 * Rebuild worksheet !ref from actual cells so sheet_to_json does not
 * under-read (stale dimension) or explode on huge empty ranges.
 */
function clampSheetRange(sheet: XLSX.WorkSheet): void {
  const dense = (sheet as XLSX.WorkSheet & { '!data'?: unknown[][] })['!data']
  if (dense && Array.isArray(dense)) {
    let maxR = -1
    let maxC = -1
    for (let r = 0; r < dense.length; r++) {
      const row = dense[r]
      if (!row) continue
      for (let c = 0; c < row.length; c++) {
        if (row[c] != null) {
          maxR = r
          maxC = Math.max(maxC, c)
        }
      }
    }
    if (maxR >= 0 && maxC >= 0) {
      sheet['!ref'] = XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: maxR, c: maxC },
      })
    }
    return
  }

  // Sparse sheet: scan keys
  let maxR = -1
  let maxC = -1
  for (const key of Object.keys(sheet)) {
    if (key[0] === '!') continue
    const addr = XLSX.utils.decode_cell(key)
    if (addr.r > maxR) maxR = addr.r
    if (addr.c > maxC) maxC = addr.c
  }
  if (maxR >= 0 && maxC >= 0) {
    sheet['!ref'] = XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: maxR, c: maxC },
    })
  }
}

function sheetToMatrix(sheet: XLSX.WorkSheet): SheetMatrix {
  if (!sheet) return []
  clampSheetRange(sheet)
  if (!sheet['!ref']) return []

  const raw = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: false,
  }) as unknown[][]

  return raw.map((row) => {
    if (!Array.isArray(row)) return []
    return row.map(normalizeCell)
  })
}

/**
 * RFC4180-ish CSV/TSV parser that keeps all fields as text.
 * SheetJS CSV mode auto-converts ambiguous dates to US Excel serials — we avoid that.
 */
export function parseDelimitedText(text: string, delimiter = ','): SheetMatrix {
  const input = text.replace(/^\uFEFF/, '')
  const rows: SheetMatrix = []
  let row: (string | null)[] = []
  let field = ''
  let i = 0
  let inQuotes = false

  const pushField = () => {
    const trimmed = field.trim()
    row.push(trimmed === '' ? null : trimmed)
    field = ''
  }
  const pushRow = () => {
    if (row.some((c) => c != null)) rows.push(row)
    row = []
  }

  while (i < input.length) {
    const ch = input[i]
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += ch
      i++
      continue
    }

    if (ch === '"') {
      inQuotes = true
      i++
      continue
    }
    if (ch === delimiter) {
      pushField()
      i++
      continue
    }
    if (ch === '\n') {
      pushField()
      pushRow()
      i++
      continue
    }
    if (ch === '\r') {
      pushField()
      pushRow()
      i += input[i + 1] === '\n' ? 2 : 1
      continue
    }
    field += ch
    i++
  }
  if (field.length > 0 || row.length > 0) {
    pushField()
    pushRow()
  }
  return rows
}

function detectDelimiter(sample: string): ',' | '\t' | ';' {
  const firstLine = sample.split(/\r?\n/).find((l) => l.trim()) ?? ''
  const counts = {
    ',': (firstLine.match(/,/g) ?? []).length,
    '\t': (firstLine.match(/\t/g) ?? []).length,
    ';': (firstLine.match(/;/g) ?? []).length,
  }
  if (counts['\t'] > counts[','] && counts['\t'] >= counts[';']) return '\t'
  if (counts[';'] > counts[',']) return ';'
  return ','
}

async function readCsvAsWorkbook(file: File): Promise<WorkbookData> {
  const text = await file.text()
  const delimiter = file.name.toLowerCase().endsWith('.tsv') ? '\t' : detectDelimiter(text)
  const matrix = parseDelimitedText(text, delimiter)
  const sheetName = 'Sheet1'
  return { sheetNames: [sheetName], sheets: { [sheetName]: matrix } }
}

/** Read CSV / XLS / XLSX into a simple workbook matrix. */
export async function readSpreadsheetFile(file: File): Promise<WorkbookData> {
  const name = file.name.toLowerCase()
  if (name.endsWith('.numbers')) {
    throw new NumbersFormatError()
  }

  // CSV/TSV/TXT: custom parser — SheetJS mangles Indian DD/MM/YYYY into US serials
  if (name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt')) {
    return readCsvAsWorkbook(file)
  }

  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, {
    type: 'array',
    dense: true,
    cellDates: true,
    codepage: 65001,
    sheetRows: 0,
  })

  const sheets: Record<string, SheetMatrix> = {}
  for (const sheetName of wb.SheetNames) {
    sheets[sheetName] = sheetToMatrix(wb.Sheets[sheetName])
  }

  return { sheetNames: wb.SheetNames, sheets }
}

export class NumbersFormatError extends Error {
  constructor() {
    super(
      'Apple Numbers (.numbers) files can’t be read in the browser. In Numbers, use File → Export To → Excel… or CSV, then import that file.',
    )
    this.name = 'NumbersFormatError'
  }
}

export function cellStr(v: unknown): string {
  if (v == null) return ''
  if (v instanceof Date) return formatLocalDate(v)
  return String(v).replace(/^\uFEFF/, '').trim()
}

export function cellNum(v: unknown): number {
  if (v == null || v === '') return 0
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  const cleaned = String(v)
    .replace(/,/g, '')
    .replace(/₹/g, '')
    .replace(/%/g, '')
    .replace(/\s/g, '')
    .trim()
  const paren = cleaned.match(/^\((.+)\)$/)
  const n = Number(paren ? `-${paren[1]}` : cleaned)
  return Number.isFinite(n) ? n : 0
}

export function normalizeHeader(h: string): string {
  return h
    .replace(/^\uFEFF/, '')
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
