// Spell Check (LanguageTool) — degoog interceptor plugin
//
// Drop-in alternative to the official Yandex-Speller spell check plugin.
// Same structure as the official plugin (interceptor + slot + skip route),
// but corrects spelling via a LanguageTool server instead of Yandex.
//
// Default backend: the public LanguageTool API (https://api.languagetool.org).
// Point it at your own self-hosted LanguageTool instance via plugin settings
// to keep every query inside your network.

const CORRECTION_TTL_MS = 15_000;
const DEFAULT_ENDPOINT = "https://api.languagetool.org/v2/check";

const _corrections = new Map();
const _skipOnce = new Set();

let _cache = null;
let _lang = "auto";
let _endpoint = DEFAULT_ENDPOINT;
let _apiBase = "";
let _tpl = "";

const BANG = /^!/;
const MIN_WORDS = 2;
const CACHE_NAMESPACE = "ext:spell-check-lt:corrections";
const CACHE_TTL_MS = 120_000;

const _resolveCache = (ctx) => {
  if (typeof ctx?.useCache === "function") {
    return ctx.useCache(CACHE_NAMESPACE, CACHE_TTL_MS);
  }
  if (typeof ctx?.createCache === "function") {
    const sync = ctx.createCache(CACHE_TTL_MS);
    return {
      get: async (k) => sync.get(k),
      set: async (k, v) => sync.set(k, v),
      delete: async (k) => {
        if (typeof sync.delete === "function") sync.delete(k);
      },
      clear: async () => sync.clear(),
    };
  }
  return null;
};

const _esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Apply LanguageTool matches (offset/length + replacements) to the query.
const _applyFixes = (query, matches) => {
  const edits = matches
    .filter(
      (m) =>
        m.replacements?.length &&
        m.replacements[0].value &&
        typeof m.offset === "number" &&
        typeof m.length === "number"
    )
    .sort((a, b) => a.offset - b.offset);

  let out = query;
  let offset = 0;
  for (const m of edits) {
    const start = m.offset + offset;
    const end = start + m.length;
    const rep = m.replacements[0].value;
    out = out.slice(0, start) + rep + out.slice(end);
    offset += rep.length - m.length;
  }
  return out;
};

export const interceptor = {
  isClientExposed: false,
  name: "Spell Check (LanguageTool)",
  description:
    "Intercepts search queries and corrects spelling using LanguageTool. " +
    "A privacy-friendly, non-Russian alternative to the Yandex Speller plugin.",

  settingsSchema: [
    {
      key: "endpoint",
      label: "LanguageTool API endpoint",
      type: "url",
      default: DEFAULT_ENDPOINT,
      placeholder: DEFAULT_ENDPOINT,
      description:
        "Public API by default. Point this at your own self-hosted " +
        "LanguageTool instance (e.g. http://10.20.11.2:8010/v2/check) to keep " +
        "queries fully inside your network.",
    },
    {
      key: "language",
      label: "Language",
      type: "text",
      default: "auto",
      placeholder: "auto",
      description:
        "Language code (e.g. en-US, de-DE) or 'auto' for automatic detection.",
    },
  ],

  configure(settings) {
    _endpoint = (settings.endpoint || DEFAULT_ENDPOINT).trim() || DEFAULT_ENDPOINT;
    _lang = (settings.language || "auto").trim() || "auto";
  },

  async init(ctx) {
    _cache = _resolveCache(ctx);
    _apiBase = ctx.apiBase;
  },

  async intercept(query, context) {
    const q = query.trim();
    if (!q || BANG.test(q) || q.split(/\s+/).length < MIN_WORDS)
      return { query };

    if (_skipOnce.has(q)) {
      _skipOnce.delete(q);
      return { query };
    }

    const cacheKey = `${_lang}:${q}`;
    const hit = _cache ? await _cache.get(cacheKey) : null;
    if (hit) {
      if (hit.query !== q)
        _corrections.set(q, {
          corrected: hit.query,
          expiresAt: Date.now() + CORRECTION_TTL_MS,
        });
      return hit;
    }

    const fetchFn = context?.fetch ?? fetch;

    try {
      const body = new URLSearchParams({
        text: q,
        language: _lang,
        enabledCategories: "TYPOS",
        enabledOnly: "true",
      });

      const res = await fetchFn(_endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Accept: "application/json",
        },
        body: body.toString(),
      });

      if (!res.ok) return { query };

      const data = await res.json();
      const matches = Array.isArray(data?.matches) ? data.matches : [];
      if (matches.length === 0) return { query };

      const corrected = _applyFixes(q, matches).trim();
      if (!corrected || corrected === q) return { query };

      const result = { query: corrected };
      if (_cache) await _cache.set(cacheKey, result);
      _corrections.set(q, {
        corrected,
        expiresAt: Date.now() + CORRECTION_TTL_MS,
      });
      return result;
    } catch (err) {
      console.warn("[spell-check-lt] LanguageTool request failed", err);
      return { query };
    }
  },
};

export const slot = {
  isClientExposed: false,
  name: "Spell Check (LanguageTool)",
  description: "Shows a correction banner when a query was spell-checked.",
  position: "at-a-glance",

  init(ctx) {
    _tpl = ctx.template;
    _apiBase = ctx.apiBase;
  },

  trigger(query) {
    const entry = _corrections.get(query);
    return !!(entry && Date.now() < entry.expiresAt);
  },

  async execute(query) {
    const entry = _corrections.get(query);
    if (!entry || Date.now() > entry.expiresAt) return { html: "" };

    const { corrected } = entry;
    const html = _tpl
      .replace(/\{\{corrected\}\}/g, _esc(corrected))
      .replace(/\{\{original\}\}/g, _esc(query))
      .replace(/\{\{search_url\}\}/g, `/search?q=${encodeURIComponent(query)}`)
      .replace(/\{\{skip_endpoint\}\}/g, `${_apiBase}/skip`);

    return { html };
  },
};

export const routes = [
  {
    method: "post",
    path: "/skip",
    async handler(req) {
      try {
        const body = await req.json();
        if (typeof body?.q === "string" && body.q) {
          _skipOnce.add(body.q);
          setTimeout(() => _skipOnce.delete(body.q), 30_000);
        }
      } catch (err) {
        console.warn("[spell-check-lt] skip route parse failed", err);
      }
      return new Response(null, { status: 204 });
    },
  },
];
