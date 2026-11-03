import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import {
  applyPlayerDuration,
  formatClock,
  probeMpegTs,
} from "@/lib/video-lessons/ts-duration";

type Props = {
  src: string;
  className?: string;
  initialTime?: number;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onPause?: (currentTime: number, duration: number) => void;
  onEnded?: (duration: number) => void;
};

/** mpegts.js (worker) exige URL absoluta — paths relativos quebram o fetch. */
function toAbsoluteUrl(src: string): string {
  if (typeof window === "undefined") return src;
  try {
    return new URL(src, window.location.origin).toString();
  } catch {
    return src;
  }
}

function effectiveDuration(video: HTMLVideoElement, probed: number | null): number {
  const d = video.duration;
  if (Number.isFinite(d) && d > 0) return d;
  if (probed != null && probed > 0) return probed;
  if (video.buffered.length > 0) {
    try {
      return video.buffered.end(video.buffered.length - 1);
    } catch {
      /* ignore */
    }
  }
  return 0;
}

/**
 * Player para videoaulas: arquivos `.mp4` que na prática são MPEG-TS.
 * Usa mpegts.js + MSE; se for MP4 real, cai no <video> nativo.
 * MPEG-TS não traz duração no container — estimamos via PCR e exibimos o relógio.
 */
export function MpegTsLessonPlayer({
  src,
  className,
  initialTime = 0,
  onTimeUpdate,
  onPause,
  onEnded,
}: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<{ destroy: () => void; unload?: () => void } | null>(null);
  const probedDurationRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"mpegts" | "native" | "loading">("loading");
  const [clock, setClock] = useState({ current: 0, total: 0 });

  useEffect(() => {
    let cancelled = false;
    let durationTimer: number | null = null;
    const video = videoRef.current;
    if (!video || !src) return;

    const absoluteSrc = toAbsoluteUrl(src);
    setError(null);
    setMode("loading");
    setClock({ current: 0, total: 0 });
    probedDurationRef.current = null;

    const cleanupPlayer = () => {
      try {
        playerRef.current?.unload?.();
        playerRef.current?.destroy();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
    };

    const seekInitial = () => {
      const total = effectiveDuration(video, probedDurationRef.current);
      if (initialTime > 2 && total > initialTime) {
        try {
          video.currentTime = initialTime;
        } catch {
          /* ignore */
        }
      }
    };

    void (async () => {
      let isTs = true;
      let filesize: number | null = null;
      let durationSec: number | null = null;

      try {
        const probe = await probeMpegTs(absoluteSrc);
        isTs = probe.isTs;
        filesize = probe.filesize;
        durationSec = probe.durationSec;
        probedDurationRef.current = durationSec;
        if (durationSec) setClock((c) => ({ ...c, total: durationSec }));
      } catch (err) {
        console.warn("[video-sniff]", err);
        isTs = true;
      }
      if (cancelled) return;

      if (!isTs) {
        setMode("native");
        video.src = absoluteSrc;
        video.load();
        video.addEventListener("loadedmetadata", seekInitial, { once: true });
        return;
      }

      try {
        const mpegts = (await import("mpegts.js")).default;
        if (!mpegts.isSupported()) {
          setError(
            "Este navegador nao suporta reproducao MPEG-TS (MSE). Tente Chrome/Edge atualizado.",
          );
          return;
        }
        cleanupPlayer();

        const mediaDataSource: {
          type: string;
          isLive: boolean;
          cors: boolean;
          withCredentials: boolean;
          url: string;
          filesize?: number;
          duration?: number;
        } = {
          type: "mpegts",
          isLive: false,
          cors: true,
          withCredentials: false,
          url: absoluteSrc,
        };
        if (filesize && filesize > 0) mediaDataSource.filesize = filesize;
        // mpegts tipa em ms para FLV; para TS o demuxer ignora — ainda assim ajuda em alguns paths.
        if (durationSec && durationSec > 0) {
          mediaDataSource.duration = Math.round(durationSec * 1000);
        }

        const player = mpegts.createPlayer(mediaDataSource, {
          enableWorker: false,
          lazyLoad: false,
          autoCleanupSourceBuffer: true,
          autoCleanupMaxBackwardDuration: 3 * 60,
          autoCleanupMinBackwardDuration: 60,
          accurateSeek: true,
          seekType: "range",
          stashInitialSize: 1024 * 384,
          fixAudioTimestampGap: true,
        });
        playerRef.current = player;
        player.attachMediaElement(video);
        player.load();
        setMode("mpegts");
        video.addEventListener("loadedmetadata", seekInitial, { once: true });

        const pushDuration = () => {
          if (!durationSec) return;
          applyPlayerDuration(player, durationSec);
        };
        pushDuration();
        durationTimer = window.setInterval(pushDuration, 1000);

        player.on(mpegts.Events.MEDIA_INFO, () => pushDuration());
        player.on(mpegts.Events.LOADING_COMPLETE, () => pushDuration());
        player.on(mpegts.Events.ERROR, (_type: string, _detail: string, info: unknown) => {
          console.warn("[mpegts]", info);
          setError("Falha ao decodificar a aula. Confira CORS/token da Bunny ou tente de novo.");
        });
      } catch (err) {
        console.warn(err);
        setError("Não foi possível iniciar o player das videoaulas.");
      }
    })();

    return () => {
      cancelled = true;
      if (durationTimer != null) window.clearInterval(durationTimer);
      cleanupPlayer();
      video.removeAttribute("src");
      video.load();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  const reportDuration = (el: HTMLVideoElement) =>
    effectiveDuration(el, probedDurationRef.current);

  return (
    <div className={cn("relative overflow-hidden rounded-xl bg-black", className)}>
      <video
        ref={videoRef}
        className="aspect-video w-full bg-black"
        controls
        playsInline
        preload="metadata"
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          const duration = reportDuration(el);
          setClock({ current: el.currentTime, total: duration });
          if (!duration) return;
          onTimeUpdate?.(el.currentTime, duration);
        }}
        onPause={(e) => {
          const el = e.currentTarget;
          const duration = reportDuration(el);
          if (!duration) return;
          onPause?.(el.currentTime, duration);
        }}
        onEnded={(e) => {
          const el = e.currentTarget;
          onEnded?.(reportDuration(el) || el.duration || 0);
        }}
      />
      {mode === "mpegts" && clock.total > 0 && (
        <p
          className="pointer-events-none absolute bottom-14 left-3 rounded bg-black/70 px-2 py-0.5 text-xs font-medium tabular-nums text-white"
          aria-live="polite"
        >
          {formatClock(clock.current)} / {formatClock(clock.total)}
        </p>
      )}
      {mode === "loading" && (
        <p className="pointer-events-none absolute inset-x-0 bottom-12 text-center text-xs text-white/70">
          Preparando player...
        </p>
      )}
      {error && (
        <div className="absolute inset-x-0 bottom-0 bg-destructive/90 px-3 py-2 text-xs text-destructive-foreground">
          {error}
        </div>
      )}
    </div>
  );
}

