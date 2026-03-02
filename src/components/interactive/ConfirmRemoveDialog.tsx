import { useEffect, useRef } from 'preact/hooks';
import { t } from '@/i18n';

interface Props {
  lang: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmRemoveDialog({ lang, onConfirm, onCancel }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus trap and escape handler
  useEffect(() => {
    cancelRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key === 'Tab') {
        const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return (
    <div
      class="fixed inset-0 z-50 flex items-center justify-center bg-foreground/20 backdrop-blur-sm"
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-label={t('remove', lang)}
        class="mx-4 w-full max-w-xs rounded-lg bg-card p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <p class="text-sm font-medium text-card-foreground">
          {t('remove', lang)}?
        </p>
        <div class="mt-3 flex gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            class="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            {t('close', lang)}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            class="flex-1 rounded-md bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90"
          >
            {t('remove', lang)}
          </button>
        </div>
      </div>
    </div>
  );
}
