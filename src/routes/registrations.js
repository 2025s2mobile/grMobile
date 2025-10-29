import { Router } from 'express';
import { store } from '../lib/store.js';
import { body, validationResult } from 'express-validator';
import { v4 as uuid } from 'uuid';

const router = Router();

// helpers
const isId = (v) => (typeof v === 'string' && v.trim() !== '') || Number.isInteger(v);
const safeStr = (s) => (typeof s === 'string' ? s.trim() : '');

// GET /registrations?eventId=...&userId=...
router.get('/', async (req, res) => {
  const regs = await store.read('registrations');
  const { eventId, userId } = req.query;
  let out = regs;
  if (eventId) out = out.filter(r => String(r.eventId) === String(eventId));
  if (userId) out = out.filter(r => String(r.userId) === String(userId));
  res.json(out);
});

/**
 * POST /registrations
 * Accepts EITHER:
 *  A) Legacy: { eventId, userId, status: "Registered"|"Cancelled" }
 *  B) MVP:    { eventId, name, email, phone }  // status defaults to "Registered"
 */
router.post(
  '/',
  [
    // Validate minimally, we'll branch inside handler
    body('eventId').custom(isId).withMessage('Invalid eventId'),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    const events = await store.read('events');
    const users  = await store.read('users');
    const regs   = await store.read('registrations');

    const eventId = String(req.body.eventId);
    const event = events.find(e => String(e.id) === eventId);
    if (!event) return res.status(400).json({ error: 'Invalid eventId' });

    // Branch: legacy vs MVP body
    const hasLegacyFields = req.body.userId && req.body.status;
    const status = hasLegacyFields ? String(req.body.status) : 'Registered';

    if (hasLegacyFields) {
      // LEGACY path: requires valid user
      const userId = String(req.body.userId);
      const user = users.find(u => String(u.id) === userId);
      if (!user) return res.status(400).json({ error: 'Invalid userId' });

      // adjust spotsRemaining
      const cap = Number(event.capacity);
      const spots = Number(event.spotsRemaining);
      if (status === 'Registered') {
        if (spots <= 0) return res.status(409).json({ error: 'No spots remaining' });
        event.spotsRemaining = spots - 1;
      } else {
        event.spotsRemaining = Math.min(cap, spots + 1);
      }

      const newReg = {
        id: uuid(),
        eventId: event.id,
        userId: user.id,
        status,
        createdAt: new Date().toISOString(),
      };

      regs.push(newReg);
      await store.write('registrations', regs);
      await store.write('events', events);
      return res.status(201).json(newReg);
    }

    // MVP path: ad-hoc registration without user account
    const name = safeStr(req.body.name);
    const email = safeStr(req.body.email);
    const phone = safeStr(req.body.phone);

    if (!name || !email) {
      return res.status(400).json({ error: 'name and email are required for MVP registration' });
    }

    // adjust spotsRemaining (same as legacy)
    const cap = Number(event.capacity);
    const spots = Number(event.spotsRemaining);
    if (spots <= 0) return res.status(409).json({ error: 'No spots remaining' });
    event.spotsRemaining = Math.max(0, spots - 1);

    const newReg = {
      id: uuid(),
      eventId: event.id,
      status: 'Registered',
      contact: { name, email, phone }, // store contact details directly on the registration
      createdAt: new Date().toISOString(),
    };

    regs.push(newReg);
    await store.write('registrations', regs);
    await store.write('events', events);

    // Mobile MVP only needs an id & createdAt, but we can return the full object
    return res.status(201).json(newReg);
  }
);

export default router;
