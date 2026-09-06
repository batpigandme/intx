'use strict';

// Default export: Validated winning candidate (limb16-pipeline-imul-all, ~370M ops/sec on V8)
const wmul = require('./candidates/limb16-pipeline-imul-all');

module.exports = wmul;
