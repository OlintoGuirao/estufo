import { SafeHtml } from "@/components/safe-html";
import { formatProfessorHtml } from "@/lib/approval-trail/professor-text";
import { cn } from "@/lib/utils";

/** Fala do professor: limpa markdown e renderiza parágrafos com ênfase. */
export function ProfessorText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const html = formatProfessorHtml(text);
  if (!html) return null;
  return (
    <SafeHtml
      html={html}
      className={cn(
        "text-sm leading-relaxed [&_p]:mb-3 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
        className,
      )}
    />
  );
}
