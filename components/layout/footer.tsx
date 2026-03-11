import { VERSION, APP_NAME } from '@/lib/version';

export function Footer() {
  return (
    <footer className="border-t bg-background px-6 py-3 flex items-center justify-between text-xs text-muted-foreground">
      <span>© {new Date().getFullYear()} Axis. All rights reserved.</span>
      <span className="font-mono tabular-nums">
        {APP_NAME} <span className="text-[#2323A3] font-medium">v{VERSION}</span>
      </span>
    </footer>
  );
}
