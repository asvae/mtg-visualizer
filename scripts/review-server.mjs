// Tiny control-plane server for the in-app card review session (ReviewSession.vue).
// No external deps — plain node:http, long-poll instead of websockets ("or whatever").
//
// Protocol (all JSON, CORS-open since the Vite dev server runs on a different port):
//   POST /show    { card, relationsToAdd?, relationsToRemove?, note?, confidence? } -> push a diff to the browser
//   GET  /state   -> { id, card, relationsToAdd, relationsToRemove, note, confidence, busy, history } (browser polls this)
//   POST /respond { type: 'allGood' } | { type: 'feedback', text } -> from the browser
//   GET  /wait    -> long-polls until the next /respond call, then returns its body
//                    (this is what the review CLI loop blocks on between cards)
//
// `history` is the full running transcript for this server process's lifetime —
// every /show and every /respond, in order — so the panel can render a chat-style
// log of the whole session, not just the current card's single state. It's
// in-memory only (lost on server restart), same lifetime as `current`/`busy`.
//
// Usage: node scripts/review-server.mjs [port]

import { createServer } from 'node:http';

const PORT = Number(process.argv[2]) || 8787;

let current = null; // { id, card, relationsToAdd, relationsToRemove, note }
let busy = false;
let nextId = 1;
const responseQueue = [];
let pendingWaiters = [];
const history = []; // { role: 'agent'|'user', ...payload, ts }[]

function resolveWaiters(payload) {
  const waiters = pendingWaiters;
  pendingWaiters = [];
  for (const w of waiters) w.resolve(payload);
}

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return send(res, 204, {});

    if (req.method === 'GET' && req.url === '/state') {
      return send(
        res,
        200,
        current
          ? { ...current, busy, history }
          : { id: 0, card: null, relationsToAdd: [], relationsToRemove: [], note: '', confidence: null, busy, history }
      );
    }

    if (req.method === 'POST' && req.url === '/show') {
      const { card, relationsToAdd = [], relationsToRemove = [], note = '', confidence = null } = await readJson(req);
      current = { id: nextId++, card, relationsToAdd, relationsToRemove, note, confidence };
      busy = false;
      history.push({ role: 'agent', card, relationsToAdd, relationsToRemove, note, confidence, ts: Date.now() });
      return send(res, 200, { ok: true });
    }

    if (req.method === 'POST' && req.url === '/respond') {
      const body = await readJson(req);
      busy = true;
      history.push({ role: 'user', card: current?.card ?? null, kind: body.type, text: body.text ?? '', ts: Date.now() });
      if (pendingWaiters.length) resolveWaiters(body);
      else responseQueue.push(body);
      return send(res, 200, { ok: true });
    }

    if (req.method === 'GET' && req.url === '/wait') {
      if (responseQueue.length) return send(res, 200, responseQueue.shift());
      // 1hr safety net only — normal operation always resolves via /respond.
      const payload = await new Promise((resolve) => {
        const timer = setTimeout(() => {
          pendingWaiters = pendingWaiters.filter((w) => w.resolve !== settle);
          resolve({ type: 'timeout' });
        }, 60 * 60 * 1000);
        const settle = (v) => {
          clearTimeout(timer);
          resolve(v);
        };
        pendingWaiters.push({ resolve: settle });
      });
      return send(res, 200, payload);
    }

    send(res, 404, { error: 'not found' });
  } catch (err) {
    send(res, 500, { error: String(err) });
  }
});

server.listen(PORT, () => {
  console.log(`Review server listening on http://localhost:${PORT}`);
});
