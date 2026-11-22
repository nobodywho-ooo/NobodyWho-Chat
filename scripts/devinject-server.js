#!/usr/bin/env node
// Dev-only HTTP server the NobodyWho app talks to via app/services/devHook.ts.
// Run on the developer's machine (the iOS simulator shares host loopback).
//
//   POST /inject   {"text":"show me a form"}   -> queues a message for the app
//   GET  /pending  -> returns {"text": ...} and clears the queue
//   POST /report   {...}                       -> appends the event to a file
//
// Usage: node scripts/devinject-server.js [port]
const http = require('http');
const fs = require('fs');

const port = Number(process.argv[2] || 8899);
const reportFile = '/tmp/devreports.txt';
let pending = null;

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', chunk => {
    body += chunk;
    if (body.length > 1e6) req.destroy();
  });
  req.on('end', () => {
    const send = (code, obj) => {
      res.writeHead(code, { 'content-type': 'application/json' });
      res.end(JSON.stringify(obj));
    };
    try {
      if (req.method === 'POST' && req.url === '/inject') {
        const d = JSON.parse(body || '{}');
        pending = typeof d.text === 'string' ? d.text : null;
        send(200, { ok: true });
      } else if (req.method === 'POST' && req.url === '/report') {
        fs.appendFileSync(reportFile, `${body}\n`);
        send(200, { ok: true });
      } else if (req.method === 'GET' && req.url === '/pending') {
        send(200, pending ? { text: pending } : {});
        pending = null;
      } else {
        send(404, { error: 'not found' });
      }
    } catch (err) {
      send(500, { error: String(err) });
    }
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`devinject-server listening on http://127.0.0.1:${port}`);
  console.log(`  reports -> ${reportFile}`);
  console.log(`  inject  -> curl -X POST http://127.0.0.1:${port}/inject -d '{"text":"hi"}' -H 'content-type: application/json'`);
});