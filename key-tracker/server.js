const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data.json');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

// ----------------- Data helpers -----------------

function getDefaultZones() {
  return [
    { id: 'zone_1', name: 'Зона 1', bundles: ['101-1010', '101-105', '131-1311', '141-1410', '151-1510', '161-1611', '171-179', '181-1812', '191-1912'] },
    { id: 'zone_2', name: 'Зона 2', bundles: ['101-107', '111-116', '121-126', '131-136', '141-146', '151-156', '161-166', '171-180', '1101-1106', '1111-1113', '1121-1127', '1131-1138', '1141-1145'] },
    { id: 'zone_3', name: 'Зона 3', bundles: ['101-108', '111-119', '121-210', '131-140', '141-150', '151-159', '161-170', '171-180', '181-188'] },
    { id: 'zone_4', name: 'Зона 4', bundles: ['101-1010', '111-119', '121-1211', '131-1311', '131-1611', '141-1410', '151-1510', '161-169', '161-1611', '171-179', '181-1812', '191-1912', '191-1913'] },
    { id: 'zone_5', name: 'Зона 5', bundles: ['101-105', '111-114', '121-126', '131-136'] },
    { id: 'zone_6', name: 'Зона 6', bundles: ['101-106', '111-113', '121-125', '131-133'] },
    { id: 'zone_7', name: 'Зона 7', bundles: ['101-106', '111-116', '121-124', '131-135', '141-145', '151-154', '161-165', '171-172', '181-183'] },
    { id: 'zone_8', name: 'Зона 8', bundles: ['101-105', '111-115', '121-123', '131-136', '141-146'] },
    {
      id: 'zone_9',
      name: 'Зона 9',
      bundles: [
        '101-106',
        '111-115',
        '121-125',
        '131-134',
        '141-146',
        '151-156',
        '161-166',
        '171-175',
        '181-185',
        '201-204',
        '211-213',
        '221-228',
        '231-236',
        '241-246',
        '251-256',
        '261-266',
        '301-306',
        '311-314',
      ],
    },
    {
      id: 'zone_10',
      name: 'Зона 10',
      bundles: [
        '101-106',
        '107-110',
        '111-116',
        '121-125',
        '131-136',
        '141-143',
        '201-209',
        '211',
        '221-223',
        '231-234',
        '241-246',
        '251-256',
        '261-265',
        '271-274',
        '281-289',
        '301-304',
        '311-316',
        '321-326',
        '331-334',
        '341-346',
        '351-356',
        '361-366',
        '371-375',
        '381-382',
        '391-392',
      ],
    },
    {
      id: 'zone_11',
      name: 'Зона 11',
      bundles: [
        '111-116',
        '121-124',
        '131-134',
        '141-144',
        '151-155',
        '161-165',
        '211-215',
        '221-224',
        '231-236',
        '241-246',
        '251-255',
        '261-265',
        '271-275',
        '281-285',
        '291-293',
      ],
    },
    { id: 'zone_12', name: 'Зона 12', bundles: ['101-106', '111-116', '121-125', '131-134', '141-144', '151-156', '161-166'] },
    { id: 'zone_15', name: 'Зона 15', bundles: ['201-206', '211-216', '221-225', '301-306', '311-316', '321-326'] },
    { id: 'zone_17', name: 'Зона 17', bundles: ['101-106', '111-116', '121-126', '131-136', '141-146', '201-205'] },
    { id: 'zone_18', name: 'Зона 18', bundles: ['101-106', '111-116', '121-126', '131-136', '141-146', '151-154'] },
  ];
}

