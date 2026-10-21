'use strict';

const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { z } = require('zod');

/**
 * Builds the Nightscout MCP tool catalog on top of a McpServer instance.
 *
 * A new McpServer must be created per MCP session (transport), since the SDK
 * binds one transport per Server instance. The tool handlers themselves are
 * stateless and only depend on `ctx`/`env`, so it is safe to build a fresh
 * server for every session without re-reading configuration.
 */
function init (env, ctx) {

  console.log('Configuring MCP server...');

  const tools = require('./tools')(env, ctx);

  function textResult (data) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(data, null, 2)
        }
      ]
    };
  }

  function errorResult (err) {
    console.error('MCP tool error:', err);
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: 'Internal error while executing tool: ' + (err && err.message ? err.message : 'unknown error')
        }
      ]
    };
  }

  function createServer () {
    const server = new McpServer({
      name: 'nightscout',
      version: env.version || '1.0.0'
    }, {
      capabilities: { tools: {} }
    });

    server.registerTool('get_current_glucose', {
      title: 'Get current glucose',
      description: 'Returns the most recent glucose (SGV) reading, including direction and delta.',
      annotations: { readOnlyHint: true, openWorldHint: false }
    }, async () => {
      try {
        return textResult(await tools.getCurrentGlucose());
      } catch (err) {
        return errorResult(err);
      }
    });

    server.registerTool('get_glucose_history', {
      title: 'Get glucose history',
      description: 'Returns the most recent glucose (SGV) readings, newest first.',
      inputSchema: {
        count: z.number().int().min(1).max(1000).optional().describe('Number of readings to return (default 10)')
      },
      annotations: { readOnlyHint: true, openWorldHint: false }
    }, async ({ count }) => {
      try {
        return textResult(await tools.getGlucoseHistory(count || 10));
      } catch (err) {
        return errorResult(err);
      }
    });

    server.registerTool('get_iob_cob', {
      title: 'Get IOB/COB',
      description: 'Returns the current insulin-on-board (IOB) and carbs-on-board (COB).',
      annotations: { readOnlyHint: true, openWorldHint: false }
    }, async () => {
      try {
        return textResult(await tools.getIobCob());
      } catch (err) {
        return errorResult(err);
      }
    });

    server.registerTool('get_treatments', {
      title: 'Get treatments',
      description: 'Returns the most recent treatments (boluses, carbs, notes, etc.), newest first.',
      inputSchema: {
        count: z.number().int().min(1).max(1000).optional().describe('Number of treatments to return (default 10)'),
        eventType: z.string().optional().describe('Filter by exact eventType, e.g. "Meal Bolus"')
      },
      annotations: { readOnlyHint: true, openWorldHint: false }
    }, async ({ count, eventType }) => {
      try {
        return textResult(await tools.getTreatments(count || 10, eventType));
      } catch (err) {
        return errorResult(err);
      }
    });

    server.registerTool('get_device_status', {
      title: 'Get device status',
      description: 'Returns the most recent device status entries (uploader battery, pump, loop/OpenAPS state).',
      inputSchema: {
        count: z.number().int().min(1).max(1000).optional().describe('Number of entries to return (default 5)')
      },
      annotations: { readOnlyHint: true, openWorldHint: false }
    }, async ({ count }) => {
      try {
        return textResult(await tools.getDeviceStatus(count || 5));
      } catch (err) {
        return errorResult(err);
      }
    });

    server.registerTool('get_profile', {
      title: 'Get profile',
      description: 'Returns a summary of the currently active Nightscout profile.',
      annotations: { readOnlyHint: true, openWorldHint: false }
    }, async () => {
      try {
        return textResult(await tools.getProfile());
      } catch (err) {
        return errorResult(err);
      }
    });

    return server;
  }

  return { createServer };
}

module.exports = init;
