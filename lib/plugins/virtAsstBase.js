'use strict';

function init(env, ctx) {
  var moment = ctx.moment;

  function virtAsstBase() {
    return virtAsstBase;
  }

  var entries = ctx.entries;
  var translate = ctx.language.translate;
  var utils = require('../utils')(ctx);

  // A reading older than this is spoken with its age instead of as the current value.
  var FRESH_MINUTES = 5;

  // "<key>Now" phrases (no age) are for fresh readings; "3person" ones need slots.subject (ALEXA_PATIENT_NAME).
  // Each step falls back to the next when the language lacks the key.
  function bgSentence (record, sbx, slots, current) {
    var params = [
      moment(record.date).from(moment(sbx.time)),
      sbx.scaleMgdl(record.sgv),
      translate(record.direction)
    ];
    var subject = slots?.subject;
    var suffix = subject ? '3person' : '';
    var fresh = current && moment(sbx.time).diff(record.date, 'minutes') <= FRESH_MINUTES;
    var key = [
      (fresh ? 'virtAsstStatusNow' : 'virtAsstStatus') + suffix
      , 'virtAsstStatus' + suffix
      , 'virtAsstStatus'
    ].find(function (k) { return utils.hasTranslation(k); });
    return translate(key, { params: subject ? params.concat(subject.of) : params });
  }

  virtAsstBase.setupMutualIntents = function (configuredPlugin) {
    // full status
    configuredPlugin.addToRollup('Status', function (slots, sbx, callback) {
      entries.list({count: 1}, function (err, records) {
        callback(null, {results: bgSentence(records[0], sbx, slots, false), priority: -1});
      });
    }, 'BG Status');

    configuredPlugin.configureIntentHandler('NSStatus', function (callback, slots, sbx, locale) {
      configuredPlugin.getRollup('Status', sbx, slots, locale, function (status) {
        callback(translate('virtAsstTitleFullStatus'), status);
      });
    });

    // blood sugar and direction
    configuredPlugin.configureIntentHandler('MetricNow', function (callback, slots, sbx) {
      entries.list({count: 1}, function(err, records) {
        callback(translate('virtAsstTitleCurrentBG'), bgSentence(records[0], sbx, slots, true));
      });
    }, ['bg', 'blood glucose', 'number']);
  };

  virtAsstBase.setupVirtAsstHandlers = function (configuredPlugin) {
    ctx.plugins.eachEnabledPlugin(function (plugin) {
      if (plugin.virtAsst) {
        if (plugin.virtAsst.intentHandlers) {
          console.log('Plugin "' + plugin.name + '" supports Virtual Assistants');
          Object.values(plugin.virtAsst.intentHandlers).forEach(function (route) {
            if (route) {
              configuredPlugin.configureIntentHandler(route.intent, route.intentHandler, route.metrics);
            }
          });
        }
        if (plugin.virtAsst.rollupHandlers) {
          console.log('Plugin "' + plugin.name + '" supports rollups for Virtual Assistants');
          Object.values(plugin.virtAsst.rollupHandlers).forEach(function (route) {
            if (route) {
              configuredPlugin.addToRollup(route.rollupGroup, route.rollupHandler, route.rollupName);
            }
          });
        }
      } else {
        console.log('Plugin "' + plugin.name + '" does not support Virtual Assistants');
      }
    });
  };

  return virtAsstBase;
}

module.exports = init;
