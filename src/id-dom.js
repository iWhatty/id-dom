// id-dom.js
// id-dom — deterministic DOM element getters by ID (typed, tiny, modern)
//
// Goals:
// - Prefer getElementById (fast, unambiguous)
// - Return the correct type or fail predictably
// - Provide strict + optional variants
// - Allow app/module-level defaults (throw vs null) without bundler magic
// - Zero deps, framework-agnostic

const DEFAULT_ROOT =
    typeof document !== 'undefined' && document ? document : /** @type {any} */ (null)

const REASON = /** @type {const} */ ({
    INVALID_ID: 'invalid-id',
    INVALID_TYPE: 'invalid-type',
    INVALID_TAG: 'invalid-tag',
    MISSING: 'missing',
    WRONG_TYPE: 'wrong-type',
    WRONG_TAG: 'wrong-tag',
})

const SAFE_ID_RE = /^[A-Za-z_][A-Za-z0-9_-]*$/
const NEEDS_START_ESCAPE_RE = /^(?:\d|-\d)/

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
 * The callable shape exposed by every typed helper (`input`, `button`, …)
 * and tag helper (`main`, `section`, …). The base call follows the helper's
 * default `mode` (typically `'throw'`); `.optional`/`.opt` always return `T | null`.
 *
 * @template T
 * @typedef {((id: string) => T) & {
 *   optional: (id: string) => T | null,
 *   opt: (id: string) => T | null
 * }} TypedHelper
 */

/**
 * Aggregate API returned by {@link createDom}. Mirrors the named exports
 * but is scoped to the configured root.
 *
 * SSR behavior (0.0.6+): typed-element helpers are *always callable*.
 * In a non-DOM environment where the corresponding global constructor
 * is undefined (Node without jsdom, edge runtimes), the base call
 * throws a clear "DOM required" error and `.optional` / `.opt` return
 * `null`. This matches the throw / null semantics consumers already
 * expect from the browser path.
 *
 * @typedef {{
 *   byId: (<T extends Element>(id: string, Type: { new (...args: any[]): T }) => T) & {
 *     optional: <T extends Element>(id: string, Type: { new (...args: any[]): T }) => T | null,
 *     opt: <T extends Element>(id: string, Type: { new (...args: any[]): T }) => T | null
 *   },
 *   tag: ((id: string, tagName: string) => Element) & {
 *     optional: (id: string, tagName: string) => Element | null,
 *     opt: (id: string, tagName: string) => Element | null
 *   },
 *   el: TypedHelper<HTMLElement>,
 *   input: TypedHelper<HTMLInputElement>,
 *   button: TypedHelper<HTMLButtonElement>,
 *   textarea: TypedHelper<HTMLTextAreaElement>,
 *   select: TypedHelper<HTMLSelectElement>,
 *   form: TypedHelper<HTMLFormElement>,
 *   div: TypedHelper<HTMLDivElement>,
 *   span: TypedHelper<HTMLSpanElement>,
 *   label: TypedHelper<HTMLLabelElement>,
 *   canvas: TypedHelper<HTMLCanvasElement>,
 *   template: TypedHelper<HTMLTemplateElement>,
 *   svg: TypedHelper<SVGSVGElement>,
 *   body: TypedHelper<HTMLBodyElement>,
 *   main: TypedHelper<HTMLElement>,
 *   section: TypedHelper<HTMLElement>,
 *   small: TypedHelper<HTMLElement>
 * }} DomApi
 */

// -----------------------------------------------------------------------------
// Config
// -----------------------------------------------------------------------------

/**
 * @param {DomConfig | undefined} cfg
 */
function normalizeConfig(cfg) {
    return {
        mode: cfg?.mode ?? 'throw',
        warn: cfg?.warn ?? false,
        onError: typeof cfg?.onError === 'function' ? cfg.onError : null,
        root: cfg?.root ?? DEFAULT_ROOT,
    }
}

// -----------------------------------------------------------------------------
// Root / DOM helpers
// -----------------------------------------------------------------------------

/**
 * @param {unknown} v
 * @returns {v is { getElementById(id: string): Element | null }}
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
 * Minimal CSS.escape fallback for environments where CSS.escape is missing.
 * We only need to safely build `#${id}` selectors.
 *
 * @param {string} id
 * @returns {string}
 */
