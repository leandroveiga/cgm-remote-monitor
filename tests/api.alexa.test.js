'use strict';

const fs = require('fs');
const request = require('supertest');
const language = require('../lib/language')(fs);

const bodyParser = require('body-parser');

require('should');

describe('Alexa REST api', function ( ) {
  this.timeout(10000);
  const apiRoot = require('../lib/api/root');
  const api = require('../lib/api/');
  before(function (done) {
    delete process.env.API_SECRET;
    process.env.API_SECRET = 'this is my long pass phrase';
    var env = require('../lib/server/env')( );
    env.settings.enable = ['alexa'];
    env.settings.authDefaultRoles = 'readable';
    env.api_secret = 'this is my long pass phrase';
    this.wares = require('../lib/middleware/')(env);
    this.app = require('express')( );
    this.app.enable('api');
    var self = this;
    require('../lib/server/bootevent')(env, language).boot(function booted (ctx) {
      self.app.use('/api', bodyParser({
        limit: 1048576 * 50
      }), apiRoot(env, ctx));

      self.app.use('/api/v1', bodyParser({
        limit: 1048576 * 50
      }), api(env, ctx));
      done( );
    });
  });

  it('Launch Request', function (done) {
    request(this.app)
      .post('/api/v1/alexa')
      .send({
        "request": {
          "type": "LaunchRequest",
          "locale": "en-US"
        }
      })
      .expect(200)
      .end(function (err, res)  {
        if (err) return done(err);

        const launchText = 'What would you like to check on Nightscout?';

        res.body.response.outputSpeech.text.should.equal(launchText);
        res.body.response.reprompt.outputSpeech.text.should.equal(launchText);
        res.body.response.shouldEndSession.should.equal(false);
        done( );
      });
  });

  it('Launch Request With Intent', function (done) {
    request(this.app)
      .post('/api/v1/alexa')
      .send({
        "request": {
          "type": "LaunchRequest",
          "locale": "en-US",
          "intent": {
            "name": "UNKNOWN"
          }
        }
      })
      .expect(200)
      .end(function (err, res)  {
        if (err) return done(err);

        const unknownIntentText = 'I\'m sorry, I don\'t know what you\'re asking for.';

        res.body.response.outputSpeech.text.should.equal(unknownIntentText);
        res.body.response.shouldEndSession.should.equal(true);
        done( );
      });
  });

  it('Session Ended', function (done) {
    request(this.app)
      .post('/api/v1/alexa')
      .send({
        "request": {
          "type": "SessionEndedRequest",
          "locale": "en-US"
        }
      })
      .expect(200)
      .end(function (err)  {
        if (err) return done(err);

        done( );
      });
  });
});

