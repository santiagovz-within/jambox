import { google } from 'googleapis';

function getGoogleAuth() {
  const credJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credJson) return null;
  try {
    return new google.auth.GoogleAuth({
      credentials: JSON.parse(credJson),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
  } catch {
    return null;
  }
}

function extractSheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match?.[1] || null;
}

export interface CultureCalendarEntry {
  date: string | null;
  label: string;
  relevance: string;
  type: string;
  source: 'culture_calendar';
}

export async function fetchCultureCalendar(sheetUrl: string): Promise<CultureCalendarEntry[]> {
  const sheetId = extractSheetId(sheetUrl);
  if (!sheetId) {
    console.warn('[Sheets] Invalid sheet URL — could not extract spreadsheet ID');
    return [];
  }

  const auth = getGoogleAuth();
  if (!auth) {
    console.warn('[Sheets] GOOGLE_SERVICE_ACCOUNT_JSON not set — skipping Culture Calendar');
    return [];
  }

  try {
    const sheets = google.sheets({ version: 'v4', auth });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: 'A:D', // expected columns: Date | Label/Event | Relevance/Notes | Type
    });

    const rows = res.data.values || [];
    if (rows.length === 0) return [];

    // Skip header row if the first cell looks like a column label
    const firstCell = (rows[0]?.[0] || '').toLowerCase();
    const startIdx = firstCell.match(/date|day|month/) ? 1 : 0;

    return rows.slice(startIdx)
      .filter(row => row[1]) // must have a label/event name
      .map(row => ({
        date: row[0] || null,
        label: String(row[1]),
        relevance: row[2] ? String(row[2]) : '',
        type: row[3] ? String(row[3]) : 'cultural',
        source: 'culture_calendar' as const,
      }));
  } catch (e: any) {
    console.error('[Sheets] Fetch failed:', e.message);
    return [];
  }
}
