if (typeof globalThis.DOMMatrix === 'undefined') {
  globalThis.DOMMatrix = class DOMMatrix { constructor() {} };
}
if (typeof globalThis.ImageData === 'undefined') {
  globalThis.ImageData = class ImageData { constructor() {} };
}
if (typeof globalThis.Path2D === 'undefined') {
  globalThis.Path2D = class Path2D { constructor() {} };
}

import app from '../server/src/app.js';

export default function handler(req, res) {
  return app(req, res);
}
