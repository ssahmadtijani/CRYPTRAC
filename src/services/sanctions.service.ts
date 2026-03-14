/**
 * Sanctions Service for CRYPTRAC
 * Screens addresses against the OFAC SDN list and other sanctions databases.
 * The SDN CSV is fetched from the official Treasury URL and parsed in-memory.
 */

import https from 'https';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SanctionEntry {
  address: string;
  name: string;
  source: string;
  listType: string;
  details?: string;
  addedAt: Date;
}

export interface SanctionsCheckResult {
  isSanctioned: boolean;
  entries: SanctionEntry[];
}

export interface SanctionsListStatus {
  lastRefreshed: Date | null;
  entryCount: number;
  isLoaded: boolean;
  source: string;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const OFAC_SDN_URL =
  process.env.OFAC_SDN_URL ||
  'https://www.treasury.gov/ofac/downloads/sdn.csv';

const OFAC_ALT_URL =
  process.env.OFAC_ALT_URL ||
  'https://www.treasury.gov/ofac/downloads/alt.csv';

const LOCAL_SDN_PATH = process.env.OFAC_LOCAL_SDN_PATH || '';
const LOCAL_ALT_PATH = process.env.OFAC_LOCAL_ALT_PATH || '';

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------

/** Map from normalised address (lowercase) → list of matching sanction entries */
const sanctionedAddresses = new Map<string, SanctionEntry[]>();

/** Metadata about the SDN records keyed by their OFAC ID (for alt-record joining) */
interface SdnRecord {
  id: string;
  name: string;
  listType: string;
}
const sdnById = new Map<string, SdnRecord>();

let lastRefreshed: Date | null = null;
let entryCount = 0;

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

/**
 * Splits a CSV line respecting quoted fields.
 * OFAC CSV uses double-quote wrapping for fields that contain commas.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Parses the OFAC SDN.CSV into an id→SdnRecord map.
 *
 * Column layout (1-indexed in docs, 0-indexed here):
 *   0: ent_num, 1: SDN_Name, 2: SDN_Type, 3: Program, 4: Title,
 *   5: Call_Sign, 6: Vess_type, 7: Tonnage, 8: GRT, 9: Vess_flag,
 *  10: Vess_owner, 11: Remarks
 */
function parseSdnCsv(csv: string): void {
  sdnById.clear();

  const lines = csv.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const fields = parseCsvLine(trimmed);
    if (fields.length < 2) continue;

    const id = fields[0].replace(/-/g, '').trim();
    if (!id || isNaN(Number(id))) continue;

    const name = fields[1] ?? '';
    const listType = fields[2] ?? 'SDN';

    sdnById.set(id, { id, name, listType });
  }

  logger.debug('SDN records parsed', { count: sdnById.size });
}

/**
 * Parses the OFAC ALT.CSV to extract Digital Currency Address entries.
 *
 * Column layout:
 *   0: ent_num, 1: alt_num, 2: alt_type, 3: alt_name, 4: alt_remarks
 *
 * Digital Currency Addresses appear as alt records where alt_type is
 * "Digital Currency Address - XBT", "Digital Currency Address - ETH", etc.
 */
function parseAltCsv(csv: string): void {
  sanctionedAddresses.clear();
  entryCount = 0;

  const lines = csv.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const fields = parseCsvLine(trimmed);
    if (fields.length < 4) continue;

    const entId = fields[0].replace(/-/g, '').trim();
    const altType = (fields[2] ?? '').trim();
    const altName = (fields[3] ?? '').trim();

    // Only process Digital Currency Address records
    if (!altType.toLowerCase().startsWith('digital currency address')) continue;

    const address = altName.toLowerCase().trim();
    if (!address) continue;

    const sdnRecord = sdnById.get(entId);
    const name = sdnRecord?.name ?? '';
    const listType = sdnRecord?.listType ?? 'SDN';

    const entry: SanctionEntry = {
      address,
      name,
      source: 'OFAC',
      listType,
      details: `OFAC SDN List — ${altType} — Entity: ${entId}`,
      addedAt: new Date(),
    };

    const existing = sanctionedAddresses.get(address) ?? [];
    existing.push(entry);
    sanctionedAddresses.set(address, existing);
    entryCount++;
  }

  logger.info('OFAC sanctions list loaded', {
    addressCount: sanctionedAddresses.size,
    entryCount,
  });
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

function fetchUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const chunks: Buffer[] = [];

    protocol
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // Handle redirects
          fetchUrl(res.headers.location).then(resolve).catch(reject);
          return;
        }
        if (res.statusCode && res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} fetching ${url}`));
          return;
        }
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        res.on('error', reject);
      })
      .on('error', reject);
  });
}

function readLocalFile(filePath: string): Promise<string> {
  return fs.promises.readFile(path.resolve(filePath), 'utf8');
}

async function fetchCsv(url: string, localPath: string): Promise<string> {
  if (localPath) {
    try {
      logger.info('Loading sanctions list from local file', { localPath });
      return await readLocalFile(localPath);
    } catch (err) {
      logger.warn('Local sanctions file not found, falling back to URL', {
        localPath,
        err,
      });
    }
  }

  logger.info('Fetching sanctions list from URL', { url });
  return fetchUrl(url);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetches and parses both the SDN and ALT CSV files from OFAC.
 * Subsequent calls refresh the in-memory cache.
 */
export async function refreshSanctionsList(): Promise<void> {
  try {
    logger.info('Starting OFAC sanctions list refresh');

    const [sdnCsv, altCsv] = await Promise.all([
      fetchCsv(OFAC_SDN_URL, LOCAL_SDN_PATH),
      fetchCsv(OFAC_ALT_URL, LOCAL_ALT_PATH),
    ]);

    parseSdnCsv(sdnCsv);
    parseAltCsv(altCsv);

    lastRefreshed = new Date();
    logger.info('OFAC sanctions list refreshed', {
      addressCount: sanctionedAddresses.size,
      entryCount,
      refreshedAt: lastRefreshed,
    });
  } catch (err) {
    logger.error('Failed to refresh OFAC sanctions list', { err });
    throw err;
  }
}

/**
 * Checks whether a given address appears on the loaded sanctions list.
 */
export function checkAddress(address: string): SanctionsCheckResult {
  const normalised = address.toLowerCase().trim();
  const entries = sanctionedAddresses.get(normalised) ?? [];
  return {
    isSanctioned: entries.length > 0,
    entries,
  };
}

/**
 * Returns metadata about the currently loaded sanctions list.
 */
export function getSanctionsListStatus(): SanctionsListStatus {
  return {
    lastRefreshed,
    entryCount,
    isLoaded: lastRefreshed !== null,
    source: LOCAL_SDN_PATH || OFAC_SDN_URL,
  };
}

/**
 * Returns all sanctioned addresses (for admin/debugging purposes).
 */
export function getAllSanctionedAddresses(): Map<string, SanctionEntry[]> {
  return new Map(sanctionedAddresses);
}
