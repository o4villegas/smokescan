import { useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { cn } from '@/lib/utils';

interface AppLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function AppLayout({ children, className }: AppLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="relative min-h-screen bg-background">
      <Sidebar open={sidebarOpen} onOpenChange={setSidebarOpen} />

      <div className="flex flex-col md:ml-64">
        <Header onMenuClick={() => setSidebarOpen(true)} />

        <main className={cn('flex-1 p-4 sm:p-6', className)}>
          {children}
        </main>
      </div>
    </div>
  );
}
