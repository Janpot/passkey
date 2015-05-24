'use strict';

var redis = require('then-redis');
var assert = require('chai').assert;
var passkey = require('..');
var Promise = require('bluebird');

describe('passkey', function () {

  var client = redis.createClient({ host: '192.168.59.103', port: 6379 });
  var keychain = passkey(client);

  beforeEach(function () {
    return client.flushall();
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

  it('should error when calling ttl with no arguments', function () {

    return keychain.lock('test', 1000)
      .then(function (lock) {
        return lock.ttl();
      })
      .then(function () {
        assert(false, 'Expected to fail');
      }, function (err) {
        assert.notInstanceOf(err, passkey.LockError);
        assert.strictEqual(err.message, '.ttl must be called with a number');
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

});
