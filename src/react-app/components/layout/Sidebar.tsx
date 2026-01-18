import { Link, useLocation } from 'react-router-dom';
import { FolderOpen, Home, Settings, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Sheet, SheetContent } from '@/components/ui/sheet';

interface SidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface NavItemProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

function NavItem({ to, icon, label, active, onClick }: NavItemProps) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
        active
          ? 'bg-primary/10 text-primary'
          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
      )}
    >
      {icon}
      <span>{label}</span>
      {active && <ChevronRight className="ml-auto h-4 w-4" />}
    </Link>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();

  return (
    <div className="flex h-full flex-col">
      {/* Logo section for mobile */}
      <div className="flex h-52 items-center justify-center border-b px-2 md:hidden">
        <img
          src="/smokescan-logo.png"
          alt="SmokeScan"
          className="h-48 w-full object-contain"
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        <NavItem
          to="/"
          icon={<Home className="h-4 w-4" />}
          label="Projects"
          active={location.pathname === '/'}
          onClick={onNavigate}
        />
        <NavItem
          to="/"
          icon={<FolderOpen className="h-4 w-4" />}
          label="Recent Assessments"
          active={false}
          onClick={onNavigate}
        />
      </nav>

      {/* Footer */}
      <div className="border-t p-4">
        <NavItem
          to="/"
          icon={<Settings className="h-4 w-4" />}
          label="Settings"
          active={false}
          onClick={onNavigate}
        />
        <p className="mt-4 text-xs text-muted-foreground text-center">
          FDAM v4.0.1 Methodology
        </p>
      </div>
    </div>
  );
}

export function Sidebar({ open, onOpenChange }: SidebarProps) {
  return (
    <>
      {/* Desktop sidebar - fixed position */}
      <aside className="hidden md:flex md:fixed md:inset-y-0 md:left-0 md:z-30 md:w-64 md:flex-col md:border-r bg-card">
        <div className="flex h-52 items-center justify-center border-b px-2">
          <img
            src="/smokescan-logo.png"
            alt="SmokeScan"
            className="h-48 w-full object-contain"
          />
        </div>
        <SidebarContent />
      </aside>

      {/* Mobile sidebar - sheet/drawer */}
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="left" className="w-64 p-0">
          <SidebarContent onNavigate={() => onOpenChange(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}