function cssEscape(id) {
    const s = String(id)

    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
        return CSS.escape(s)
    }

    if (!NEEDS_START_ESCAPE_RE.test(s) && SAFE_ID_RE.test(s)) return s

    let out = ''
    for (let i = 0; i < s.length;) {
        const cp = s.codePointAt(i)
        const ch = String.fromCodePoint(cp)

        const isAsciiSafe =
            (cp >= 48 && cp <= 57) || // 0-9
            (cp >= 65 && cp <= 90) || // A-Z
            (cp >= 97 && cp <= 122) || // a-z
            cp === 95 || // _
            cp === 45 // -

        const next = s.codePointAt(i + 1)
        const startsWithDigit = cp >= 48 && cp <= 57
        const startsWithDashDigit = cp === 45 && s.length > 1 && next >= 48 && next <= 57
        const needsStartEscape = i === 0 && (startsWithDigit || startsWithDashDigit)

        if (!needsStartEscape && (isAsciiSafe || cp >= 0x00a0)) {
            out += ch
        } else if (i === 0 && startsWithDashDigit) {
            out += '\\-'
        } else {
            out += `\\${cp.toString(16).toUpperCase()} `
        }

        i += ch.length
    }

    return out
}

/**
 * @param {unknown} v
 * @returns {v is Element}
 */
function isElementNode(v) {
    if (!v || typeof v !== 'object') return false
    if (typeof Element !== 'undefined') return v instanceof Element
    return /** @type {any} */ (v).nodeType === 1
}

/**
 * Resolve an element by id from a root.
 * Supports:
 *  - Document (getElementById)
 *  - ShadowRoot / DocumentFragment / Element (querySelector fallback)
 *
 * @param {any} root
 * @param {string} id
 * @returns {Element | null}
 */
function getById(root, id) {
    if (!root) return null

    if (hasGetElementById(root)) return root.getElementById(id)

    if (hasQuerySelector(root)) {
        const el = root.querySelector(`#${cssEscape(id)}`)
        return isElementNode(el) ? el : null
    }

    return null
}

// -----------------------------------------------------------------------------
// Validation helpers
// -----------------------------------------------------------------------------

/**
 * @param {unknown} v
 * @returns {v is string}
 */
function isValidId(v) {
    return typeof v === 'string' && v.length > 0
}

/**
 * @param {unknown} v
 * @returns {v is string}
 */
function isValidTagName(v) {
    return typeof v === 'string' && v.trim().length > 0
}

/**
 * @param {unknown} v
 * @returns {v is Function}
 */
function isConstructor(v) {
    return typeof v === 'function'
}

// -----------------------------------------------------------------------------
// Error / policy helpers
// -----------------------------------------------------------------------------

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
 * @returns {Error}
 */
function missingElError(id, expected) {
    return new Error(`id-dom: missing ${expected} element ${fmtId(id)}`)
}

/**
 * @param {string} id
 * @param {string} expected
 * @param {string} got
 * @returns {Error}
 */
function wrongTypeError(id, expected, got) {
    return new Error(`id-dom: expected ${expected} for ${fmtId(id)}, got ${got}`)
}

/**
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
        // reporting must never break app logic
    }

    if (cfg.warn) console.warn(err, ctx)

    if (cfg.mode === 'throw') throw err
    return null
}

/**
 * @param {string} id
 * @param {any} root
 * @param {string} reason
 * @param {object} [extra]
 * @returns {any}
 */
function createCtx(id, root, reason, extra) {
    return {
        id,
        root,
        reason,
        ...(extra || {}),
    }
}

// -----------------------------------------------------------------------------
// Internal generic resolver
// -----------------------------------------------------------------------------

/**
 * @template T
 * @param {DomConfig | undefined} config
 * @param {{
 *   id: string,
 *   validateInput: (cfg: ReturnType<typeof normalizeConfig>) => { err: Error, ctx: any } | null,
 *   onMissing: (cfg: ReturnType<typeof normalizeConfig>) => { err: Error, ctx: any },
 *   matches: (el: Element, cfg: ReturnType<typeof normalizeConfig>) => boolean,
 *   onMismatch: (el: Element, cfg: ReturnType<typeof normalizeConfig>) => { err: Error, ctx: any },
 * }} spec
 * @returns {T | null}
 */
