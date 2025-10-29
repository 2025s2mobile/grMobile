import { Router } from 'express';
import { store } from '../lib/store.js';
import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');
const seedDir = join(dataDir, 'seed');

const router = Router();

// Simple opt-in auth: if ADMIN_TOKEN not set, allow; if set, require match
function auth(req, res, next) {
  const expected = process.env.ADMIN_TOKEN;
  const provided = req.headers['x-admin-token'] || req.query.token;
  if (!expected || provided === expected) return next();
  return res.status(401).json({ error: 'Unauthorized' });
}

async function tryReadJSON(p) {
  try {
    const buf = await readFile(p, 'utf8');
    return JSON.parse(buf);
  } catch {
    return null;
  }
}

/**
 * POST /admin/reset
 * Restores data from seeds if present, otherwise falls back to current data files.
 * - events: from data/seed/events.seed.json OR data/events.json
 * - users:  from data/seed/users.seed.json  OR data/users.json
 * - regs:   from data/seed/registrations.seed.json OR [] (cleared)
 */
router.post('/reset', auth, async (_req, res) => {
  // Prefer seeds
  const eventsSeed =
    (await tryReadJSON(join(seedDir, 'events.seed.json'))) ??
    (await tryReadJSON(join(dataDir, 'events.json'))) ??
    [];
  const usersSeed =
    (await tryReadJSON(join(seedDir, 'users.seed.json'))) ??
    (await tryReadJSON(join(dataDir, 'users.json'))) ??
    [];
  const regsSeed =
    (await tryReadJSON(join(seedDir, 'registrations.seed.json'))) ??
    []; // default to none if no seed

  // Write seeds to live data
  await store.write('events', eventsSeed);
  await store.write('users', usersSeed);
  await store.write('registrations', regsSeed);

  res.json({
    ok: true,
    resetTo: {
      events: eventsSeed.length,
      users: usersSeed.length,
      registrations: regsSeed.length,
    },
  });
});

export default router;
