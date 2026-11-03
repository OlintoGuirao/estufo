/** Estima duração de MPEG-TS (VOD) lendo PCR no início e no fim do arquivo. */

const PACKET = 188;
const CLOCK = 90_000;

function pcrAt(buf: Uint8Array, offset: number): number | null {
  if (offset + PACKET > buf.length) return null;
  if (buf[offset] !== 0x47) return null;
  const afc = (buf[offset + 3]! >> 4) & 0x3;
  if (afc !== 2 && afc !== 3) return null;
  const afl = buf[offset + 4]!;
  if (afl < 7) return null;
  const flags = buf[offset + 5]!;
  if ((flags & 0x10) === 0) return null;
  const p = offset + 6;
  // PCR base 33-bit @ 90 kHz
  return (
    buf[p]! * 0x2000000 +
    buf[p + 1]! * 0x20000 +
    buf[p + 2]! * 0x200 +
    buf[p + 3]! * 2 +
    (buf[p + 4]! >> 7)
  );
}

function firstPcr(buf: Uint8Array): number | null {
  const limit = Math.min(buf.length - PACKET, PACKET * 4000);
  for (let i = 0; i <= limit; i++) {
    if (buf[i] !== 0x47) continue;
    if (i + PACKET <= buf.length && (i === 0 || buf[i + PACKET] === 0x47)) {
      const pcr = pcrAt(buf, i);
      if (pcr != null) return pcr;
    }
  }
  // fallback: any sync-aligned packet
  for (let i = 0; i + PACKET <= buf.length; i += PACKET) {
    const pcr = pcrAt(buf, i);
    if (pcr != null) return pcr;
  }
  return null;
}

function lastPcr(buf: Uint8Array): number | null {
  const start = Math.max(0, buf.length - PACKET * 4000);
  let sync = -1;
  for (let i = start; i + PACKET <= buf.length; i++) {
    if (buf[i] === 0x47 && buf[i + PACKET] === 0x47) {
      sync = i;
      break;
    }
  }
  if (sync < 0) {
    for (let i = buf.length - PACKET; i >= 0; i--) {
      if (buf[i] === 0x47) {
        sync = i - ((i - start) % PACKET);
        if (sync < start) sync = i;
        break;
      }
    }
  }
  if (sync < 0) return null;
  let found: number | null = null;
  for (let i = sync; i + PACKET <= buf.length; i += PACKET) {
    const pcr = pcrAt(buf, i);
    if (pcr != null) found = pcr;
  }
  return found;
}

function parseTotalSize(res: Response): number | null {
  const cr = res.headers.get("content-range");
  if (cr) {
    const m = /\/(\d+)\s*$/.exec(cr);
    if (m) return Number(m[1]);
  }
  const cl = res.headers.get("content-length");
  if (cl && res.status === 200) return Number(cl);
  return null;
}

export type TsProbeResult = {
  filesize: number | null;
  /** Duração em segundos (finite) ou null se não deu para estimar. */
  durationSec: number | null;
};

/**
 * Sniff + estima duração via Range no início/fim.
 * Também devolve filesize para o MediaDataSource do mpegts.js.
 */
export async function probeMpegTs(url: string): Promise<TsProbeResult & { isTs: boolean }> {
  const head = await fetch(url, {
    method: "GET",
    headers: { Range: "bytes=0-262143" },
    mode: "cors",
    credentials: "omit",
    cache: "no-store",
  });
  if (!head.ok && head.status !== 206) {
    throw new Error(`Não foi possível carregar o vídeo (${head.status}).`);
  }
  const startBuf = new Uint8Array(await head.arrayBuffer());
  const ascii = String.fromCharCode(...startBuf.slice(0, 64));
  const looksMp4 = ascii.includes("ftyp");
  const syncHits = [0, 188, 376].filter((i) => startBuf[i] === 0x47).length;
  const isTs = !looksMp4 && syncHits >= 2;

  let filesize = parseTotalSize(head);

  if (!isTs) {
    return { isTs: false, filesize, durationSec: null };
  }

  const first = firstPcr(startBuf);
  let durationSec: number | null = null;

  if (filesize && filesize > startBuf.length + PACKET * 8) {
    const tailStart = Math.max(0, filesize - 262144);
    const tail = await fetch(url, {
      method: "GET",
      headers: { Range: `bytes=${tailStart}-${filesize - 1}` },
      mode: "cors",
      credentials: "omit",
      cache: "no-store",
    });
    if (tail.ok || tail.status === 206) {
      if (!filesize) filesize = parseTotalSize(tail) ?? filesize;
      const endBuf = new Uint8Array(await tail.arrayBuffer());
      const last = lastPcr(endBuf);
      if (first != null && last != null) {
        let delta = last - first;
        // wrap 33-bit
        if (delta < 0) delta += 0x200000000;
        const sec = delta / CLOCK;
        if (sec >= 5 && sec < 12 * 3600) durationSec = sec;
      }
    }
  }

  return { isTs: true, filesize, durationSec };
}

/** Tenta gravar duração finita no MediaSource interno do mpegts.js. */
export function applyPlayerDuration(player: unknown, durationSec: number): boolean {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return false;
  const p = player as Record<string, any>;
  const msCandidates = [
    p?._player_engine?._mse_controller?._mediaSource,
    p?._engine?._mse_controller?._mediaSource,
    p?._engine?._msectl?._mediaSource,
    p?._msectl?._mediaSource,
    p?._mseController?._mediaSource,
  ];
  for (const ms of msCandidates) {
    if (!ms || ms.readyState === "closed") continue;
    try {
      const cur = ms.duration;
      if (!Number.isFinite(cur) || cur === Infinity || cur < durationSec - 0.5) {
        ms.duration = durationSec;
      }
      return true;
    } catch {
      /* ignore */
    }
  }
  return false;
}

export function formatClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const s = Math.floor(sec % 60);
  const m = Math.floor(sec / 60) % 60;
  const h = Math.floor(sec / 3600);
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
