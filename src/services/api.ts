import { mockRequest } from "./mock/handlers";

const TOKEN_KEY = "estufoo.token";

export const API_URL = (import.meta.env['VITE_API_URL'] as string | undefined)?.replace(/\/$/, "");
/** Usa mock quando VITE_API_URL não está definida ou VITE_USE_MOCK=true. */
export const USE_MOCK = !API_URL || import.meta.env['VITE_USE_MOCK'] === "true";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

export type TokenPersistOptions = {
  /** true = localStorage (sobrevive ao fechar o browser); false = sessionStorage. */
  remember?: boolean;
};

export const tokenStore = {
  get: () => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(TOKEN_KEY) ?? window.sessionStorage.getItem(TOKEN_KEY);
  },
  set: (t: string, opts?: TokenPersistOptions) => {
    const remember = opts?.remember !== false;
    if (remember) {
      window.sessionStorage.removeItem(TOKEN_KEY);
      window.localStorage.setItem(TOKEN_KEY, t);
    } else {
      window.localStorage.removeItem(TOKEN_KEY);
      window.sessionStorage.setItem(TOKEN_KEY, t);
    }
  },
  clear: () => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(TOKEN_KEY);
    window.sessionStorage.removeItem(TOKEN_KEY);
  },
};

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export async function request<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const token = tokenStore.get();
  if (USE_MOCK) {
    try {
      return (await mockRequest(method, path, body, token)) as T;
    } catch (e) {
      handleUnauthorized(e);
      throw e;
    }
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : null,
    });
  } catch {
    throw new ApiError("Não foi possível conectar ao servidor. Verifique sua conexão.", 0);
  }
  if (!res.ok) {
    let message = "Ocorreu um erro inesperado.";
    try {
      const data = await res.json();
      message = data.message ?? message;
    } catch {
      /* corpo vazio */
    }
    const err = new ApiError(message, res.status);
    handleUnauthorized(err);
    throw err;
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function handleUnauthorized(e: unknown) {
  if (e instanceof ApiError && e.status === 401 && tokenStore.get()) {
    tokenStore.clear();
    window.location.href = "/login?expirado=1";
  }
}

export async function upload<T>(path: string, file: File, onProgress: (pct: number) => void): Promise<T> {
  if (USE_MOCK) {
    for (let p = 10; p <= 100; p += 15) {
      await new Promise((r) => setTimeout(r, 180));
      onProgress(Math.min(p, 100));
    }
    return (await mockRequest("POST", path, { fileName: file.name }, tokenStore.get())) as T;
  }
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}${path}`);
    const token = tokenStore.get();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
    xhr.onload = () =>
      xhr.status < 300 ? resolve(JSON.parse(xhr.responseText || "{}")) : reject(new ApiError("Falha no envio do arquivo.", xhr.status));
    xhr.onerror = () => reject(new ApiError("Falha de rede durante o envio.", 0));
    const fd = new FormData();
    fd.append("file", file);
    xhr.send(fd);
  });
}

export const qs = (params: Record<string, unknown>) => {
  const s = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "" && v !== null && v !== "todos") s.set(k, String(v));
  });
  const str = s.toString();
  return str ? `?${str}` : "";
};