function resolveLookup(config, spec) {
    const cfg = normalizeConfig(config)

    const inputFailure = spec.validateInput(cfg)
    if (inputFailure) {
        return handleLookupError(inputFailure.err, inputFailure.ctx, cfg)
    }

    const el = getById(cfg.root, spec.id)
    if (!el) {
        const failure = spec.onMissing(cfg)
        return handleLookupError(failure.err, failure.ctx, cfg)
    }

    if (!spec.matches(el, cfg)) {
        const failure = spec.onMismatch(el, cfg)
        return handleLookupError(failure.err, failure.ctx, cfg)
    }

    return /** @type {T} */ (el)
}

// -----------------------------------------------------------------------------
// Public APIs
// -----------------------------------------------------------------------------

/**
 * Typed lookup by ID.
 *
 * @template {Element} T
 * @param {string} id
 * @param {{ new (...args: any[]): T }} Type
 * @param {DomConfig} [config]
 * @returns {T | null}
 */
export function byId(id, Type, config) {
    return resolveLookup(config, {
        id,

        validateInput(cfg) {
            if (!isValidId(id)) {
                return {
                    err: new Error('id-dom: invalid id (expected non-empty string)'),
                    ctx: createCtx(String(id), cfg.root, REASON.INVALID_ID, { Type }),
                }
            }

            if (!isConstructor(Type)) {
                return {
                    err: new Error(`id-dom: invalid Type for ${fmtId(id)}`),
                    ctx: createCtx(id, cfg.root, REASON.INVALID_TYPE, { Type }),
                }
            }

            return null
        },

        onMissing(cfg) {
            return {
                err: missingElError(id, Type.name),
                ctx: createCtx(id, cfg.root, REASON.MISSING, { Type }),
            }
        },

        matches(el) {
            return el instanceof Type
        },

        onMismatch(el, cfg) {
            const got = el?.constructor?.name || typeof el
            return {
                err: wrongTypeError(id, Type.name, got),
                ctx: createCtx(id, cfg.root, REASON.WRONG_TYPE, { Type, got }),
            }
        },
    })
}

/**
 * Optional typed lookup: always returns T | null.
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

byId.opt = byId.optional

/**
 * Tag-name lookup by element tag.
 * Useful when constructor checks are not the right fit.
 *
 * @param {string} id
 * @param {string} tagName
 * @param {DomConfig} [config]
 * @returns {Element | null}
 */
export function tag(id, tagName, config) {
    return resolveLookup(config, {
        id,

        validateInput(cfg) {
            if (!isValidId(id)) {
                return {
                    err: new Error('id-dom: invalid id (expected non-empty string)'),
                    ctx: createCtx(String(id), cfg.root, REASON.INVALID_ID, { tagName }),
                }
            }

            if (!isValidTagName(tagName)) {
                return {
                    err: new Error(`id-dom: invalid tagName for ${fmtId(id)}`),
                    ctx: createCtx(id, cfg.root, REASON.INVALID_TAG, { tagName }),
                }
            }

            return null
        },

        onMissing(cfg) {
            return {
                err: missingElError(id, `<${tagName}>`),
                ctx: createCtx(id, cfg.root, REASON.MISSING, { tagName }),
            }
        },

        matches(el) {
            return String(el.tagName || '').toUpperCase() === String(tagName).toUpperCase()
        },

        onMismatch(el, cfg) {
            const expected = String(tagName).toUpperCase()
            const got = String(el.tagName || '').toUpperCase()

            return {
                err: wrongTypeError(id, `<${expected.toLowerCase()}>`, `<${got.toLowerCase()}>`),
                ctx: createCtx(id, cfg.root, REASON.WRONG_TAG, { tagName, got }),
            }
        },
    })
}

/**
 * Optional tag lookup: always returns Element | null.
 *
 * @param {string} id
 * @param {string} tagName
 * @param {DomConfig} [config]
 * @returns {Element | null}
 */
tag.optional = function tagOptional(id, tagName, config) {
    return tag(id, tagName, { ...config, mode: 'null' })
}

tag.opt = tag.optional

// -----------------------------------------------------------------------------
// Helper registries
// -----------------------------------------------------------------------------

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
    body: typeof HTMLBodyElement !== 'undefined' ? HTMLBodyElement : null,
})

