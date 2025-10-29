import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import eventsRouter from './routes/events.js';
import usersRouter from './routes/users.js';
import regsRouter from './routes/registrations.js';
import adminRouter from './routes/admin.js';

const app = express();

const PORT   = process.env.PORT || 4000;     // Expo port 4000 default need IpV4 for point e.g. https://YourIpv4addy:4000
const HOST   = process.env.HOST || '0.0.0.0'; // ← bind to all interfaces
const ORIGIN = process.env.ORIGIN || '*';

// Allow Expo Go / browser to call us
app.use(cors({ origin: ORIGIN === '*' ? true : ORIGIN }));
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/events', eventsRouter);
app.use('/users', usersRouter);
app.use('/registrations', regsRouter);
app.use('/admin', adminRouter);

app.listen(PORT, HOST, () => {
  console.log(`API listening on http://${HOST}:${PORT}`);
});
