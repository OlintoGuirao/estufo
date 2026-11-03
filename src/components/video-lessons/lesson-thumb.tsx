import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Props = {
  thumbPath?: string;
  order: number;
  className?: string;
};

/**
 * Preview da aula: tenta a thumb, re-tenta enquanto o servidor gera (fila),
 * e cai no número se falhar.
 */
export function LessonThumb({ thumbPath, order, className }: Props) {
  const [src, setSrc] = useState<string | null>(thumbPath ?? null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setSrc(thumbPath ?? null);
    setFailed(false);
    setAttempt(0);
  }, [thumbPath]);

  useEffect(() => {
    if (!failed || !thumbPath || attempt >= 40) return;
    const t = window.setTimeout(() => {
      setFailed(false);
      setSrc(`${thumbPath}${thumbPath.includes("?") ? "&" : "?"}r=${attempt + 1}`);
      setAttempt((a) => a + 1);
    }, 2500);
    return () => window.clearTimeout(t);
  }, [failed, thumbPath, attempt]);

  const label = String(order).padStart(2, "0");

  if (!src || (failed && attempt >= 40)) {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center text-[10px] text-white/70",
          className,
        )}
      >
        {label}
      </div>
    );
  }

  return (
    <>
      {!failed ? null : (
        <div className="absolute inset-0 flex items-center justify-center text-[10px] text-white/50">
          …
        </div>
      )}
      <img
        key={src}
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        className={cn("h-full w-full object-cover", className)}
        onLoad={() => setFailed(false)}
        onError={() => setFailed(true)}
      />
    </>
  );
}
