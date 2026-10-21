'use strict';

const { randomUUID } = require('crypto');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { isInitializeRequest } = require('@modelcontextprotocol/sdk/types.js');

/**
 * Exposes the Nightscout MCP server over the Streamable HTTP transport
 * (https://modelcontextprotocol.io), mounted at /api/v1/mcp.
 *
 * Sessions are kept in-memory, keyed by the `mcp-session-id` header, following
 * the reference Express integration from the official MCP SDK.
 */
function configure (app, wares, ctx, env) {
  var express = require('express')
    , api = express.Router( );

  // invoke common middleware
  api.use(wares.sendJSONStatus);
  api.use(wares.rawParser);
  api.use(wares.jsonParser);
  api.use(wares.urlencodedParser);

  const requirePermission = ctx.authorization.isPermitted('api:*:read');

  // sessionId -> { transport }
  const sessions = { };

  async function handlePost (req, res) {
    const sessionId = req.header('mcp-session-id');

    try {
      let transport;

      if (sessionId && sessions[sessionId]) {
        transport = sessions[sessionId].transport;
      } else if (!sessionId && isInitializeRequest(req.body)) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: randomUUID,
          enableJsonResponse: true,
          onsessioninitialized: function (newSessionId) {
            sessions[newSessionId] = { transport: transport };
          }
        });

        transport.onclose = function () {
          if (transport.sessionId) {
            delete sessions[transport.sessionId];
          }
        };

        const server = ctx.mcp.createServer();
        await server.connect(transport);
      } else {
        res.status(400).json({
          jsonrpc: '2.0',
          error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
          id: null
        });
        return;
      }

      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error('Error handling MCP request:', err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null
        });
      }
    }
  }

  async function handleSessionRequest (req, res) {
    const sessionId = req.header('mcp-session-id');
    if (!sessionId || !sessions[sessionId]) {
      res.status(400).send('Invalid or missing session ID');
      return;
    }
    await sessions[sessionId].transport.handleRequest(req, res);
  }

  api.post('/', requirePermission, handlePost);
  api.get('/', requirePermission, handleSessionRequest);
  api.delete('/', requirePermission, handleSessionRequest);

  return api;
}

module.exports = configure;
