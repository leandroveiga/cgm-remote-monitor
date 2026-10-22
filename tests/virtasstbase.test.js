'use strict';

const moment = require('moment');
const helper = require('./inithelper')();

require('should');

describe('virtAsstBase glucose phrases', function () {
  const ctx = helper.ctx;
  const enTranslations = ctx.language.translations;
  const now = Date.now();
  const handlers = {};
  let ageMinutes = 5;

  before(function () {
    ctx.language.offerTranslations(require('../translations/pt_BR.json'));
    moment.locale('pt');
    ctx.moment = moment;
    ctx.entries = { list: function (opts, cb) { cb(null, [{ date: now - ageMinutes * 60000, sgv: 120, direction: 'Flat' }]); } };
    const plugin = {
      addToRollup: function (group, handler) { handlers.rollup = handler; }
      , configureIntentHandler: function (intent, handler) { if (intent === 'MetricNow') { handlers.metric = handler; } }
    };
    require('../lib/plugins/virtAsstBase')({}, ctx).setupMutualIntents(plugin);
  });

  after(function () {
    ctx.language.offerTranslations(enTranslations);
    moment.locale('en');
  });

  const sbx = { time: now, scaleMgdl: function (v) { return v; } };
  const subject = { name: 'Gabriel', of: 'do Gabriel' };

  function current (slots, minutes, expected, done) {
    ageMinutes = minutes;
    handlers.metric(function (title, response) {
      response.should.equal(expected);
      done();
    }, slots, sbx);
  }

  it('should speak a fresh reading as the current value', function (done) {
    current({}, 5, 'A sua glicemia est\u00e1 em 120, est\u00e1vel.', done);
  });

  it('should speak a fresh reading about the configured person', function (done) {
    current({ subject: subject }, 5, 'A glicemia do Gabriel est\u00e1 em 120, est\u00e1vel.', done);
  });

  it('should still treat a reading of exactly 5 minutes as current', function (done) {
    current({ subject: subject }, 5, 'A glicemia do Gabriel est\u00e1 em 120, est\u00e1vel.', done);
  });

  it('should add the age once the reading is older than 5 minutes', function (done) {
    current({}, 6, 'A sua glicemia h\u00e1 6 minutos era de 120, est\u00e1vel.', done);
  });

  it('should add the age to a stale reading', function (done) {
    current({}, 30, 'A sua glicemia h\u00e1 30 minutos era de 120, est\u00e1vel.', done);
  });

  it('should add the age to a stale reading about the configured person', function (done) {
    current({ subject: subject }, 30, 'A glicemia do Gabriel h\u00e1 30 minutos era de 120, est\u00e1vel.', done);
  });

  it('should always include the age in the summary', function (done) {
    ageMinutes = 5;
    handlers.rollup({ subject: subject }, sbx, function (err, result) {
      result.results.should.equal('A glicemia do Gabriel h\u00e1 5 minutos era de 120, est\u00e1vel.');
      done();
    });
  });
});
