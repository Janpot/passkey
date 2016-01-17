'use strict';

var redisScripts = require('then-redis-scripts');
var uuid = require('uuid');
var path = require('path');
var Promise = require('bluebird');


var DEFAULT_TTL = 1000;


function LockError(message) {
    this.message = message;
    this.name = 'LockError';
    Error.captureStackTrace(this, LockError);
}
LockError.prototype = Object.create(Error.prototype);
LockError.prototype.constructor = LockError;


function Lock(client, key, id, ttl) {
  this._client = client;
  this._scripts = redisScripts(this._client, {
    base: path.resolve(__dirname, 'lua')
  });
  this._key = key;
  this._id = id;
  this._lastTtl = ttl;
}

Lock.prototype.unlock = function () {
  return this._scripts.run('lockUnlock.lua', [this._key], [this._id])
    .then(function (wasOwner) {
      if (!wasOwner) {
        throw new LockError('Not the owner of this lock');
      }
    });
};

Lock.prototype.ttl = function (ttl) {
  if (typeof ttl === 'undefined') {
    return Promise.fromCallback(function (callback) {
      this._client.pttl(this._key, callback);
    }.bind(this))
  } else if (typeof ttl !== 'number') {
    return Promise.reject(new Error('.ttl must be called with a number'));
  }
  this._lastTtl = ttl;
  return this._scripts.run('lockTtl.lua', [this._key], [this._id, ttl])
    .then(function (wasOwner) {
      if (!wasOwner) {
        throw new LockError('Not the owner of this lock');
      }
      return ttl;
    });
};

Lock.prototype.extend = function () {
  return this.ttl(this._lastTtl);
};




function Passkey(client, options) {
  options = options || {};
  this._ttl = options.ttl || DEFAULT_TTL;
  this._client = client;
}


Passkey.prototype.lock = function (key, ttl) {
  if (typeof key !== 'string') {
    return Promise.reject(new Error('.lock must be called with a string'));
  }
  ttl = ttl || this._ttl;
  var uniqueId = uuid.v4();
  return Promise.fromCallback(function (callback) {
    this._client.set(key, uniqueId, 'PX', ttl, 'NX', callback);
  }.bind(this))
    .bind(this)
    .then(function (isSet) {
      if (isSet) {
        return new Lock(this._client, key, uniqueId, ttl);
      } else {
        throw new LockError('Can\'t obtain lock');
      }
    });
};



module.exports = function (client, options) {
  return new Passkey(client, options);
};

module.exports.LockError = LockError;
