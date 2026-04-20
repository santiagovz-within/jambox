import { google } from 'googleapis';

function getGoogleAuth() {
  const credJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!credJson) return null;
  try {
    return new google.auth.GoogleAuth({
      credentials: JSON.parse(credJson),
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
  } catch {
    return null;
  }
}

export function extractFolderId(folderUrl: string): string | null {
  const match = folderUrl.match(/\/folders\/([a-zA-Z0-9-_]+)/);
  return match?.[1] || null;
}

function toSlug(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').trim();
}

/**
 * Given the concept copy and the brand's menu_items list, returns the first
 * item found in the copy text (longest match first to avoid "Taco" shadowing
 * "Honey Chipotle Shrimp Taco").
 */
export function matchProductInCopy(copy: string, menuItems: string[]): string | null {
  const copyLower = copy.toLowerCase();
  const sorted = [...menuItems].sort((a, b) => b.length - a.length);
  return sorted.find(item => copyLower.includes(item.toLowerCase())) || null;
}

/**
 * Search a Google Drive folder for a PDP image matching the product name.
 * Uses the slug of the product name (e.g. "Honey Chipotle Shrimp Taco" →
 * "honey-chipotle-shrimp-taco") and progressively shortens it on no match.
 */
export async function findPDPForProduct(
  folderUrl: string,
  productName: string
): Promise<{ fileId: string; mimeType: string; name: string } | null> {
  const folderId = extractFolderId(folderUrl);
  if (!folderId) return null;

  const auth = getGoogleAuth();
  if (!auth) {
    console.warn('[Drive] GOOGLE_SERVICE_ACCOUNT_JSON not set — skipping PDP lookup');
    return null;
  }

  const slug = toSlug(productName);
  const parts = slug.split('-');
  // Try progressively shorter slugs (full → 4 words → 3 words)
  const searchTerms = [
    slug,
    parts.slice(0, 4).join('-'),
    parts.slice(0, 3).join('-'),
  ].filter((t, i, arr) => t.length >= 4 && arr.indexOf(t) === i);

  const drive = google.drive({ version: 'v3', auth });

  for (const term of searchTerms) {
    try {
      const res = await drive.files.list({
        q: `'${folderId}' in parents and name contains '${term}' and trashed = false`,
        fields: 'files(id, name, mimeType)',
        pageSize: 5,
      });
      const files = res.data.files || [];
      if (files.length > 0 && files[0].id) {
        console.log(`[Drive] Found PDP for "${productName}" → ${files[0].name}`);
        return { fileId: files[0].id, mimeType: files[0].mimeType || 'image/jpeg', name: files[0].name || '' };
      }
    } catch (e: any) {
      console.warn(`[Drive] Search for "${term}" failed:`, e.message);
    }
  }

  console.log(`[Drive] No PDP found for "${productName}" in folder ${folderId}`);
  return null;
}

/**
 * Download a Drive file and return its raw bytes + mimeType.
 */
export async function downloadDriveFile(fileId: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const auth = getGoogleAuth();
  if (!auth) return null;

  const drive = google.drive({ version: 'v3', auth });

  try {
    const meta = await drive.files.get({ fileId, fields: 'mimeType' });
    const mimeType = meta.data.mimeType || 'image/jpeg';

    const res = await drive.files.get(
      { fileId, alt: 'media' },
      { responseType: 'arraybuffer' }
    );

    return { buffer: Buffer.from(res.data as ArrayBuffer), mimeType };
  } catch (e: any) {
    console.error('[Drive] Download failed:', e.message);
    return null;
  }
}