const TAG_HELPERS = /** @type {Record<string, string>} */ ({
    main: 'main',
    section: 'section',
    small: 'small',
})

// -----------------------------------------------------------------------------
// Helper builders
// -----------------------------------------------------------------------------

/**
 * @template {Function} T
 * @param {T} fn
 * @param {Function} optionalFn
 * @returns {T & { optional: Function, opt: Function }}
 */
function attachOptional(fn, optionalFn) {
    if (typeof fn !== 'function') {
        throw new TypeError('id-dom: attachOptional expected fn to be a function')
    }

    if (typeof optionalFn !== 'function') {
        throw new TypeError('id-dom: attachOptional expected optionalFn to be a function')
    }

    fn.optional = optionalFn
    fn.opt = optionalFn
    return fn
}

/**
 * @param {any} Type
 * @param {ReturnType<typeof normalizeConfig>} base
 * @param {ReturnType<typeof normalizeConfig>} baseNull
 */
function makeTypedHelper(Type, base, baseNull) {
    if (!Type) {
        throw new TypeError('id-dom: makeTypedHelper received an invalid Type')
    }

    return attachOptional(
        (id) => byId(id, Type, base),
        (id) => byId(id, Type, baseNull)
    )
}

/**
 * @param {string} tagName
 * @param {ReturnType<typeof normalizeConfig>} base
 * @param {ReturnType<typeof normalizeConfig>} baseNull
 */
function makeTagHelper(tagName, base, baseNull) {
    if (!tagName) {
        throw new TypeError('id-dom: makeTagHelper received an invalid tagName')
    }

    return attachOptional(
        (id) => tag(id, tagName, base),
        (id) => tag(id, tagName, baseNull)
    )
}
// -----------------------------------------------------------------------------
// Factory
// -----------------------------------------------------------------------------

/**
 * Factory: scope getters to a specific root + default policy.
 *
 * @param {any} root
 * @param {Omit<DomConfig, 'root'>} [config]
 * @returns {DomApi}
 */
export function createDom(root, config) {
    const base = normalizeConfig({ ...config, root })
    const baseNull = { ...base, mode: 'null' }

    /** @type {any} */
    const api = {}

    api.byId = attachOptional(
        (id, Type) => byId(id, Type, base),
        (id, Type) => byId(id, Type, baseNull)
    )

    api.tag = attachOptional(
        (id, name) => tag(id, name, base),
        (id, name) => tag(id, name, baseNull)
    )

    for (const [name, Type] of Object.entries(TYPE_HELPERS)) {
        if (!Type) continue
        api[name] = makeTypedHelper(Type, base, baseNull)
    }

    for (const [name, tagName] of Object.entries(TAG_HELPERS)) {
        api[name] = makeTagHelper(tagName, base, baseNull)
    }

    return api
}

// -----------------------------------------------------------------------------
// Default-root config (shared by the default export and the named typed helpers)
// -----------------------------------------------------------------------------

const DEFAULT_BASE = normalizeConfig({ mode: 'throw', root: DEFAULT_ROOT })
const DEFAULT_BASE_NULL = { ...DEFAULT_BASE, mode: 'null' }

/**
 * Build a typed helper bound to the default root.
 * Internal — exposed via the per-helper named exports below.
 *
 * SSR-safe: when `Type` is null (the global constructor isn't defined —
 * Node without jsdom, edge runtimes, etc.) we return an *always-callable*
 * shim rather than the raw `null` that pre-0.0.6 returned. The shim
 * throws a clear "DOM required" error on the base call (matches the
 * browser's `mode: 'throw'` semantic) and returns `null` on `.optional` /
 * `.opt` (matches the browser's `mode: 'null'` semantic for opt-in
 * tolerant callers). Closes the historical footgun where SSR consumers
 * hit `TypeError: input is not a function` instead of an actionable
 * message. See host carry-forward #6 for the full context.
 *
 * @param {any} Type
 * @returns {TypedHelper<any>}
 */
function defaultTypedHelper(Type) {
    if (Type) return makeTypedHelper(Type, DEFAULT_BASE, DEFAULT_BASE_NULL)

    const ssrThrow = /** @type {any} */ (function ssrUnavailable() {
        throw new Error(
            'id-dom: typed-element helper requires a DOM. The corresponding ' +
            'HTMLElement constructor is undefined in this environment ' +
            '(Node without jsdom, edge runtime, etc.). Use createDom() with ' +
            'a custom root, or guard SSR call sites, or use the .optional ' +
            'variant which returns null in non-DOM environments.'
        )
    })
    const ssrNull = () => null
    ssrThrow.optional = ssrNull
    ssrThrow.opt = ssrNull
    return ssrThrow
}

