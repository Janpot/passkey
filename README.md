# passkey [![Build Status][travis-image]][travis-url] [![Dependency Status][depstat-image]][depstat-url]

[travis-url]: http://travis-ci.org/Janpot/passkey
[travis-image]: http://img.shields.io/travis/Janpot/passkey.svg?style=flat

[depstat-url]: https://david-dm.org/Janpot/passkey
[depstat-image]: http://img.shields.io/david/Janpot/passkey.svg?style=flat

Shared lock built on top of [then-redis](https://www.npmjs.com/package/then-redis)

Reliable locking mechanism on Redis. Performs atomic locking and verifies ownership.

## Usage

```js
var redis = require('then-redis');
var passkey = require('passkey');

var client = redis.createClient();
var key = passkey(client, {
  ttl: 10000
});

key.lock('my-lock')
  .then(function (lock) {

    return doWork()
      .then(function () {
        // extend the lock
        return lock.ttl(10000);
      })
      .then(function () {
        return doMoreWork();
      })
      .then(function () {
        // release the lock
        return lock.unlock();
      });

  })
  .catch(passkey.LockError, function (err) {
    // lock not obtained or expired before ttl/unlock was called
  })
```

## API

`var key = passkey(client, [options])`

creates a new key that can be used to set locks, expects to be called with a `then-redis` client.
Options can be an object with following properties

 * `ttl`: time before the lock automatically expires, default: 10000ms


`key.lock(key, [ttl])`

lock a `key`, any future call to `.lock` with the same value will fail with a `promise.LockError`.
The lock will expire after `ttl` or the default time when unspecified.
returns a `Lock` instance.

`Lock.unlock()`

Release this lock so it can be obtained by another client. Fails with a `promise.LockError` if the lock is expired.

`Lock.ttl(ttl)`

Set a new ttl on this lock. This is useful to extend the lifetime of the lock. Fails with a `promise.LockError` if the lock is expired.


