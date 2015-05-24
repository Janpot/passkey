local key = unpack(KEYS)

local id, ttl = unpack(ARGV)

local content = redis.call("GET", key)
local isOwner = content == id

if isOwner then
  redis.call("PEXPIRE", key, ttl)
end

return isOwner
