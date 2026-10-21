'use strict';

/**
 * Read-only data access used by the MCP tools.
 * Kept separate from the MCP transport/schema wiring (index.js) so the
 * data-fetching logic can be reused/tested without spinning up a McpServer.
 */
function init (env, ctx) {

  const tools = { };

  function buildSandbox () {
    const sbx = require('../sandbox')().serverInit(env, ctx);
    ctx.plugins.setProperties(sbx);
    return sbx;
  }

  function listAsync (fn, opts) {
    return new Promise(function (resolve, reject) {
      fn(opts, function (err, results) {
        if (err) { return reject(err); }
        resolve(results || []);
      });
    });
  }

  tools.getCurrentGlucose = async function getCurrentGlucose () {
    const sbx = buildSandbox();
    const entry = sbx.lastSGVEntry();

    if (!entry) {
      return { available: false, message: 'No glucose entries are available yet.' };
    }

    const bgnow = sbx.properties.bgnow;
    const delta = sbx.properties.delta;
    const direction = sbx.properties.direction;

    return {
      available: true,
      units: sbx.unitsLabel,
      value: sbx.scaleEntry(entry),
      mgdl: entry.mgdl,
      direction: direction && direction.value,
      delta: delta && delta.display,
      date: new Date(entry.mills).toISOString(),
      noise: bgnow && bgnow.noise
    };
  };

  tools.getGlucoseHistory = async function getGlucoseHistory (count) {
    const records = await listAsync(ctx.entries.list.bind(ctx.entries), {
      count: count,
      find: { type: 'sgv' }
    });

    return records.map(function (entry) {
      return {
        mgdl: entry.sgv,
        direction: entry.direction,
        date: entry.dateString || new Date(entry.date).toISOString()
      };
    });
  };

  tools.getIobCob = async function getIobCob () {
    const sbx = buildSandbox();
    const iob = sbx.properties.iob;
    const cob = sbx.properties.cob;

    return {
      iob: iob && typeof iob.iob === 'number' ? iob.iob : null,
      iobDisplay: iob && iob.display,
      cob: cob && typeof cob.cob === 'number' ? cob.cob : null,
      cobDisplay: cob && cob.display
    };
  };

  tools.getTreatments = async function getTreatments (count, eventType) {
    const find = eventType ? { eventType: eventType } : undefined;
    const records = await listAsync(ctx.treatments.list.bind(ctx.treatments), {
      count: count,
      find: find
    });

    return records.map(function (t) {
      return {
        eventType: t.eventType,
        glucose: t.glucose,
        insulin: t.insulin,
        carbs: t.carbs,
        notes: t.notes,
        enteredBy: t.enteredBy,
        date: t.created_at
      };
    });
  };

  tools.getDeviceStatus = async function getDeviceStatus (count) {
    const records = await listAsync(ctx.devicestatus.list.bind(ctx.devicestatus), {
      count: count
    });

    return records.map(function (d) {
      return {
        device: d.device,
        date: d.created_at,
        uploaderBattery: d.uploader && d.uploader.battery,
        pump: d.pump,
        openaps: d.openaps,
        loop: d.loop
      };
    });
  };

  tools.getProfile = async function getProfile () {
    const profiles = await new Promise(function (resolve, reject) {
      ctx.profile.list(function (err, results) {
        if (err) { return reject(err); }
        resolve(results || []);
      });
    });

    const current = profiles[0];
    if (!current) {
      return { available: false, message: 'No profile is configured yet.' };
    }

    return {
      available: true,
      defaultProfile: current.defaultProfile,
      units: current.units,
      startDate: current.startDate
    };
  };

  return tools;
}

module.exports = init;
