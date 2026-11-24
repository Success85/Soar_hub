// Lets CLI scripts (seed, worker, create-admin) import server modules guarded by "server-only".
const Module = require("module");
const path = require("path");
const stub = path.join(__dirname, "server-only-stub.cjs");
const orig = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === "server-only") return stub;
  return orig.call(this, request, ...rest);
};
