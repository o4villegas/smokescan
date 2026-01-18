import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface HeaderProps {
  onMenuClick: () => void;
  className?: string;
}

export function Header({ onMenuClick, className }: HeaderProps) {
  return (
    <header
      className={cn(
        'sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 sm:px-6 md:hidden',
        className
      )}
    >
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onMenuClick}
        aria-label="Toggle menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      {/* Branding - mobile only */}
      <div className="flex items-center gap-2">
        <img
          src="/smokescan-logo.png"
          alt="SmokeScan"
          className="h-8 w-8 rounded-lg object-contain"
        />
        <div>
          <h1 className="text-lg font-semibold">SmokeScan</h1>
          <p className="text-xs text-muted-foreground">FDAM Assessment</p>
        </div>
      </div>

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">
          v1.0
        </span>
      </div>
    </header>
  );
}
