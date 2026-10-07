// ./test/types/node16/consumer.cts
//
// A CommonJS consumer under `module: node16`. It imports the package by name,
// so TypeScript resolves the `require` condition of package.json `exports`,
// the same path Node takes to dist/index.cjs. The types must describe that
// CommonJS file: named exports on the module object, the default under
// `.default` (esbuild's CJS output).
import idDom = require('id-dom');

const strict: HTMLButtonElement = idDom.button('save');
const fromDefault: HTMLDialogElement = idDom.default.byId('settings', HTMLDialogElement);
const scoped: HTMLInputElement | null = idDom.createDom(document, { mode: 'null' }).input('email');
const optional: Element | null = idDom.tag.opt('app', 'main');

export = { strict, fromDefault, scoped, optional };
