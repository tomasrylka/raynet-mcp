// src/index.js - Raynet MCP Server s podporou Streamable HTTP
'use strict';

const express = require('express');
const { RaynetClient } = require('./client');
const { tools: buildTools } = require('./tools');

const config = {
  instanceUrl: process.env.RAYNET_URL || 'https://app.raynet.cz/api/v2',
  instanceName: process.env.RAYNET_INSTANCE || '',
  username: process.env.RAYNET_USERNAME || '',
  apiKey: process.env.RAYNET_API_KEY || '',
};

if (!config.instanceName || !config.username || !config.apiKey) {
  console.error('❌ Chybí ENV: RAYNET_INSTANCE, RAYNET_USERNAME, RAYNET_API_KEY');
  process.exit(1);
}

const client = new RaynetClient(config);
const allTools = buildTools(client);
const toolMap = new Map(allTools.map(t => [t.name, t]));

console.log(`🚀 Raynet MCP Server`);
console.log(`📦 Nástrojů: ${allTools.length}`);
console.log(`🔗 Instance: ${config.instanceName}`);

const app = express();
app.use(express.json({ limit: '5mb' }));

// CORS - musí být před všemi routami
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Session-Id, Mcp-Session-Id');
  res.setHeader('Access-Control-Expose-Headers', 'Mcp-Session-Id');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', tools: allTools.length, instance: config.instanceName });
});

// Root
app.get('/', (req, res) => {
  res.json({ name: 'Raynet MCP Server', version: '1.0.0', tools: allTools.length });
});

// Session storage pro Streamable HTTP
const sessions = new Map();

function generateSessionId() {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

async function handleMcpMessage(body, sessionId) {
  const { method, params, id } = body || {};

  if (method === 'initialize') {
    return {
      jsonrpc: '2.0', id,
      result: {
        protocolVersion: '2024-11-05',
        serverInfo: { name: 'raynet-mcp-cz', version: '1.0.0' },
        capabilities: { tools: {} },
      }
    };
  }

  if (method === 'notifications/initialized' || method === 'ping') {
    return { jsonrpc: '2.0', id, result: {} };
  }

  if (method === 'tools/list') {
    return {
      jsonrpc: '2.0', id,
      result: {
        tools: allTools.map(t => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      }
    };
  }

  if (method === 'tools/call') {
    const { name, arguments: args } = params || {};
    const tool = toolMap.get(name);
    if (!tool) {
      return { jsonrpc: '2.0', id, error: { code: -32601, message: `Nástroj '${name}' nenalezen.` } };
    }
    try {
      const result = await tool.handler(args || {});
      return { jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: String(result) }] } };
    } catch (err) {
      return { jsonrpc: '2.0', id, error: { code: -32603, message: err.message } };
    }
  }

  return { jsonrpc: '2.0', id, error: { code: -32601, message: `Neznámá metoda: ${method}` } };
}

// ── Streamable HTTP transport (pro mcp-remote) ──────────────
// POST /mcp - přijme zprávu, vrátí odpověď nebo otevře SSE stream
app.post('/mcp', async (req, res) => {
  try {
    const sessionId = req.headers['mcp-session-id'] || generateSessionId();
    const body = req.body;
    const acceptHeader = req.headers['accept'] || '';

    // Pokud klient chce SSE stream
    if (acceptHeader.includes('text/event-stream')) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Mcp-Session-Id', sessionId);

      const sendEvent = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      };

      // Zpracuj zprávu a pošli odpověď přes SSE
      if (Array.isArray(body)) {
        for (const msg of body) {
          const response = await handleMcpMessage(msg, sessionId);
          if (response.id !== undefined) sendEvent(response);
        }
      } else {
        const response = await handleMcpMessage(body, sessionId);
        if (response.id !== undefined) sendEvent(response);
      }

      // Drž spojení otevřené
      const keepAlive = setInterval(() => {
        res.write(': ping\n\n');
      }, 15000);

      req.on('close', () => {
        clearInterval(keepAlive);
        sessions.delete(sessionId);
      });

      return;
    }

    // Standardní JSON odpověď
    res.setHeader('Mcp-Session-Id', sessionId);

    if (Array.isArray(body)) {
      const responses = [];
      for (const msg of body) {
        const response = await handleMcpMessage(msg, sessionId);
        if (response.id !== undefined) responses.push(response);
      }
      return res.json(responses.length === 1 ? responses[0] : responses);
    }

    const response = await handleMcpMessage(body, sessionId);
    return res.json(response);

  } catch (err) {
    console.error('Chyba:', err);
    return res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: err.message } });
  }
});

// GET /mcp - SSE stream pro notifikace (Streamable HTTP)
app.get('/mcp', (req, res) => {
  const sessionId = req.headers['mcp-session-id'] || generateSessionId();

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Mcp-Session-Id', sessionId);

  // Pošli úvodní ping
  res.write(': connected\n\n');

  const keepAlive = setInterval(() => {
    res.write(': ping\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(keepAlive);
    sessions.delete(sessionId);
  });
});

// DELETE /mcp - ukončení session
app.delete('/mcp', (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  if (sessionId) sessions.delete(sessionId);
  res.sendStatus(200);
});

// Starý SSE endpoint pro zpětnou kompatibilitu
app.get('/sse', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.write(': connected\n\n');
  const ka = setInterval(() => res.write(': ping\n\n'), 15000);
  req.on('close', () => clearInterval(ka));
});

const PORT = parseInt(process.env.PORT || '3000');
app.listen(PORT, () => {
  console.log(`✅ Server běží na portu ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   MCP:    http://localhost:${PORT}/mcp`);
});
