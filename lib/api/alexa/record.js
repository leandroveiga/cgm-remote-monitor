'use strict';

var _ = require('lodash');

var TIMESTAMP_TOLERANCE_MS = 150 * 1000;
var DEDUPE_TTL_MS = 10 * 60 * 1000;
var DEFAULT_MAX_INSULIN = 10;
var DEFAULT_MAX_CARBS = 150;

var RECORD_INTENTS = {
  RecordInsulin: {
    slot: 'units'
    , field: 'insulin'
    , eventType: 'Correction Bolus'
    , titleKey: 'virtAsstTitleRecordInsulin'
    , doneKey: 'virtAsstRecordInsulinDone'
    , maxKey: 'maxInsulin'
    , maxDefault: DEFAULT_MAX_INSULIN
    , decimals: 2
  }
  , RecordCarbs: {
    slot: 'grams'
    , field: 'carbs'
    , eventType: 'Carb Correction'
    , titleKey: 'virtAsstTitleRecordCarbs'
    , doneKey: 'virtAsstRecordCarbsDone'
    , maxKey: 'maxCarbs'
    , maxDefault: DEFAULT_MAX_CARBS
    , decimals: 0
  }
};

function init (ctx, env) {
  var translate = ctx.language.translate;
  var seenRequests = {};

  function settings () {
    return _.get(env, 'extendedSettings.alexa') || {};
  }

  function isEnabled () {
    var v = settings().recordEnabled;
    return v === true || (typeof v === 'string' && ['true', 'on'].indexOf(v.toLowerCase()) > -1);
  }

  function limitFor (spec) {
    var configured = Number(settings()[spec.maxKey]);
    return configured > 0 ? configured : spec.maxDefault;
  }

  function pruneSeen (now) {
    _.forEach(_.keys(seenRequests), function (id) {
      if (now - seenRequests[id] > DEDUPE_TTL_MS) { delete seenRequests[id]; }
    });
  }

  function applicationId (body) {
    return _.get(body, 'context.System.application.applicationId') || _.get(body, 'session.application.applicationId');
  }

  // Replay / origin checks. Alexa signature verification is not performed here.
  function requestIsAcceptable (body) {
    var now = Date.now();
    var ts = Date.parse(_.get(body, 'request.timestamp'));
    if (isNaN(ts) || Math.abs(now - ts) > TIMESTAMP_TOLERANCE_MS) { return false; }

    var skillId = settings().skillId;
    if (skillId && applicationId(body) !== skillId) { return false; }

    var requestId = _.get(body, 'request.requestId');
    if (!requestId) { return false; }
    pruneSeen(now);
    if (seenRequests[requestId]) { return false; }
    seenRequests[requestId] = now;
    return true;
  }

  function parseValue (raw, spec) {
    var text = raw === undefined || raw === null ? '' : String(raw).trim().replace(',', '.');
    if (!/^[0-9.]{1,8}$/.test(text)) { return null; }
    var n = Number(text);
    if (!isFinite(n) || n <= 0) { return null; }
    var factor = Math.pow(10, spec.decimals);
    n = Math.round(n * factor) / factor;
    return n > 0 ? n : null;
  }

  function isPermitted (req, callback) {
    ctx.authorization.resolveWithRequest(req, function (err, result) {
      if (err || !result) { return callback(false); }
      callback(ctx.authorization.checkMultiple('api:treatments:create', result.shiros));
    });
  }

  record.isRecordIntent = function isRecordIntent (name) {
    return _.has(RECORD_INTENTS, name);
  };

  function record (req, intent, next) {
    var spec = RECORD_INTENTS[intent.name];
    var title = translate(spec.titleKey);

    if (!isEnabled()) {
      return next(title, translate('virtAsstRecordDisabled'));
    }

    if (intent.confirmationStatus === 'DENIED') {
      return next(title, translate('virtAsstRecordNotConfirmed'));
    }
    if (intent.confirmationStatus !== 'CONFIRMED') {
      return next(title, translate('virtAsstRecordRejected'));
    }

    var value = parseValue(_.get(intent, 'slots.' + spec.slot + '.value'), spec);
    if (value === null) {
      return next(title, translate('virtAsstRecordInvalidValue'));
    }

    var max = limitFor(spec);
    if (value > max) {
      return next(title, translate('virtAsstRecordOverLimit', { params: [value, max] }));
    }

    isPermitted(req, function (permitted) {
      if (!permitted) {
        return next(title, translate('virtAsstRecordDenied'));
      }
      if (!requestIsAcceptable(req.body)) {
        return next(title, translate('virtAsstRecordRejected'));
      }

      var treatment = {
        eventType: spec.eventType
        , created_at: new Date().toISOString()
        , enteredBy: 'Alexa'
        , notes: 'Registrado por voz (Alexa)'
      };
      treatment[spec.field] = value;
      ctx.purifier.purifyObject(treatment);

      ctx.treatments.create([treatment], function (err) {
        if (err) {
          console.error('Alexa record failed', err);
          return next(title, translate('virtAsstRecordError'));
        }
        console.log('Alexa treatment created', spec.eventType, spec.field, value);
        next(title, translate(spec.doneKey, { params: [value] }));
      });
    });
  }

  return record;
}

module.exports = init;
