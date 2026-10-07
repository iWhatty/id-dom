// ./test/types/node16/consumer.mts
//
// An ES module consumer under `module: node16`, importing the package and
// its `./min` subpath by name, through package.json `exports`.
import dom, { button, createDom } from 'id-dom';
import minDom, { byId as minById } from 'id-dom/min';

export const strict: HTMLButtonElement = button('save');
export const fromDefault: HTMLButtonElement = dom.button('save');
export const scoped: HTMLDivElement | null = createDom(document, { mode: 'null' }).div('panel');
export const fromMin: HTMLDialogElement = minById('settings', HTMLDialogElement);
export const fromMinDefault: HTMLCanvasElement | null = minDom.canvas.opt('game');
