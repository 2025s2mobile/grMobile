import { Router } from 'express';
import { store } from '../lib/store.js';
import { body, validationResult } from 'express-validator';
import { v4 as uuid } from 'uuid';

const router = Router();

// Map old roles (Admin/Staff/Volunteer/Community) -> new roles
function normalizeRole(role) {
  const r = String(role || '').toLowerCase();
  if (r === 'admin') return 'admin';
  if (r === 'staff') return 'staff';
  // volunteer/community -> member
  return 'member';
}
function ensureUserShape(u) {
  // accept legacy fields (fullName) and fill new ones
  const name = u.name || u.fullName || '';
  const phone = u.phone || '';
  const role = normalizeRole(u.role || 'member');
  const deactivated = Boolean(u.deactivated) === true;
  return { ...u, name, phone, role, deactivated };
}

// GET /users?status=active|deactivated|all
router.get('/', async (req, res) => {
  const status = String(req.query.status || 'active').toLowerCase();
  let users = (await store.read('users')).map(ensureUserShape);

  if (status === 'active') users = users.filter(u => !u.deactivated);
  else if (status === 'deactivated') users = users.filter(u => u.deactivated);

  // sort by name asc
  users.sort((a, b) => String(a.name).localeCompare(String(b.name)));

  res.json(users);
});

// POST /users
router.post(
  '/',
  body('name').isString().isLength({ min: 2 }),
  body('email').isEmail(),
  body('phone').optional().isString(),
  body('role').optional().isIn(['member','staff','admin']),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const users = (await store.read('users')).map(ensureUserShape);
    const newUser = {
      id: uuid(),
      name: String(req.body.name).trim(),
      email: String(req.body.email).trim(),
      phone: String(req.body.phone || '').trim(),
      role: req.body.role ? String(req.body.role) : 'member',
      deactivated: false,
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    await store.write('users', users);
    res.status(201).json(newUser);
  }
);

// PUT /users/:id  (update name/email/phone/role)
router.put(
  '/:id',
  body('name').optional().isString().isLength({ min: 2 }),
  body('email').optional().isEmail(),
  body('phone').optional().isString(),
  body('role').optional().isIn(['member','staff','admin']),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const id = String(req.params.id);
    const users = (await store.read('users')).map(ensureUserShape);
    const i = users.findIndex(u => String(u.id) === id);
    if (i === -1) return res.status(404).json({ error: 'User not found' });

    users[i] = {
      ...users[i],
      ...('name' in req.body ? { name: String(req.body.name).trim() } : {}),
      ...('email' in req.body ? { email: String(req.body.email).trim() } : {}),
      ...('phone' in req.body ? { phone: String(req.body.phone).trim() } : {}),
      ...('role' in req.body ? { role: String(req.body.role) } : {}),
    };
    await store.write('users', users);
    res.json(users[i]);
  }
);

// POST /users/:id/deactivate
router.post('/:id/deactivate', async (req, res) => {
  const id = String(req.params.id);
  const users = (await store.read('users')).map(ensureUserShape);
  const i = users.findIndex(u => String(u.id) === id);
  if (i === -1) return res.status(404).json({ error: 'User not found' });
  users[i].deactivated = true;
  await store.write('users', users);
  res.json(users[i]);
});

// POST /users/:id/reactivate
router.post('/:id/reactivate', async (req, res) => {
  const id = String(req.params.id);
  const users = (await store.read('users')).map(ensureUserShape);
  const i = users.findIndex(u => String(u.id) === id);
  if (i === -1) return res.status(404).json({ error: 'User not found' });
  users[i].deactivated = false;
  await store.write('users', users);
  res.json(users[i]);
});

// POST /users/:id/role  { role: 'member'|'staff'|'admin' }
router.post(
  '/:id/role',
  body('role').isIn(['member','staff','admin']),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const id = String(req.params.id);
    const users = (await store.read('users')).map(ensureUserShape);
    const i = users.findIndex(u => String(u.id) === id);
    if (i === -1) return res.status(404).json({ error: 'User not found' });

    users[i].role = String(req.body.role);
    await store.write('users', users);
    res.json(users[i]);
  }
);

export default router;
