local key = unpack(KEYS)

local id = unpack(ARGV)

local content = redis.call("GET", key)
local isOwner = content == id

if isOwner then
  redis.call("DEL", key)
end

return isOwner;