/**
 * Build a tag-name helper bound to the default root.
 *
 * @param {string} tagName
 */
function defaultTagHelper(tagName) {
    return makeTagHelper(tagName, DEFAULT_BASE, DEFAULT_BASE_NULL)
}

// -----------------------------------------------------------------------------
// Named typed-element helpers (per-helper exports — tree-shakeable)
//
// Each one is a `const` initialized to a tiny closure produced by
// makeTypedHelper. Modern bundlers (esbuild, rollup, vite) drop the
// unused ones because the package declares sideEffects: false.
//
// SSR-safe: in environments where the corresponding global constructor
// isn't defined (Node without jsdom, etc.), the export is `null` rather
// than a thrown construction error.
// -----------------------------------------------------------------------------

/** @type {TypedHelper<HTMLElement>} */
export const el       = defaultTypedHelper(typeof HTMLElement         !== 'undefined' ? HTMLElement         : null)
/** @type {TypedHelper<HTMLInputElement>} */
export const input    = defaultTypedHelper(typeof HTMLInputElement    !== 'undefined' ? HTMLInputElement    : null)
/** @type {TypedHelper<HTMLButtonElement>} */
export const button   = defaultTypedHelper(typeof HTMLButtonElement   !== 'undefined' ? HTMLButtonElement   : null)
/** @type {TypedHelper<HTMLTextAreaElement>} */
export const textarea = defaultTypedHelper(typeof HTMLTextAreaElement !== 'undefined' ? HTMLTextAreaElement : null)
/** @type {TypedHelper<HTMLSelectElement>} */
export const select   = defaultTypedHelper(typeof HTMLSelectElement   !== 'undefined' ? HTMLSelectElement   : null)
/** @type {TypedHelper<HTMLFormElement>} */
export const form     = defaultTypedHelper(typeof HTMLFormElement     !== 'undefined' ? HTMLFormElement     : null)
/** @type {TypedHelper<HTMLDivElement>} */
export const div      = defaultTypedHelper(typeof HTMLDivElement      !== 'undefined' ? HTMLDivElement      : null)
/** @type {TypedHelper<HTMLSpanElement>} */
export const span     = defaultTypedHelper(typeof HTMLSpanElement     !== 'undefined' ? HTMLSpanElement     : null)
/** @type {TypedHelper<HTMLLabelElement>} */
export const label    = defaultTypedHelper(typeof HTMLLabelElement    !== 'undefined' ? HTMLLabelElement    : null)
/** @type {TypedHelper<HTMLCanvasElement>} */
export const canvas   = defaultTypedHelper(typeof HTMLCanvasElement   !== 'undefined' ? HTMLCanvasElement   : null)
/** @type {TypedHelper<HTMLTemplateElement>} */
export const template = defaultTypedHelper(typeof HTMLTemplateElement !== 'undefined' ? HTMLTemplateElement : null)
/** @type {TypedHelper<SVGSVGElement>} */
export const svg      = defaultTypedHelper(typeof SVGSVGElement       !== 'undefined' ? SVGSVGElement       : null)
/** @type {TypedHelper<HTMLBodyElement>} */
export const body     = defaultTypedHelper(typeof HTMLBodyElement     !== 'undefined' ? HTMLBodyElement     : null)

// Named tag-name helpers (no dedicated constructor — return base Element)
/** @type {TypedHelper<HTMLElement>} */
export const main    = defaultTagHelper('main')
/** @type {TypedHelper<HTMLElement>} */
export const section = defaultTagHelper('section')
/** @type {TypedHelper<HTMLElement>} */
export const small   = defaultTagHelper('small')

// -----------------------------------------------------------------------------
// Default export — the convenience object aggregating every helper. Use
// named imports above for tree-shake-friendly bundles; use this default
// when you want all helpers under one namespace (`dom.button(…)`).
// -----------------------------------------------------------------------------

const dom = createDom(DEFAULT_ROOT, { mode: 'throw' })
export default dom