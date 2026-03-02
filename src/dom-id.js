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


const SAFE_ID_RE = /^[A-Za-z_][A-Za-z0-9_-]*$/
const NEEDS_START_ESCAPE_RE = /^(?:\d|-\d)/

/**
 * Minimal CSS.escape fallback for environments where CSS.escape is missing (e.g. some jsdom builds).
 * We only need to safely build `#${id}` selectors.
 *
 * @param {string} id
 */
function cssEscape(id) {
  const s = String(id)

  // Prefer native when available
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(s)
  }

  // Fast path: most app IDs are already safe
  if (!NEEDS_START_ESCAPE_RE.test(s) && SAFE_ID_RE.test(s)) return s

  // One-pass escape:
  // - Escape any char outside a conservative "safe" set
  // - Also escape the start if it begins with a digit OR "-<digit>"
  let out = ''
  for (let i = 0; i < s.length; ) {
    const cp = s.codePointAt(i)
    const ch = String.fromCodePoint(cp)

    const isAsciiSafe =
      (cp >= 48 && cp <= 57) || // 0-9
      (cp >= 65 && cp <= 90) || // A-Z
      (cp >= 97 && cp <= 122) || // a-z
      cp === 95 || // _
      cp === 45 // -

    const needsStartEscape =
      i === 0 && ((cp >= 48 && cp <= 57) || (cp === 45 && s.length > 1 && s.codePointAt(1) >= 48 && s.codePointAt(1) <= 57))

    if (!needsStartEscape && (isAsciiSafe || cp >= 0x00A0)) {
      // allow non-ascii chars directly (common CSS ident behavior)
      out += ch
    } else if (cp === 45 && i === 0 && s.length > 1 && s.codePointAt(1) >= 48 && s.codePointAt(1) <= 57) {
      // "-<digit>" start: escaping just the leading hyphen is a simple fix
      out += '\\-'
    } else {
      // hex escape + trailing space is safest
      out += `\\${cp.toString(16).toUpperCase()} `
    }

    i += ch.length
  }

  return out
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
        const sel = `#${cssEscape(id)}`
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
 * Optional typed lookup: ALWAYS returns T | null (never throws for missing/wrong-type).
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

// Short alias (module-level; do not reassign inside factories)
byId.opt = byId.optional

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
 * Optional tag lookup: ALWAYS returns HTMLElement | null (never throws for missing/wrong-tag).
 *
 * @param {string} id
 * @param {string} tagName
 * @param {DomConfig} [config]
 * @returns {HTMLElement | null}
 */
tag.optional = function tagOptional(id, tagName, config) {
    return tag(id, tagName, { ...config, mode: 'null' })
}

// Short alias (module-level; do not reassign inside factories)
tag.opt = tag.optional

// --- internal maps for factory helpers ---
const TYPE_HELPERS = /** @type {Record<string, any>} */ ({
    el: typeof HTMLElement !== 'undefined' ? HTMLElement : null,
    input: typeof HTMLInputElement !== 'undefined' ? HTMLInputElement : null,
    button: typeof HTMLButtonElement !== 'undefined' ? HTMLButtonElement : null,
    textarea: typeof HTMLTextAreaElement !== 'undefined' ? HTMLTextAreaElement : null,
    select: typeof HTMLSelectElement !== 'undefined' ? HTMLSelectElement : null,
    form: typeof HTMLFormElement !== 'undefined' ? HTMLFormElement : null,
    div: typeof HTMLDivElement !== 'undefined' ? HTMLDivElement : null,
    span: typeof HTMLSpanElement !== 'undefined' ? HTMLSpanElement : null,
    label: typeof HTMLLabelElement !== 'undefined' ? HTMLLabelElement : null,
    canvas: typeof HTMLCanvasElement !== 'undefined' ? HTMLCanvasElement : null,
    template: typeof HTMLTemplateElement !== 'undefined' ? HTMLTemplateElement : null,
    svg: typeof SVGSVGElement !== 'undefined' ? SVGSVGElement : null,
})

const TAG_HELPERS = /** @type {Record<string, string>} */ ({
    main: 'main',
    section: 'section',
    small: 'small',
})

/**
 * Factory: scope getters to a specific root + default policy.
 *
 * @param {any} root
 * @param {Omit<DomConfig, 'root'>} [config]
 */
export function createDom(root, config) {
    const base = normalizeConfig({ ...config, root })
    const baseNull = { ...base, mode: 'null' }

    /** @type {any} */
    const api = {
        // generic
        byId: (id, Type) => byId(id, Type, base),
        tag: (id, name) => tag(id, name, base),
    }

    // typed helpers
    for (const [name, Type] of Object.entries(TYPE_HELPERS)) {
        if (!Type) continue
        api[name] = (id) => byId(id, Type, base)
    }

    // semantic tag helpers
    for (const [name, tagName] of Object.entries(TAG_HELPERS)) {
        api[name] = (id) => tag(id, tagName, base)
    }

    // --- Optional variants (policy-based; never swallow unrelated exceptions) ---
    api.byId.optional = (id, Type) => byId(id, Type, baseNull)
    api.byId.opt = api.byId.optional

    api.tag.optional = (id, name) => tag(id, name, baseNull)
    api.tag.opt = api.tag.optional

    // Add `.optional` + `.opt` to every helper using the same "null" policy
    for (const k of Object.keys(api)) {
        const fn = api[k]
        if (typeof fn !== 'function') continue
        if (fn.optional) continue

        if (k in TAG_HELPERS) {
            const tagName = TAG_HELPERS[k]
            fn.optional = (id) => tag(id, tagName, baseNull)
            fn.opt = fn.optional
            continue
        }

        if (k in TYPE_HELPERS) {
            const Type = TYPE_HELPERS[k]
            if (Type) {
                fn.optional = (id) => byId(id, Type, baseNull)
                fn.opt = fn.optional
            }
        }
    }

    return api
}

// Default export: root = document (if available), strict by default
const dom = createDom(DEFAULT_ROOT, { mode: 'throw' })
export default dom
