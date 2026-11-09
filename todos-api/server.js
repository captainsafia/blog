// Simple JSON-based REST API for managing todos.
// Auth: every /todos request requires `Authorization: Bearer hello-safia`.
// Run: node server.js  (listens on 0.0.0.0:3001, override with PORT env var)
import http from 'node:http';

const PORT = process.env.PORT || 3001;
const BEARER_TOKEN = 'hello-safia';

// In-memory store, seeded with a few todos so the API is not empty on start.
let todos = [
  { id: 1, title: 'Ship the blog redesign', done: false },
  { id: 2, title: 'Write a post about preview URLs', done: true },
];
let nextId = 3;

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  });
  res.end(payload);
}

function isAuthorized(req) {
  const header = req.headers.authorization || '';
  return header === `Bearer ${BEARER_TOKEN}`;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1e6) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (url.pathname === '/health') {
    return send(res, 200, { status: 'ok' });
  }

  if (req.method === 'OPTIONS') {
    return send(res, 204, {});
  }

  // Everything below requires the bearer token.
  if (!isAuthorized(req)) {
    return send(res, 401, { error: 'Unauthorized. Send "Authorization: Bearer hello-safia".' });
  }

  // Routes: /todos and /todos/:id
  const match = url.pathname.match(/^\/todos(?:\/(\d+))?$/);
  if (!match) {
    return send(res, 404, { error: `No route for ${req.method} ${url.pathname}` });
  }

  const id = match[1] ? Number(match[1]) : null;

  // GET /todos - list all
  if (req.method === 'GET' && id === null) {
    return send(res, 200, { todos });
  }

  // POST /todos - create
  if (req.method === 'POST' && id === null) {
    let body;
    try {
      body = JSON.parse((await readBody(req)) || '{}');
    } catch {
      return send(res, 400, { error: 'Invalid JSON body' });
    }
    if (!body.title || typeof body.title !== 'string') {
      return send(res, 400, { error: '"title" (string) is required' });
    }
    const todo = { id: nextId++, title: body.title, done: Boolean(body.done) };
    todos.push(todo);
    return send(res, 201, todo);
  }

  // Routes with an :id below here.
  const todo = todos.find((t) => t.id === id);

  // GET /todos/:id
  if (req.method === 'GET') {
    return todo ? send(res, 200, todo) : send(res, 404, { error: `Todo ${id} not found` });
  }

  // PUT/PATCH /todos/:id
  if (req.method === 'PUT' || req.method === 'PATCH') {
    if (!todo) return send(res, 404, { error: `Todo ${id} not found` });
    let body;
    try {
      body = JSON.parse((await readBody(req)) || '{}');
    } catch {
      return send(res, 400, { error: 'Invalid JSON body' });
    }
    if (body.title !== undefined) {
      if (typeof body.title !== 'string' || body.title === '') {
        return send(res, 400, { error: '"title" must be a non-empty string' });
      }
      todo.title = body.title;
    }
    if (body.done !== undefined) {
      if (typeof body.done !== 'boolean') {
        return send(res, 400, { error: '"done" must be a boolean' });
      }
      todo.done = body.done;
    }
    return send(res, 200, todo);
  }

  // DELETE /todos/:id
  if (req.method === 'DELETE') {
    if (!todo) return send(res, 404, { error: `Todo ${id} not found` });
    todos = todos.filter((t) => t.id !== id);
    return send(res, 200, { deleted: todo });
  }

  return send(res, 405, { error: `Method ${req.method} not allowed` });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Todos API listening on http://0.0.0.0:${PORT}`);
});
