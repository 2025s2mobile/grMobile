import { readFile, writeFile, mkdir } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');
const locks = new Map();

async function ensureDir() { await mkdir(dataDir, { recursive: true }); }

async function readJSON(name) {
  await ensureDir();
  const p = join(dataDir, `${name}.json`);
  try {
    const buf = await readFile(p);
    return JSON.parse(buf.toString());
  } catch (e) {
    if (e && e.code === 'ENOENT') {
      await writeFile(p, '[]\n');
      return [];
    }
    throw e;
  }
}

async function writeJSON(name, data) {
  await ensureDir();
  const p = join(dataDir, `${name}.json`);
  const prev = locks.get(p) || Promise.resolve();
  let resolve;
  const next = new Promise(r => (resolve = r));
  locks.set(p, prev.then(async () => {
    await writeFile(p, JSON.stringify(data, null, 2) + '\n');
    resolve();
  }));
  await next;
}

export const store = { read: readJSON, write: writeJSON };
