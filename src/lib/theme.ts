/**
 * Tema claro/escuro.
 *
 * "system" (padrão) segue o tema do celular/PC; "light"/"dark" fixam.
 * A escolha fica em "estufoo.theme.<conta>" (chave por conta, para não
 * misturar preferência quando outra pessoa entra no aparelho).
 * Aplica a classe `.dark` no <html>.
 */
export type ThemePref = "system" | "light" | "dark";

const OWNER_KEY = "estufoo.local-owner";
const EVENT = "estufoo:theme";

function key(): string {
  let owner = "anon";
  if (typeof window !== "undefined") {
    try {
      owner = localStorage.getItem(OWNER_KEY) || "anon";
    } catch {
      /* ignore */
    }
  }
  return `estufoo.theme.${owner}`;
}

export function getThemePref(): ThemePref {
  if (typeof window === "undefined") return "system";
  try {
    const v = localStorage.getItem(key());
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function systemDark(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

export function resolveTheme(pref: ThemePref = getThemePref()): "light" | "dark" {
  return pref === "system" ? (systemDark() ? "dark" : "light") : pref;
}

export function applyTheme(pref: ThemePref = getThemePref()): void {
  if (typeof document === "undefined") return;
  const dark = resolveTheme(pref) === "dark";
  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? "#151a2b" : "#1e3a5f");
}

export function setThemePref(pref: ThemePref): void {
  if (typeof window === "undefined") return;
  try {
    if (pref === "system") localStorage.removeItem(key());
    else localStorage.setItem(key(), pref);
  } catch {
    /* sem storage: só aplica nesta sessão */
  }
  applyTheme(pref);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: pref }));
}

/** Liga os ouvintes: tema do aparelho mudou / outra aba / troca de conta. */
export function installThemeWatcher(): () => void {
  if (typeof window === "undefined") return () => {};
  applyTheme();
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystem = () => {
    if (getThemePref() === "system") applyTheme("system");
  };
  const onStorage = () => applyTheme();
  mq.addEventListener?.("change", onSystem);
  window.addEventListener("storage", onStorage);
  return () => {
    mq.removeEventListener?.("change", onSystem);
    window.removeEventListener("storage", onStorage);
  };
}

export function onThemeChange(cb: (pref: ThemePref) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const h = (e: Event) => cb((e as CustomEvent<ThemePref>).detail);
  window.addEventListener(EVENT, h);
  return () => window.removeEventListener(EVENT, h);
}

/**
 * Script inline do <head>: aplica o tema ANTES de pintar (sem "piscar" branco).
 * Lê a chave da conta atual (estufoo.theme.<conta>).
 */
export const THEME_BOOT_SCRIPT = `(function(){try{var o=localStorage.getItem("estufoo.local-owner")||"anon";var p=localStorage.getItem("estufoo.theme."+o);var d=p==="dark"||(p!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;if(d)r.classList.add("dark");r.style.colorScheme=d?"dark":"light";}catch(e){}})();`;