describe('Alexa REST api - voice record intents', function ( ) {
  this.timeout(10000);
  const crypto = require('crypto');
  const apiRoot = require('../lib/api/root');
  const api = require('../lib/api/');
  const secret = 'this is my long pass phrase';
  const secretHash = crypto.createHash('sha1').update(secret).digest('hex');
  let created = [];
  const ptLanguage = require('../lib/language')(fs);
  ptLanguage.set('br');
  ptLanguage.loadLocalization(fs);
  function intentBody (name, slotName, value, overrides) {
    const body = {
      session: { application: { applicationId: 'amzn1.ask.skill.test' } }
      , request: {
        type: 'IntentRequest'
        , locale: 'pt-BR'
        , requestId: 'amzn1.echo-api.request.' + Math.random()
        , timestamp: new Date().toISOString()
        , intent: {
          name: name
          , confirmationStatus: 'CONFIRMED'
          , slots: {}
        }
      }
    };
    body.request.intent.slots[slotName] = { name: slotName, value: value };
    Object.assign(body.request.intent, overrides && overrides.intent);
    Object.assign(body.request, overrides && overrides.request);
    return body;
  }

  before(function (done) {
    delete process.env.API_SECRET;
    process.env.API_SECRET = secret;
    var env = require('../lib/server/env')( );
    env.settings.enable = ['alexa'];
    env.settings.authDefaultRoles = 'readable';
    env.api_secret = secret;
    env.extendedSettings.alexa = { recordEnabled: true, maxInsulin: 10, maxCarbs: 150, skillId: 'amzn1.ask.skill.test' };
    this.env = env;
    this.app = require('express')( );
    this.app.enable('api');
    var self = this;
    require('../lib/server/bootevent')(env, ptLanguage).boot(function booted (ctx) {
      const realCreate = ctx.treatments.create;
      ctx.treatments.create = function (objs, fn) {
        created = created.concat(objs);
        realCreate.call(ctx.treatments, objs, fn);
      };
      self.ctx = ctx;
      self.app.use('/api', bodyParser({ limit: 1048576 * 50 }), apiRoot(env, ctx));
      self.app.use('/api/v1', bodyParser({ limit: 1048576 * 50 }), api(env, ctx));
      done( );
    });
  });

  beforeEach(function () { created = []; });

  function post (app, body, withSecret) {
    const r = request(app).post('/api/v1/alexa');
    if (withSecret) { r.set('api-secret', secretHash); }
    return r.send(body).expect(200);
  }

  it('records insulin when confirmed, authorized and within limits', function (done) {
    post(this.app, intentBody('RecordInsulin', 'units', '2.5'), true).end(function (err, res) {
      if (err) return done(err);
      res.body.response.outputSpeech.text.should.equal('Registrei 2.5 unidades de insulina.');
      created.length.should.equal(1);
      created[0].insulin.should.equal(2.5);
      created[0].enteredBy.should.equal('Alexa');
      done( );
    });
  });

  it('records carbs when confirmed, authorized and within limits', function (done) {
    post(this.app, intentBody('RecordCarbs', 'grams', '30'), true).end(function (err, res) {
      if (err) return done(err);
      res.body.response.outputSpeech.text.should.equal('Registrei 30 gramas de carboidratos.');
      created[0].carbs.should.equal(30);
      done( );
    });
  });

  it('refuses without create permission', function (done) {
    post(this.app, intentBody('RecordInsulin', 'units', '2'), false).end(function (err, res) {
      if (err) return done(err);
      res.body.response.outputSpeech.text.should.containEql('n\u00e3o tem permiss\u00e3o');
      created.length.should.equal(0);
      done( );
    });
  });

  it('refuses when not confirmed', function (done) {
    const body = intentBody('RecordInsulin', 'units', '2', { intent: { confirmationStatus: 'NONE' } });
    post(this.app, body, true).end(function (err, res) {
      if (err) return done(err);
      created.length.should.equal(0);
      res.body.response.outputSpeech.text.should.containEql('recusado');
      done( );
    });
  });

  it('does not record when the user denies confirmation', function (done) {
    const body = intentBody('RecordCarbs', 'grams', '20', { intent: { confirmationStatus: 'DENIED' } });
    post(this.app, body, true).end(function (err, res) {
      if (err) return done(err);
      created.length.should.equal(0);
      res.body.response.outputSpeech.text.should.equal('Ok, n\u00e3o registrei nada.');
      done( );
    });
  });

  it('refuses values above the limit', function (done) {
    post(this.app, intentBody('RecordInsulin', 'units', '50'), true).end(function (err, res) {
      if (err) return done(err);
      created.length.should.equal(0);
      res.body.response.outputSpeech.text.should.containEql('passa do limite');
      done( );
    });
  });

  it('refuses invalid values', function (done) {
    post(this.app, intentBody('RecordCarbs', 'grams', '?'), true).end(function (err, res) {
      if (err) return done(err);
      created.length.should.equal(0);
      res.body.response.outputSpeech.text.should.containEql('N\u00e3o entendi');
      done( );
    });
  });

  it('refuses a different skill id', function (done) {
    const body = intentBody('RecordInsulin', 'units', '2');
    body.session.application.applicationId = 'amzn1.ask.skill.other';
    post(this.app, body, true).end(function (err, res) {
      if (err) return done(err);
      created.length.should.equal(0);
      res.body.response.outputSpeech.text.should.containEql('recusado');
      done( );
    });
  });

  it('refuses stale timestamps', function (done) {
    const body = intentBody('RecordInsulin', 'units', '2', { request: { timestamp: new Date(Date.now() - 600000).toISOString() } });
    post(this.app, body, true).end(function (err) {
      if (err) return done(err);
      created.length.should.equal(0);
      done( );
    });
  });

  it('refuses a replayed request id', function (done) {
    const self = this;
    const body = intentBody('RecordCarbs', 'grams', '10');
    post(self.app, body, true).end(function (err) {
      if (err) return done(err);
      post(self.app, body, true).end(function (err2, res) {
        if (err2) return done(err2);
        created.length.should.equal(1);
        res.body.response.outputSpeech.text.should.containEql('recusado');
        done( );
      });
    });
  });
});



