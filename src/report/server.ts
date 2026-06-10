import { createServer as createHttpServer, type IncomingMessage, type ServerResponse } from 'http';
import { createReadStream, existsSync } from 'fs';
import { resolve, extname } from 'path';
import { loadReportSummaries, loadReportById, getArtifactPath } from './report-store';

const MIME_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.zip': 'application/zip',
  '.json': 'application/json',
  '.log': 'text/plain',
  '.txt': 'text/plain',
};

function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

function sendFile(res: ServerResponse, filePath: string): void {
  const ext = extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext] ?? 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime });
  createReadStream(filePath).pipe(res);
}

function handleApi(req: IncomingMessage, res: ServerResponse): boolean {
  const url = req.url ?? '/';

  // GET /api/reports
  if (url === '/api/reports' && req.method === 'GET') {
    const summaries = loadReportSummaries();
    sendJson(res, 200, summaries);
    return true;
  }

  // GET /api/reports/:id/export
  const exportMatch = url.match(/^\/api\/reports\/([^/?]+)\/export$/);
  if (exportMatch && req.method === 'GET') {
    const id = exportMatch[1];
    const report = loadReportById(id);
    if (report) {
      const filename = `heybugs-report-${report.runLabel}.json`;
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
      });
      res.end(JSON.stringify(report, null, 2));
    } else {
      sendJson(res, 404, { error: 'Report not found' });
    }
    return true;
  }

  // GET /api/reports/:id/artifacts/:filename
  const artifactMatch = url.match(/^\/api\/reports\/([^/?]+)\/artifacts\/(.+)$/);
  if (artifactMatch && req.method === 'GET') {
    const runId = artifactMatch[1];
    const filename = decodeURIComponent(artifactMatch[2]);
    const artifactPath = getArtifactPath(runId, filename);
    if (artifactPath) {
      sendFile(res, artifactPath);
    } else {
      sendJson(res, 404, { error: 'Artifact not found' });
    }
    return true;
  }

  // GET /api/reports/:id
  const reportMatch = url.match(/^\/api\/reports\/([^/?]+)$/);
  if (reportMatch && req.method === 'GET') {
    const id = reportMatch[1];
    const report = loadReportById(id);
    if (report) {
      sendJson(res, 200, report);
    } else {
      sendJson(res, 404, { error: 'Report not found' });
    }
    return true;
  }

  return false;
}

export async function startReportServer(port: number = 9323): Promise<void> {
  const vite = await import('vite');
  const { resolve: resolvePath } = await import('path');

  const projectRoot = resolvePath(__dirname, '../..');
  const appRoot = resolvePath(projectRoot, 'src/report/app');

  const viteServer = await vite.createServer({
    configFile: false,
    root: appRoot,
    plugins: [
      (await import('@vitejs/plugin-react')).default(),
    ],
    server: { middlewareMode: true },
    appType: 'spa',
  });

  const httpServer = createHttpServer((req, res) => {
    // Handle API routes first
    if (handleApi(req, res)) {
      return;
    }

    // Rewrite /dashboard to / for SPA routing
    if (req.url === '/dashboard' || req.url === '/dashboard/') {
      req.url = '/';
    }

    // Let Vite handle everything else (SPA)
    viteServer.middlewares(req, res, () => {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    });
  });

  httpServer.listen(port, () => {
    console.log('');
    console.log('  📊  Heybugs Report Dashboard');
    console.log(`  ➜  Local:   http://localhost:${port}/dashboard`);
    console.log('  ➜  Press Ctrl+C to stop');
    console.log('');
  });

  const shutdown = (): void => {
    console.log('\nShutting down report server...');
    httpServer.close();
    viteServer.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
