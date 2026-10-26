/**
 * Where the c-swarm factory's board server lives, and how to talk to it.
 *
 * Locally it is http://127.0.0.1:8089 with no token. When hosted (Cloud Run) the URL is the service URL and every
 * request needs a bearer token. Settings persist in localStorage. The deployment's default URL comes from
 * /c-swarm-config.js, which the web container writes at start from CSWARM_BOARD_URL, so one image serves any
 * deployment. The token has no deployment default: anything in a static file is public.
 * The token is only ever sent as an Authorization header, or as ?token= on EventSource URLs (EventSource cannot
 * set headers). It is never logged or rendered back in full.
 */

export const DEFAULT_BOARD_URL = "http://127.0.0.1:8089";
const URL_KEY = "cswarm.board.url";
const TOKEN_KEY = "cswarm.board.token";

declare global {
  interface Window {
    __CSWARM_CONFIG__?: { boardUrl?: string };
  }
}

function deployed(): string {
  return (typeof window !== "undefined" && window.__CSWARM_CONFIG__?.boardUrl) || "";
}

function stored(key: string): string {
  try {
    return (typeof window !== "undefined" && window.localStorage.getItem(key)) || "";
  } catch {
    return "";
  }
}

export function boardUrl(): string {
  const raw = stored(URL_KEY) || deployed() || process.env.VITE_CSWARM_BOARD_URL || DEFAULT_BOARD_URL;
  return raw.trim().replace(/\/+$/, "");
}

export function boardToken(): string {
  return stored(TOKEN_KEY).trim();
}

export function boardConfigured(): boolean {
  return Boolean(stored(URL_KEY) || stored(TOKEN_KEY));
}

export function saveBoardConfig(url: string, token: string | null): void {
  try {
    const u = url.trim().replace(/\/+$/, "");
    if (u && u !== DEFAULT_BOARD_URL) window.localStorage.setItem(URL_KEY, u);
    else window.localStorage.removeItem(URL_KEY);
    // null = keep the stored token (the input never shows it back); "" = clear it.
    if (token !== null) {
      if (token.trim()) window.localStorage.setItem(TOKEN_KEY, token.trim());
      else window.localStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    /* storage blocked: the default keeps working */
  }
}

export function resetBoardConfig(): void {
  try {
    window.localStorage.removeItem(URL_KEY);
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/** "abcd...wxyz" style hint so a user can recognise the saved token without it being shown. */
export function maskedToken(): string {
  const t = boardToken();
  if (!t) return "";
  return t.length <= 8 ? "••••" : `${t.slice(0, 2)}••••••${t.slice(-2)}`;
}

/** fetch() against the board with the bearer token when there is one. `path` starts with "/". */
export function boardFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = boardToken();
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(`${boardUrl()}${path}`, { ...init, headers });
}

/** URL for an EventSource (which cannot send headers): the token rides as ?token=. */
export function boardEventSourceUrl(path: string): string {
  const token = boardToken();
  if (!token) return `${boardUrl()}${path}`;
  return `${boardUrl()}${path}${path.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
}

export type BoardTest = { ok: boolean; message: string };

/** Probe /healthz then /runs.json and say what is wrong in words a user can act on. */
export async function testBoard(): Promise<BoardTest> {
  try {
    const h = await boardFetch("/healthz", { cache: "no-store" });
    if (!h.ok)
      return { ok: false, message: `The board answered ${h.status} on /healthz. Is this the factory's board URL?` };
  } catch {
    return {
      ok: false,
      message:
        "Unreachable. Check the URL, that the factory board is running, and that this page's origin is in BOARD_ALLOWED_ORIGINS.",
    };
  }
  try {
    const r = await boardFetch("/runs.json", { cache: "no-store" });
    if (r.status === 401 || r.status === 403 || r.status === 404) {
      return { ok: false, message: `The board refused the request (${r.status}). Check the token.` };
    }
    if (!r.ok) return { ok: false, message: `The board answered ${r.status} on /runs.json.` };
    const j = await r.json();
    return { ok: true, message: `OK: ${Array.isArray(j.runs) ? j.runs.length : 0} runs.` };
  } catch {
    return { ok: false, message: "Reached the board but could not read /runs.json." };
  }
}
