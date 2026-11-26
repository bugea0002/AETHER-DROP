import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.disable('x-powered-by');

const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';

const STATIC_OPTS = {
  dotfiles: 'ignore',
  index: false,
  fallthrough: true,
};

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Serve only explicitly allowlisted client directories & public files
app.use('/vendor/firebase', express.static(path.join(__dirname, 'node_modules/firebase'), STATIC_OPTS));
app.use('/src', express.static(path.join(__dirname, 'src'), STATIC_OPTS));
app.use('/styles', express.static(path.join(__dirname, 'styles'), STATIC_OPTS));
app.use('/assets', express.static(path.join(__dirname, 'assets'), STATIC_OPTS));

app.get(['/', '/index.html'], (_req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/firebase-applet-config.json', (_req, res) => {
  res.sendFile(path.join(__dirname, 'firebase-applet-config.json'));
});

app.listen(PORT, HOST, () => {
  console.log(`AETHER DROP server listening on http://${HOST}:${PORT}`);
});