function readData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed.zones || !parsed.state) throw new Error('Invalid data file');
    return parsed;
  } catch {
    // Ініціалізація дефолтними зонами
    const initial = { zones: getDefaultZones(), state: {} };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), 'utf8');
    return initial;
  }
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        req.destroy();
        reject(new Error('Body too large'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

// ----------------- HTTP server -----------------

const server = http.createServer(async (req, res) => {
  // API endpoints
  if (req.url.startsWith('/api/')) {
    const method = req.method || 'GET';

    // CORS для возможного будущего хостинга
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.url === '/api/state' && method === 'GET') {
      const data = readData();
      sendJson(res, 200, data);
      return;
    }

    if (req.url === '/api/take' && method === 'POST') {
      try {
        const body = await parseBody(req);
        const { bundleId, personName } = body;
        if (!bundleId || !personName || !String(personName).trim()) {
          sendJson(res, 400, { error: 'bundleId and personName are required' });
          return;
        }
        const data = readData();
        // Сохраняем комментарий, если он уже есть
        const existingComment = data.state[bundleId]?.comment || '';
        data.state[bundleId] = { 
          personName: String(personName).trim(), 
          takenAt: Date.now(),
          comment: existingComment
        };
        writeData(data);
        sendJson(res, 200, { ok: true });
      } catch (e) {
        sendJson(res, 500, { error: 'Failed to take key' });
      }
      return;
    }

    if (req.url === '/api/return' && method === 'POST') {
      try {
        const body = await parseBody(req);
        const { bundleId } = body;
        if (!bundleId) {
          sendJson(res, 400, { error: 'bundleId is required' });
          return;
        }
        const data = readData();
        // Сохраняем комментарий перед удалением
        const comment = data.state[bundleId]?.comment || '';
        delete data.state[bundleId];
        // Если есть комментарий - сохраняем его
        if (comment) {
          data.state[bundleId] = { comment };
        }
        writeData(data);
        sendJson(res, 200, { ok: true });
      } catch (e) {
        sendJson(res, 500, { error: 'Failed to return key' });
      }
      return;
    }

    if (req.url === '/api/comment' && method === 'POST') {
      try {
        const body = await parseBody(req);
        const { bundleId, comment } = body;
        if (!bundleId) {
          sendJson(res, 400, { error: 'bundleId is required' });
          return;
        }
        const data = readData();
        // Если связка взята - обновляем комментарий
        if (data.state[bundleId]) {
          data.state[bundleId].comment = comment ? String(comment).trim() : '';
          writeData(data);
        } else {
          // Если связка свободна - создаём запись только с комментарием
          data.state[bundleId] = { comment: comment ? String(comment).trim() : '' };
          writeData(data);
        }
        sendJson(res, 200, { ok: true });
      } catch (e) {
        sendJson(res, 500, { error: 'Failed to set comment' });
      }
      return;
    }

    if (req.url === '/api/add-zone' && method === 'POST') {
      try {
        const body = await parseBody(req);
        const name = String(body.name || '').trim();
        if (!name) {
          sendJson(res, 400, { error: 'name is required' });
          return;
        }
        const data = readData();
        const id = 'zone_' + Date.now();
        data.zones.push({ id, name, bundles: [] });
        writeData(data);
        sendJson(res, 200, { ok: true, id });
      } catch {
        sendJson(res, 500, { error: 'Failed to add zone' });
      }
      return;
    }

    if (req.url === '/api/add-bundle' && method === 'POST') {
      try {
        const body = await parseBody(req);
        const zoneId = body.zoneId;
        const range = String(body.range || '').trim();
        if (!zoneId || !range) {
          sendJson(res, 400, { error: 'zoneId and range are required' });
          return;
        }
        const data = readData();
        const zone = data.zones.find((z) => z.id === zoneId);
        if (!zone) {
          sendJson(res, 404, { error: 'Zone not found' });
          return;
        }
        if (!zone.bundles.includes(range)) {
          zone.bundles.push(range);
          zone.bundles.sort((a, b) => String(a).localeCompare(b, 'uk', { numeric: true }));
          writeData(data);
        }
        sendJson(res, 200, { ok: true });
      } catch {
        sendJson(res, 500, { error: 'Failed to add bundle' });
      }
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  // Static files
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(ROOT, path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, ''));

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
        return;
      }
      res.writeHead(500);
      res.end('Server Error');
      return;
    }

    const ext = path.extname(filePath);
    const contentType = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log('');
  console.log('  Сайт запущено: http://localhost:' + PORT);
  console.log('  Зупинити: Ctrl+C');
  console.log('');
});
