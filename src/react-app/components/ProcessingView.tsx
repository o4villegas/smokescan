/**
 * ProcessingView Component
 * Loading state while assessment is being processed
 */

import { Card, CardContent } from '@/components/ui/card';
import { Camera, BookOpen, FileText, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type ProcessingViewProps = {
  imageCount: number;
};

const PROCESSING_STEPS = [
  { icon: Camera, label: 'Analyzing images with AI vision model', key: 'vision' },
  { icon: BookOpen, label: 'Retrieving FDAM methodology context', key: 'rag' },
  { icon: FileText, label: 'Generating assessment report', key: 'report' },
];

export function ProcessingView({ imageCount }: ProcessingViewProps) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        {/* Spinner */}
        <div className="relative mb-8">
          <div className="h-16 w-16 rounded-full border-4 border-muted animate-pulse" />
          <Loader2 className="absolute inset-0 m-auto h-8 w-8 text-primary animate-spin" />
        </div>

        {/* Title */}
        <h2 className="text-2xl font-semibold mb-2">Analyzing Damage</h2>
        <p className="text-muted-foreground mb-8">
          Processing {imageCount} image{imageCount > 1 ? 's' : ''}...
        </p>

        {/* Steps */}
        <div className="space-y-4 w-full max-w-md text-left">
          {PROCESSING_STEPS.map((step, index) => {
            const Icon = step.icon;
            const isActive = index === 0; // First step is always active during processing

            return (
              <div
                key={step.key}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg transition-colors',
                  isActive ? 'bg-primary/10 text-foreground' : 'text-muted-foreground'
                )}
              >
                <div className={cn(
                  'p-2 rounded-full',
                  isActive ? 'bg-primary/20' : 'bg-muted'
                )}>
                  <Icon className={cn(
                    'h-5 w-5',
                    isActive && 'text-primary'
                  )} />
                </div>
                <span className={cn(
                  'text-sm',
                  isActive && 'font-medium'
                )}>
                  {step.label}
                </span>
                {isActive && (
                  <Loader2 className="h-4 w-4 ml-auto animate-spin text-primary" />
                )}
              </div>
            );
          })}
        </div>

        {/* Note */}
        <p className="text-xs text-muted-foreground mt-8">
          This may take 1-2 minutes for thorough analysis.
        </p>
      </CardContent>
    </Card>
  );
}
