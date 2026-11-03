import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { videoLessonNotesStore } from "@/services/video-lesson-notes-store";
import type { VideoLessonNote } from "@/types/video-lessons";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lessonId: string;
  subjectId: string;
  subjectName: string;
  lessonTitle: string;
  suggestedTitle: string;
  onSaved?: (note: VideoLessonNote) => void;
};

export function VideoLessonNotesDialog({
  open,
  onOpenChange,
  lessonId,
  subjectId,
  subjectName,
  lessonTitle,
  suggestedTitle,
  onSaved,
}: Props) {
  const existing = videoLessonNotesStore.listByLesson(lessonId)[0];
  const [title, setTitle] = useState(existing?.title ?? suggestedTitle);
  const [body, setBody] = useState(existing?.body ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const cur = videoLessonNotesStore.listByLesson(lessonId)[0];
    setTitle(cur?.title ?? suggestedTitle);
    setBody(cur?.body ?? "");
    setError(null);
  }, [open, lessonId, suggestedTitle]);

  const save = () => {
    try {
      const note = videoLessonNotesStore.save({
        id: existing?.id,
        lessonId,
        subjectId,
        subjectName,
        lessonTitle,
        title,
        body,
      });
      onSaved?.(note);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível salvar.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Anotações da aula</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{lessonTitle}</p>
          <div className="space-y-1.5">
            <Label htmlFor="note-title">
              Título <span className="text-destructive">*</span>
            </Label>
            <Input
              id="note-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Português aula 1"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="note-body">Conteúdo</Label>
            <Textarea
              id="note-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={8}
              placeholder="Escreva suas anotações desta aula..."
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={save}>
            Salvar anotação
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
