'use strict';

var Promise = require('bluebird');
var redis = require('redis');
var assert = require('chai').assert;
var passkey = require('..');

Promise.promisifyAll(redis.RedisClient.prototype);
Promise.promisifyAll(redis.Multi.prototype);

describe('passkey', function () {

  var client = redis.createClient({
    host: process.env.REDIS_HOST
  });
  var keychain = passkey(client);

  beforeEach(function () {
    return client.flushallAsync();
  });

  it('shouldn\'t error when no ttl', function () {

    return keychain.lock('test');

  });

  it('should lock on a key', function () {

    return keychain.lock('test', 1000)
      .then(function () {
        return keychain.lock('test', 1000)
          .then(function () {
            assert(false, 'Expected to fail');
          }, function (err) {
            assert.instanceOf(err, passkey.LockError);
          });
      });

  });

  it('should unlock a key', function () {

    return keychain.lock('test', 1000)
      .then(function (lock) {
        return lock.unlock();
      })
      .then(function () {
        return keychain.lock('test', 1000);
      });

  });

  it('should error when unlocking an expired lock', function () {

    return keychain.lock('test', 1)
      .then(function (lock) {
        return Promise.delay(10)
          .then(function () {
            return lock.unlock();
          })
          .then(function () {
            assert(false, 'Expected to fail');
          }, function (err) {
            assert.instanceOf(err, passkey.LockError);
          });
      });

  });

  it('should error when extending ttl on an expired lock', function () {

    return keychain.lock('test', 1)
      .then(function (lock) {
        return Promise.delay(10)
          .then(function () {
            return lock.ttl(1000);
          })
          .then(function () {
            assert(false, 'Expected to fail');
          }, function (err) {
            assert.instanceOf(err, passkey.LockError);
          });
      });

  });

  it('should error when calling .lock with no arguments', function () {

    return keychain.lock()
      .then(function () {
        assert(false, 'Expected to fail');
      }, function (err) {
        assert.notInstanceOf(err, passkey.LockError);
        assert.strictEqual(err.message, '.lock must be called with a string');
      });

  });
  
  it('should extend ttl', function () {
    var lock;
    return keychain.lock('test', 10)
      .then(function (_lock) {
        lock = _lock;
        return lock.ttl(100);
      })
      .then(function (ttl) {
        assert.strictEqual(ttl, 100);
        return Promise.delay(20);
      })
      .then(function () {
        return lock.ttl();
      })
      .then(function (ttl) {
        assert(ttl > 0);
      });
  });
  
  it('ttl should unlock when called with 0', function () {
    return keychain.lock('test', 1000)
      .then(function (lock) {
        return lock.ttl(0);
      })
      .then(function (ttl) {
        assert.strictEqual(ttl, 0);
        return keychain.lock('test', 1000);
      });
  });

  
  it('should extend the lock to last ttl', function () {
    var lock;
    return keychain.lock('test', 10000)
      .then(function (_lock) {
        lock = _lock;
        return Promise.fromCallback(function (cb) {
          // simulate passage of time
          client.pexpire('test', 2000, cb);
        });
      })
      .then(function () {
        return lock.ttl();
      })
      .then(function (ttl) {
        assert(ttl <= 2000, 'forced expire should have worked');
        return lock.extend();
      })
      .then(function (ttl) {
        assert(ttl > 9000);
        return lock.ttl();
      })
      .then(function (ttl) {
        assert(ttl > 9000);
        return lock.ttl(20000);
      })
      .then(function (_lock) {
        return Promise.fromCallback(function (cb) {
          // simulate passage of time
          client.pexpire('test', 2000, cb);
        });
      })
      .then(function (ttl) {
        assert(ttl <= 2000, 'forced expire should have worked');
        return lock.extend();
      })
      .then(function (ttl) {
        assert(ttl > 19000);
        return lock.ttl();
      })
      .then(function (ttl) {
        assert(ttl > 19000);
      });
  });

});
