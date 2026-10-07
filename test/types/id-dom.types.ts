// ./test/types/id-dom.types.ts
//
// Type-level tests, checked against the built dist/types/id-dom.d.ts (what
// consumers install) by `npm run test:types`, in strict and loose mode. A
// wrong return type is a compile error. Not a vitest file: it has no runtime.
import dom, { body, button, byId, createDom, main, tag, type DomConfig } from '../../dist/types/id-dom.js';

type Equal<A, B> = (<G>() => G extends A ? 1 : 2) extends (<G>() => G extends B ? 1 : 2) ? true : false;
const expectType = <T extends true>(_?: unknown) => {};

declare const config: DomConfig;

// byId: throw mode (the default, explicit, or with other options) is non-null.
expectType<Equal<ReturnType<typeof byIdDefault>, HTMLDialogElement>>();
function byIdDefault() { return byId('settings', HTMLDialogElement); }
const thrown = byId('settings', HTMLDialogElement, { mode: 'throw' });
expectType<Equal<typeof thrown, HTMLDialogElement>>();
const warned = byId('settings', HTMLDialogElement, { warn: true, onError: () => {} });
expectType<Equal<typeof warned, HTMLDialogElement>>();

// byId: 'null' mode, an unknown mode, and .optional/.opt can return null.
const nullMode = byId('settings', HTMLDialogElement, { mode: 'null' });
expectType<Equal<typeof nullMode, HTMLDialogElement | null>>();
const unknownMode = byId('settings', HTMLDialogElement, config);
expectType<Equal<typeof unknownMode, HTMLDialogElement | null>>();
const optional = byId.optional('settings', HTMLDialogElement);
expectType<Equal<typeof optional, HTMLDialogElement | null>>();
const opt = byId.opt('settings', HTMLDialogElement);
expectType<Equal<typeof opt, HTMLDialogElement | null>>();

// tag: Element (not the tag's interface), non-null in throw mode.
const tagged = tag('app', 'main');
expectType<Equal<typeof tagged, Element>>();
const taggedNull = tag('app', 'main', { mode: 'null' });
expectType<Equal<typeof taggedNull, Element | null>>();
const taggedOpt = tag.opt('app', 'main');
expectType<Equal<typeof taggedOpt, Element | null>>();

// Named helpers and the default export are throw-mode.
expectType<Equal<ReturnType<typeof button>, HTMLButtonElement>>();
expectType<Equal<ReturnType<typeof button.opt>, HTMLButtonElement | null>>();
expectType<Equal<ReturnType<typeof main>, HTMLElement>>();
expectType<Equal<ReturnType<typeof body>, HTMLBodyElement>>();
const fromDefault = dom.byId('settings', HTMLDialogElement);
expectType<Equal<typeof fromDefault, HTMLDialogElement>>();

// createDom: a throw scope is non-null; a 'null' or unknown scope is nullable
// on base calls; .opt is always nullable.
const strictScope = createDom(document);
expectType<Equal<ReturnType<typeof strictScope.button>, HTMLButtonElement>>();
expectType<Equal<ReturnType<typeof strictScope.tag>, Element>>();
const strictScopeById = strictScope.byId('settings', HTMLDialogElement);
expectType<Equal<typeof strictScopeById, HTMLDialogElement>>();

const nullScope = createDom(document, { mode: 'null', warn: true });
expectType<Equal<ReturnType<typeof nullScope.button>, HTMLButtonElement | null>>();
expectType<Equal<ReturnType<typeof nullScope.tag>, Element | null>>();
expectType<Equal<ReturnType<typeof nullScope.div.opt>, HTMLDivElement | null>>();
const nullScopeById = nullScope.byId('settings', HTMLDialogElement);
expectType<Equal<typeof nullScopeById, HTMLDialogElement | null>>();

const unknownScope = createDom(document, config);
expectType<Equal<ReturnType<typeof unknownScope.input>, HTMLInputElement | null>>();

// Usage the types must allow: strict results dereference without a check.
button('save').addEventListener('click', () => {});
byId('settings', HTMLDialogElement).showModal();