describe('Alexa REST api - third person (ALEXA_PATIENT_NAME)', function ( ) {
  this.timeout(10000);
  const apiRoot = require('../lib/api/root');
  const api = require('../lib/api/');
  const secret = 'this is my long pass phrase';
  const ptLanguage = require('../lib/language')(fs);
  ptLanguage.set('br');
  ptLanguage.loadLocalization(fs);

  function metricBody (name) {
    return {
      request: {
        type: 'IntentRequest'
        , locale: 'pt-BR'
        , requestId: 'amzn1.echo-api.request.' + Math.random()
        , timestamp: new Date().toISOString()
        , intent: {
          name: 'MetricNow'
          , slots: {
            metric: {
              name: 'metric'
              , resolutions: { resolutionsPerAuthority: [{ status: { code: 'ER_SUCCESS_MATCH' }, values: [{ value: { name: name } }] }] }
            }
          }
        }
      }
    };
  }

  function statusBody () {
    return { request: { type: 'IntentRequest', locale: 'pt-BR', requestId: 'amzn1.echo-api.request.' + Math.random(), timestamp: new Date().toISOString(), intent: { name: 'NSStatus', slots: { pwd: { name: 'pwd', value: 'Gabriel' } } } } };
  }

  function bootApp (extra, self, done) {
    delete process.env.API_SECRET;
    process.env.API_SECRET = secret;
    var env = require('../lib/server/env')( );
    env.settings.enable = ['alexa', 'iob', 'cob', 'basal'];
    env.settings.authDefaultRoles = 'readable';
    env.api_secret = secret;
    env.extendedSettings.alexa = extra;
    self.app = require('express')( );
    self.app.enable('api');
    require('../lib/server/bootevent')(env, ptLanguage).boot(function booted (ctx) {
      self.ctx = ctx;
      appCtx = ctx;
      self.app.use('/api', bodyParser({ limit: 1048576 * 50 }), apiRoot(env, ctx));
      self.app.use('/api/v1', bodyParser({ limit: 1048576 * 50 }), api(env, ctx));
      ctx.entries.create([{ type: 'sgv', sgv: 150, direction: 'SingleUp', date: Date.now(), dateString: new Date().toISOString(), device: 'alexa-test' }], function (err) {
        done(err);
      });
    });
  }

  let appCtx;

  after(function (done) {
    appCtx.entries.remove({ find: { device: 'alexa-test' } }, function () { done( ); });
  });

  describe('configured', function () {
    before(function (done) { bootApp({ patientName: 'Gabriel', patientPreposition: 'do' }, this, done); });

    it('speaks the current glucose about the person', function (done) {
      request(this.app).post('/api/v1/alexa').send(metricBody('bg')).expect(200).end(function (err, res) {
        if (err) return done(err);
        res.body.response.outputSpeech.text.should.equal('A glicemia do Gabriel est\u00e1 em 150, subindo.');
        done( );
      });
    });

    it('speaks the insulin on board about the person', function (done) {
      request(this.app).post('/api/v1/alexa').send(metricBody('iob')).expect(200).end(function (err, res) {
        if (err) return done(err);
        res.body.response.outputSpeech.text.should.match(/^(Gabriel possui [\d.]+ unidades? de insulina ativa|No momento n\u00e3o h\u00e1 insulina ativa do Gabriel\.)$/);
        done( );
      });
    });

    it('summarises glucose and insulin without the basal', function (done) {
      request(this.app).post('/api/v1/alexa').send(statusBody()).expect(200).end(function (err, res) {
        if (err) return done(err);
        const text = res.body.response.outputSpeech.text;
        text.should.startWith('A glicemia do Gabriel ');
        text.should.containEql('subindo').and.match(/ (e possui [\d.]+ unidades? de insulina ativa|e n\u00e3o possui insulina ativa)\.$/);
        text.should.not.containEql('basal');
        done( );
      });
    });

    it('does not duplicate separators in the summary', function (done) {
      request(this.app).post('/api/v1/alexa').send(statusBody()).expect(200).end(function (err, res) {
        if (err) return done(err);
        res.body.response.outputSpeech.text.should.not.match(/\s{2,}/);
        done( );
      });
    });
  });

  describe('not configured', function () {
    before(function (done) { bootApp({}, this, done); });

    it('keeps the first person', function (done) {
      request(this.app).post('/api/v1/alexa').send(metricBody('bg')).expect(200).end(function (err, res) {
        if (err) return done(err);
        res.body.response.outputSpeech.text.should.equal('A sua glicemia est\u00e1 em 150, subindo.');
        done( );
      });
    });
  });
});
