// Kill the Santa - zero-dependency server: static files + top-10 ranking API
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, 'public');
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'ranking.json');
const TOP_N = 10;
const MAX_SCORE = 500000;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.gif': 'image/gif', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.ico': 'image/x-icon', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
};

fs.mkdirSync(DATA_DIR, { recursive: true });
let ranking = [];
try { ranking = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch (e) { ranking = []; }

function save() {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(ranking));
  fs.renameSync(tmp, DATA_FILE);
}
function sortRank() {
  ranking.sort((a, b) => b.score - a.score || a.time - b.time || a.date - b.date);
  ranking = ranking.slice(0, TOP_N);
}

const lastPost = new Map(); // ip -> timestamp (simple rate limit)

function json(res, code, obj) {
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(obj));
}

function handleApi(req, res) {
  if (req.method === 'OPTIONS') return json(res, 204, {});
  if (req.url.startsWith('/api/ranking') && req.method === 'GET') return json(res, 200, { ranking });
  if (req.url.startsWith('/api/score') && req.method === 'POST') {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const now = Date.now();
    if (now - (lastPost.get(ip) || 0) < 3000) return json(res, 429, { error: 'too many requests' });
    lastPost.set(ip, now);
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 2048) req.destroy(); });
    req.on('end', () => {
      let d;
      try { d = JSON.parse(body); } catch (e) { return json(res, 400, { error: 'bad json' }); }
      const name = String(d.name || '').replace(/[\u0000-\u001f<>&"'`]/g, '').trim().slice(0, 8);
      const score = Math.floor(Number(d.score));
      const time = Math.max(0, Math.floor(Number(d.time) || 0));
      if (!name || !Number.isFinite(score) || score < 0 || score > MAX_SCORE) return json(res, 400, { error: 'invalid' });
      const entry = { name, score, time, cleared: !!d.cleared, date: now };
      ranking.push(entry);
      sortRank();
      const rank = ranking.indexOf(entry) + 1; // 0 if not in top N
      if (rank) { try { save(); } catch (e) { console.error(e); } }
      return json(res, 200, { ranking, rank });
    });
    return;
  }
  json(res, 404, { error: 'not found' });
}

http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) return handleApi(req, res);
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(buf);
  });
}).listen(PORT, () => console.log('Kill the Santa running on http://localhost:' + PORT));
