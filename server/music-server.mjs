import { createReadStream, existsSync, promises as fsPromises, statSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const musicDir = path.join(rootDir, 'music');
const publicMusicDir = path.join(rootDir, 'public', 'music');
const port = Number(process.env.MUSIC_SERVER_PORT || 5174);

const audioExtensions = new Set(['.mp3', '.wav', '.ogg', '.m4a', '.flac', '.aac', '.aiff', '.webm']);
const colors = ['#F59E0B', '#FB923C', '#D4AF37', '#10B981', '#3B82F6', '#8B5CF6'];
const waveforms = ['sine', 'triangle', 'sawtooth'];
const frequencies = [196, 220, 247, 262, 294, 330];

const audioMimeTypes = {
  '.aac': 'audio/aac',
  '.aiff': 'audio/aiff',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.webm': 'audio/webm'
};

const staticMimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.webp': 'image/webp'
};

const distDir = path.join(rootDir, 'dist');

function sendJson(response, status, payload) {
  response.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8'
  });
  response.end(JSON.stringify(payload, null, 2));
}

function sendText(response, status, message) {
  response.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'text/plain; charset=utf-8'
  });
  response.end(message);
}

function toTitleCase(value) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function splitTrackName(filePath) {
  const baseName = path.basename(filePath, path.extname(filePath));
  const match = baseName.match(/^(.*?)\s+-\s+(.*)$/);
  if (!match) return { artist: 'Local audio', title: toTitleCase(baseName) };
  return { artist: match[1].trim(), title: match[2].trim() };
}

function createSong(file, index) {
  const { artist, title } = splitTrackName(file.relativePath);
  const angle = (index / 6) * Math.PI * 2;
  const radius = 22 + (index % 3) * 12;

  return {
    id: `backend-${Buffer.from(file.relativePath).toString('base64url')}`,
    title,
    artist,
    location: '校园声源',
    distance: '--',
    messages: 0,
    color: colors[index % colors.length],
    position: {
      x: Math.round(50 + Math.cos(angle) * radius),
      y: Math.round(50 + Math.sin(angle) * radius)
    },
    duration: 240,
    frequency: frequencies[index % frequencies.length],
    waveform: waveforms[index % waveforms.length],
    note: '后端扫描到的本地音源，会按当前位置模拟距离、音量和左右声像。',
    audioUrl: `/media/${encodeURIComponent(file.relativePath)}`,
    source: 'backend'
  };
}

async function scanDirectory(directory, prefix = '') {
  if (!existsSync(directory)) return [];
  const entries = await fsPromises.readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...await scanDirectory(absolutePath, relativePath));
    } else if (audioExtensions.has(path.extname(entry.name).toLowerCase())) {
      files.push({ absolutePath, relativePath });
    }
  }

  return files;
}

async function readLibraryOverrides() {
  const libraryPath = path.join(musicDir, 'library.json');
  if (!existsSync(libraryPath)) return {};

  try {
    const raw = await fsPromises.readFile(libraryPath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`[music-server] Cannot parse music/library.json: ${error.message}`);
    return {};
  }
}

async function listAudioSources() {
  const files = [
    ...await scanDirectory(musicDir),
    ...await scanDirectory(publicMusicDir)
  ];
  const overrides = await readLibraryOverrides();

  return files
    .sort((a, b) => a.relativePath.localeCompare(b.relativePath, 'zh-Hans-CN'))
    .map((file, index) => ({
      ...createSong(file, index),
      ...(overrides[file.relativePath] || {})
    }));
}

function resolveMediaPath(encodedRelativePath) {
  const relativePath = decodeURIComponent(encodedRelativePath);
  const match = [musicDir, publicMusicDir].find((directory) => {
    const candidate = path.resolve(directory, relativePath);
    const insideDirectory = !path.relative(directory, candidate).startsWith('..');
    return insideDirectory && existsSync(candidate) && statSync(candidate).isFile();
  });
  return match ? path.resolve(match, relativePath) : null;
}

function streamAudio(request, response, encodedRelativePath) {
  const filePath = resolveMediaPath(encodedRelativePath);
  if (!filePath) {
    sendText(response, 404, 'Audio source not found');
    return;
  }

  const size = statSync(filePath).size;
  const extension = path.extname(filePath).toLowerCase();
  const contentType = audioMimeTypes[extension] || 'application/octet-stream';
  const range = request.headers.range;

  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Accept-Ranges', 'bytes');
  response.setHeader('Content-Type', contentType);

  if (range) {
    const [startText, endText] = range.replace(/bytes=/, '').split('-');
    const start = Number.parseInt(startText, 10);
    const end = endText ? Number.parseInt(endText, 10) : size - 1;

    if (Number.isNaN(start) || Number.isNaN(end) || start >= size || end >= size) {
      response.writeHead(416, { 'Content-Range': `bytes */${size}` });
      response.end();
      return;
    }

    response.writeHead(206, {
      'Content-Length': end - start + 1,
      'Content-Range': `bytes ${start}-${end}/${size}`
    });
    createReadStream(filePath, { start, end }).pipe(response);
    return;
  }

  response.writeHead(200, { 'Content-Length': size });
  createReadStream(filePath).pipe(response);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`);

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Headers': 'Content-Type, Range',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Origin': '*'
    });
    response.end();
    return;
  }

  if (url.pathname === '/api/audio-sources') {
    try {
      const sources = await listAudioSources();
      sendJson(response, 200, {
        count: sources.length,
        directories: ['music', 'public/music'],
        sources
      });
    } catch (error) {
      sendJson(response, 500, { error: error.message });
    }
    return;
  }

  if (url.pathname.startsWith('/media/')) {
    streamAudio(request, response, url.pathname.replace('/media/', ''));
    return;
  }

  const staticPath = path.join(distDir, url.pathname === '/' ? 'index.html' : url.pathname);
  const safePath = path.resolve(distDir, staticPath);
  if (safePath.startsWith(distDir) && existsSync(safePath) && statSync(safePath).isFile()) {
    const ext = path.extname(safePath).toLowerCase();
    const contentType = staticMimeTypes[ext] || 'application/octet-stream';
    response.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*'
    });
    createReadStream(safePath).pipe(response);
    return;
  }

  const indexPath = path.join(distDir, 'index.html');
  if (existsSync(indexPath)) {
    response.writeHead(200, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*'
    });
    createReadStream(indexPath).pipe(response);
    return;
  }

  sendJson(response, 200, {
    name: 'Location Based Music App backend',
    endpoints: ['/api/audio-sources', '/media/{file}']
  });
});

server.listen(port, '0.0.0.0', () => {
  console.log(`[music-server] scanning ${musicDir}`);
  console.log(`[music-server] http://127.0.0.1:${port}`);
});
