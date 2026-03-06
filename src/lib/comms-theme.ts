import type { CommsTheme } from '@/stores/comms';

export const BANNER_THEME_CLASSES: Record<CommsTheme, string> = {
  info: 'bg-muted text-muted-foreground',
  success: 'bg-primary/10 text-primary',
  warning: 'bg-warning/10 text-warning',
  urgent: 'bg-destructive/10 text-destructive',
  promotional: 'bg-accent text-accent-foreground',
};

export const CALLOUT_THEME_CLASSES: Record<CommsTheme, string> = {
  info: 'bg-muted text-muted-foreground border-muted',
  success: 'bg-primary/10 text-primary border-primary/30',
  warning: 'bg-warning/10 text-warning border-warning/30',
  urgent: 'bg-destructive/10 text-destructive border-destructive/30',
  promotional: 'bg-accent text-accent-foreground border-accent/30',
};

export const MODAL_THEME_CLASSES: Record<CommsTheme, string> = {
  info: 'bg-card text-card-foreground border-muted',
  success: 'bg-card text-card-foreground border-primary/30',
  warning: 'bg-card text-card-foreground border-warning/30',
  urgent: 'bg-card text-card-foreground border-destructive/30',
  promotional: 'bg-card text-card-foreground border-accent/30',
};

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export function colorStyle(custom: Record<string, string>): Record<string, string> | undefined {
  if (!custom.bg && !custom.text) return undefined;
  const style: Record<string, string> = {};
  if (custom.bg && HEX_RE.test(custom.bg)) style.backgroundColor = custom.bg;
  if (custom.text && HEX_RE.test(custom.text)) style.color = custom.text;
  return Object.keys(style).length > 0 ? style : undefined;
}
