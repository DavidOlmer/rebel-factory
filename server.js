const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

// Serve static frontend + API
const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.url.startsWith('/api/')) {
    // Mock API responses
    const apis = {
      '/api/health': { status: 'ok', demo: true },
      '/api/stats': { 
        agents: { total: '14', idle: '14', running: '0' },
        issues: { total: '32', done: '23', open: '9' }
      },
      '/api/agents': { agents: [
        { name: 'CEO', icon: '👔', role: 'Executive', status: 'idle' },
        { name: 'CTO', icon: '🔧', role: 'Technical', status: 'idle' },
        { name: 'Security', icon: '🔐', role: 'Engineer', status: 'idle' },
        { name: 'BackendDev', icon: '💾', role: 'Engineer', status: 'idle' },
        { name: 'FrontendDev', icon: '🎨', role: 'Engineer', status: 'idle' },
        { name: 'Architect', icon: '🏗️', role: 'Architect', status: 'idle' },
      ]},
      '/api/sprints': { sprints: [
        { identifier: 'REBAA-29', title: 'Enterprise Admin Dashboard', status: 'done' },
        { identifier: 'REBAA-28', title: 'Multi-Tenant Architecture', status: 'done' },
        { identifier: 'REBAA-27', title: 'Enterprise Audit Logging', status: 'done' },
        { identifier: 'REBAA-26', title: 'Enterprise RBAC', status: 'done' },
        { identifier: 'REBAA-25', title: 'SharePoint Integration', status: 'done' },
        { identifier: 'REBAA-24', title: 'Microsoft SSO', status: 'done' },
      ]}
    };
    
    const data = apis[req.url] || { error: 'Not found' };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
    return;
  }
  
  // Serve standalone.html
  const file = path.join(__dirname, 'frontend', 'standalone.html');
  if (fs.existsSync(file)) {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(fs.readFileSync(file));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>Rebel AI Factory</h1><p>Frontend not found</p>');
  }
});

server.listen(PORT, () => {
  console.log(`🏭 Rebel AI Factory running on http://localhost:${PORT}`);
});
