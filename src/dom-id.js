// dom-id.js
// dom-id — deterministic DOM element getters by ID (typed, tiny, modern)
//
// Goals:
// - Prefer getElementById (fast, unambiguous)
// - Return the correct type or fail predictably
// - Provide strict + optional variants
// - Allow app/module-level defaults (throw vs null) without bundler magic
// - Zero deps, framework-agnostic

const DEFAULT_ROOT =
  typeof document !== 'undefined' && document ? document : /** @type {any} */ (null)

/**
 * @typedef {'throw' | 'null'} DomMode
 */

/**
 * @typedef {{
 *   mode?: DomMode
 *   warn?: boolean
 *   onError?: (error: Error, ctx: any) => void
 *   root?: any
 * }} DomConfig
 */

/**
 * @param {DomConfig | undefined} cfg
 */
function normalizeConfig(cfg) {
  return {
    mode: cfg?.mode ?? 'throw', // default strict
    warn: cfg?.warn ?? false,
    onError: typeof cfg?.onError === 'function' ? cfg.onError : null,
    root: cfg?.root ?? DEFAULT_ROOT,
  }
}

/**
 * @param {unknown} v
 * @returns {v is { getElementById(id: string): HTMLElement | null }}
 */
function hasGetElementById(v) {
  return !!v && typeof v === 'object' && typeof v.getElementById === 'function'
}

/**
 * @param {unknown} v
 * @returns {v is { querySelector(sel: string): Element | null }}
 */
function hasQuerySelector(v) {
  return !!v && typeof v === 'object' && typeof v.querySelector === 'function'
}

/**
 * Resolve an element by id from a "root".
 * Supports:
 *  - Document (getElementById)
 *  - ShadowRoot / DocumentFragment / Element (querySelector fallback)
 *
 * @param {any} root
 * @param {string} id
 * @returns {HTMLElement | null}
 */
function getById(root, id) {
  if (!root) return null

  if (hasGetElementById(root)) return root.getElementById(id)

  // ShadowRoot/DocumentFragment/Element don’t have getElementById
  if (hasQuerySelector(root)) {
    const sel = `#${CSS.escape(id)}`
    const el = root.querySelector(sel)
    return el instanceof HTMLElement ? el : null
  }

  return null
}

/**
 * @param {string} id
 * @returns {string}
 */
function fmtId(id) {
  return id.startsWith('#') ? id : `#${id}`
}

/**
 * @param {string} id
 * @param {string} expected
 */
function missingElError(id, expected) {
  return new Error(`dom-id: missing ${expected} element ${fmtId(id)}`)
}

/**
 * @param {string} id
 * @param {string} expected
 * @param {string} got
 */
function wrongTypeError(id, expected, got) {
  return new Error(`dom-id: expected ${expected} for ${fmtId(id)}, got ${got}`)
}

/**
 * Centralized error policy:
 * - always call onError if present
 * - optionally warn
 * - throw or return null depending on mode
 *
 * @template T
 * @param {Error} err
 * @param {any} ctx
 * @param {ReturnType<typeof normalizeConfig>} cfg
 * @returns {T | null}
 */
function handleLookupError(err, ctx, cfg) {
  try {
    cfg.onError?.(err, ctx)
  } catch {
    // do not let reporting break app logic
  }

  if (cfg.warn) console.warn(err)

  if (cfg.mode === 'throw') throw err
  return null
}

/**
 * Typed lookup by ID.
 * Behavior is controlled by config:
 *  - mode: 'throw' (default) or 'null'
 *  - warn: boolean
 *  - onError(err, ctx)
 *
 * @template {Element} T
 * @param {string} id
 * @param {{ new (...args: any[]): T }} Type
 * @param {DomConfig} [config]
 * @returns {T | null}
 */
export function byId(id, Type, config) {
  const cfg = normalizeConfig(config)
  const el = getById(cfg.root, id)

  if (!el) {
    return handleLookupError(
      missingElError(id, Type.name),
      { id, Type, root: cfg.root, reason: 'missing' },
      cfg
    )
  }

  if (!(el instanceof Type)) {
    const got = el?.constructor?.name || typeof el
    return handleLookupError(
      wrongTypeError(id, Type.name, got),
      { id, Type, root: cfg.root, reason: 'wrong-type', got },
      cfg
    )
  }

  return el
}

