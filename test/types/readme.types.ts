// ./test/types/readme.types.ts
//
// The README's examples, as written, must compile against the built types in
// strict and loose mode. Each block is wrapped in a function so names do not
// clash; keep it in step with README.md.
import dom, {
  button, button as buttonEl, byId, canvas, createDom, div, input, input as inputEl, tag,
} from '../../dist/types/id-dom.js';

declare function save(): void;
declare function save(value?: string): void;

function quickStart() {
  const saveBtn = dom.button('saveBtn');
  saveBtn.addEventListener('click', save);
}

function namedImports() {
  const saveBtn = button('saveBtn');
  const email = input('email');
  const panel = div('mainPanel');
  return [saveBtn, email, panel];
}

function optionalAccess() {
  const debug = dom.div.optional('debugPanel');
  debug?.append('hello');
  const maybeCanvas = canvas.opt('game');
  return maybeCanvas;
}

// Choosing an import style.
function nameClash() {
  // @ts-expect-error the local `button` shadows the import (used before its declaration)
  const button = button('saveBtn'); // error: the local `button` shadows the import
  return button;
}

function defaultObjectStyle() {
  function wireToolbar() {
    const button = dom.button('saveBtn');
    const input = dom.input.opt('title');
    button.addEventListener('click', () => save(input?.value));
  }
  return wireToolbar;
}

function aliasedImports() {
  const button = buttonEl('saveBtn');
  const input = inputEl.opt('title');
  return [button, input];
}

function byIdOneOff() {
  return byId('saveBtn', HTMLButtonElement);
}

function defaultExport() {
  const name = dom.input('nameInput');
  const submit = dom.button('submitBtn');
  return [name, submit];
}

function createDomExample() {
  const d = createDom(document, { mode: 'null', warn: true });
  const sidebar = d.div('sidebar');
  return sidebar;
}

function byIdExamples() {
  const btn = byId('saveBtn', HTMLButtonElement);
  const maybeBtn = byId.optional('saveBtn', HTMLButtonElement);
  const maybeBtn2 = byId.opt('saveBtn', HTMLButtonElement);
  return [btn, maybeBtn, maybeBtn2];
}

function tagExamples(container: Element) {
  const main = tag('appMain', 'main');
  const icon = tag('icon', 'svg', { root: container });
  const maybeMain = tag.optional('appMain', 'main');
  const maybeMain2 = tag.opt('appMain', 'main');
  return [main, icon, maybeMain, maybeMain2];
}

function optionalGetters() {
  return [dom.canvas.optional('game'), dom.canvas.opt('game')];
}

function errorHandling() {
  const d = createDom(document, { mode: 'null' });
  d.button('missing'); // null

  const reporting = createDom(document, {
    mode: 'null',
    onError: (err, ctx) => {
      // sendToSentry({ err, ctx })
      void err.message;
      void ctx;
    },
  });

  createDom(document, { mode: 'null', warn: true });
  return reporting;
}

function shadowDom() {
  const host = dom.el('widget');
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<button id="shadowBtn">Click</button>`;

  const d = createDom(shadow);
  const btn = d.button('shadowBtn');
  return btn;
}

function elementRoot() {
  const container = dom.el('settings-panel');
  const d = createDom(container);
  const input = d.input('emailInput');
  return input;
}

function svgInScopedRoot() {
  const container = dom.el('icons');
  const d = createDom(container);
  const icon = d.svg('logoMark');
  return icon;
}

export {
  nameClash, defaultObjectStyle, aliasedImports, byIdOneOff,
  quickStart, namedImports, optionalAccess, defaultExport, createDomExample, byIdExamples,
  tagExamples, optionalGetters, errorHandling, shadowDom, elementRoot, svgInScopedRoot,
};
