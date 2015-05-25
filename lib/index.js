'use strict';

var redisScripts = require('then-redis-scripts');
var uuid = require('uuid');
var path = require('path');
var Promise = require('bluebird');


var DEFAULT_TTL = 1000;


var SCRIPTS_FOLDER = path.resolve(__dirname, 'lua');
var SCRIPT_UNLOCK = path.resolve(SCRIPTS_FOLDER, 'lockUnlock.lua');
var SCRIPT_TTL = path.resolve(SCRIPTS_FOLDER, 'lockTtl.lua');


function LockError(message) {
    this.message = message;
    this.name = 'LockError';
    Error.captureStackTrace(this, LockError);
}
LockError.prototype = Object.create(Error.prototype);
LockError.prototype.constructor = LockError;


function Lock(client, key, id) {
  this._client = client;
  this._scripts = redisScripts(this._client);
  this._key = key;
  this._id = id;
}

Lock.prototype.unlock = function () {
  return this._scripts.run(SCRIPT_UNLOCK, [this._key], [this._id])
    .then(function (wasOwner) {
      if (!wasOwner) {
        throw new LockError('Not the owner of this lock');
      }
    });
};

Lock.prototype.ttl = function (ttl) {
  if (typeof ttl !== 'number') {
    return Promise.reject(new Error('.ttl must be called with a number'));
  }
  return this._scripts.run(SCRIPT_TTL, [this._key], [this._id, ttl])
    .then(function (wasOwner) {
      if (!wasOwner) {
        throw new LockError('Not the owner of this lock');
      }
    });
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
  return this._client.set(key, uniqueId, 'PX', ttl, 'NX')
    .bind(this)
    .then(function (isSet) {
      if (isSet) {
        return new Lock(this._client, key, uniqueId);
      } else {
        throw new LockError('Can\'t obtain lock');
      }
    });
};



module.exports = function (client, options) {
  return new Passkey(client, options);
};

module.exports.LockError = LockError;