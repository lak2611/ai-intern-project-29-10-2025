import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');

export type PutObjectArgs = {
  sessionId: string;
  originalName: string;
  mimeType: string;
  data: Uint8Array;
};

export const ensureUploadsDir = () => {
  const dir = path.join(UPLOADS_DIR);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

export const buildStoredPath = (sessionId: string, originalName: string) => {
  const safeName = path.basename(originalName).replace(/[^a-zA-Z0-9._-]/g, '_');
  const ext = path.extname(safeName) || '.csv';
  const key = `${sessionId}/${randomUUID()}${ext}`;
  return path.join(UPLOADS_DIR, key);
};

export const putObject = async ({ sessionId, originalName, data }: PutObjectArgs) => {
  ensureUploadsDir();
  const storedPath = buildStoredPath(sessionId, originalName);
  const dir = path.dirname(storedPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  await fs.promises.writeFile(storedPath, data as Uint8Array);
  return { storedPath };
};

export const getStream = (storedPath: string) => {
  return fs.createReadStream(storedPath);
};

export const deleteObject = async (storedPath: string) => {
  try {
    await fs.promises.unlink(storedPath);
  } catch (err: any) {
    if (err?.code === 'ENOENT') return; // already gone
    throw err;
  }
};

export const fileExists = async (storedPath: string) => {
  try {
    await fs.promises.access(storedPath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
};
