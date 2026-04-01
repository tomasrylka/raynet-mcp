// src/index.js - Raynet MCP Server
'use strict';

const express = require('express');
const { RaynetClient } = require('./client');
const { tools: buildTools } = require('./tools');

// ── Konfigurace ──────────────────────────────────────────
const config = {
  instanceUrl: process.env.RAYNET_URL || 'https://app.raynet.cz/api/v2',
  instanceName: process.env.RAYNET_INSTANCE || '',
  username: process.env.RAYNET_USERNAME || '',
  apiKey: process.env.RAYNET_API_KEY || '',
};

if (!config.instanceName || !config.username || !config.apiKey) {
  console.error('❌ Chybí ENV proměnné: RAYNET_INSTANCE, RAYNET_USERNAME, RAYNET_API_KEY');
  process.exit(1);
}

const client = new RaynetClient(config);
const allTools = buildTools(client);
const toolMap = new Map(allTools.map(t => [t.name, t]));

console.log(`🚀 Raynet MCP Server`);
console.log(`📦 Nástrojů: ${allTools.length}`);
console.log(`🔗 Instance: ${config.instanceName}`);

// ── Express server ────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '5mb' }));

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', tools: allTools.length, instance: config.instanceName });
});

// ── MCP protokol ─────────────────────────────────────────
app.post('/mcp', async (req, res) => {
  const { method, params, id } = req.body || {};

  try {
    // Initialize
    if (method === 'initialize') {
      return res.json({ jsonrpc: '2.0', id, result: {
        protocolVersion: '2024-11-05',
        serverInfo: { name: 'raynet-mcp-cz', version: '1.0.0' },
        capabilities: { tools: {} },
      }});
    }

    // Seznam nástrojů
    if (method === 'tools/list') {
      return res.json({ jsonrpc: '2.0', id, result: {
        tools: allTools.map(t => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      }});
    }

    // Volání nástroje
    if (method === 'tools/call') {
      const { name, arguments: args } = params || {};
      const tool = toolMap.get(name);

      if (!tool) {
        return res.json({ jsonrpc: '2.0', id,
          error: { code: -32601, message: `Nástroj '${name}' nenalezen.` }
        });
      }

      const result = await tool.handler(args || {});
      return res.json({ jsonrpc: '2.0', id, result: {
        content: [{ type: 'text', text: String(result) }],
      }});
    }

    // Ping
    if (method === 'ping') {
      return res.json({ jsonrpc: '2.0', id, result: {} });
    }

    return res.json({ jsonrpc: '2.0', id,
      error: { code: -32601, message: `Neznámá metoda: ${method}` }
    });

  } catch (err) {
    console.error('Chyba:', err);
    return res.json({ jsonrpc: '2.0', id,
      error: { code: -32603, message: `Interní chyba: ${err.message}` }
    });
  }
});

// SSE endpoint (pro Claude.ai)
app.get('/sse', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.write(`data: ${JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' })}\n\n`);
  req.on('close', () => res.end());
});

// Root info
app.get('/', (req, res) => {
  res.json({
    name: 'Raynet MCP Server',
    version: '1.0.0',
    tools: allTools.length,
    endpoints: { mcp: '/mcp', health: '/health', sse: '/sse' },
  });
});

const PORT = parseInt(process.env.PORT || '3000');
app.listen(PORT, () => {
  console.log(`✅ Server běží na portu ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   MCP:    http://localhost:${PORT}/mcp`);
});
