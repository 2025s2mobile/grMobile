import { Router } from 'express';
import { store } from '../lib/store.js';

const router = Router();

// GET /events?date=YYYY-MM-DD&q=search
router.get('/', async (req, res) => {
  const { date, q } = req.query;
  let events = await store.read('events');

  if (date) {
    events = events.filter(e => String(e.date) === String(date));
  }
  if (q) {
    const needle = String(q).toLowerCase();
    events = events.filter(e =>
      [e.title, e.location, e.category, e.description]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    );
  }

  // sort by date+startTime ascending for consistent UI
  events.sort((a, b) => {
    const isoA = `${a.date}T${(a.startTime || '00:00')}:00`;
    const isoB = `${b.date}T${(b.startTime || '00:00')}:00`;
    return new Date(isoA) - new Date(isoB);
  });

  res.json(events);
});

// GET /events/:id
router.get('/:id', async (req, res) => {
  const events = await store.read('events');
  const wanted = String(req.params.id);
  const found = events.find(e => String(e.id) === wanted);
  if (!found) return res.status(404).json({ error: 'Event not found' });
  res.json(found);
});

export default router;