/**
 * Optional typed lookup: ALWAYS returns T | null (never throws).
 *
 * @template {Element} T
 * @param {string} id
 * @param {{ new (...args: any[]): T }} Type
 * @param {DomConfig} [config]
 * @returns {T | null}
 */
byId.optional = function byIdOptional(id, Type, config) {
  return byId(id, Type, { ...config, mode: 'null' })
}

/**
 * Tag-name lookup (HTMLElement only).
 * Useful for semantic elements that don’t have unique constructors.
 *
 * @param {string} id
 * @param {string} tagName
 * @param {DomConfig} [config]
 * @returns {HTMLElement | null}
 */
export function tag(id, tagName, config) {
  const cfg = normalizeConfig(config)
  const el = getById(cfg.root, id)

  if (!el) {
    return handleLookupError(
      missingElError(id, `<${tagName}>`),
      { id, tagName, root: cfg.root, reason: 'missing' },
      cfg
    )
  }

  const expected = String(tagName).toUpperCase()
  const got = String(el.tagName || '').toUpperCase()

  if (got !== expected) {
    return handleLookupError(
      wrongTypeError(id, `<${expected.toLowerCase()}>`, `<${got.toLowerCase()}>`),
      { id, tagName, root: cfg.root, reason: 'wrong-tag', got },
      cfg
    )
  }

  return el
}

/**
 * Optional tag lookup: ALWAYS returns HTMLElement | null (never throws).
 *
 * @param {string} id
 * @param {string} tagName
 * @param {DomConfig} [config]
 * @returns {HTMLElement | null}
 */
tag.optional = function tagOptional(id, tagName, config) {
  return tag(id, tagName, { ...config, mode: 'null' })
}

/**
 * Factory: scope getters to a specific root + default policy.
 *
 * @param {any} root
 * @param {Omit<DomConfig, 'root'>} [config]
 */
export function createDom(root, config) {
  const base = normalizeConfig({ ...config, root })

  /** @type {any} */
  const api = {
    // generic
    byId: (id, Type) => byId(id, Type, base),
    tag: (id, name) => tag(id, name, base),

    // typed helpers
    el: (id) => byId(id, HTMLElement, base),
    input: (id) => byId(id, HTMLInputElement, base),
    button: (id) => byId(id, HTMLButtonElement, base),
    textarea: (id) => byId(id, HTMLTextAreaElement, base),
    select: (id) => byId(id, HTMLSelectElement, base),
    form: (id) => byId(id, HTMLFormElement, base),
    div: (id) => byId(id, HTMLDivElement, base),
    span: (id) => byId(id, HTMLSpanElement, base),
    label: (id) => byId(id, HTMLLabelElement, base),
    canvas: (id) => byId(id, HTMLCanvasElement, base),
    template: (id) => byId(id, HTMLTemplateElement, base),
    svg: (id) => byId(id, SVGSVGElement, base),

    // common semantic tags
    main: (id) => tag(id, 'main', base),
    section: (id) => tag(id, 'section', base),
    small: (id) => tag(id, 'small', base),
  }

  // Optional variants: force mode 'null' (never throw)
  api.byId.optional = (id, Type) => byId.optional(id, Type, base)
  api.tag.optional = (id, name) => tag.optional(id, name, base)

  // Add `.optional` to every function on the api (typed + tag helpers)
  for (const k of Object.keys(api)) {
    const fn = api[k]
    if (typeof fn !== 'function') continue
    if (fn.optional) continue

    fn.optional = (id, ...rest) => {
      // preserve base config but force no-throw
      try {
        return fn(id, ...rest)
      } catch {
        return null
      }
    }
  }

  return api
}

// Default export: root = document (if available), strict by default
const dom = createDom(DEFAULT_ROOT, { mode: 'throw' })
export default dom