/**
 * ProcessingView Component
 * Loading state while assessment is being processed
 */

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Camera, BookOpen, FileText, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

type ProcessingViewProps = {
  imageCount: number;
};

const PROCESSING_STEPS = [
  { icon: Camera, label: 'Analyzing images with AI vision model', key: 'vision' },
  { icon: BookOpen, label: 'Retrieving FDAM methodology context', key: 'rag' },
  { icon: FileText, label: 'Generating assessment report', key: 'report' },
];

const STEP_DURATION_MS = 20000; // 20 seconds per step

export function ProcessingView({ imageCount }: ProcessingViewProps) {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev < PROCESSING_STEPS.length - 1 ? prev + 1 : prev));
    }, STEP_DURATION_MS);

    return () => clearInterval(timer);
  }, []);

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
            const isActive = index === activeStep;
            const isComplete = index < activeStep;

            return (
              <div
                key={step.key}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg transition-all duration-500',
                  isActive && 'bg-primary/10 text-foreground',
                  isComplete && 'text-foreground',
                  !isActive && !isComplete && 'text-muted-foreground'
                )}
              >
                <div className={cn(
                  'p-2 rounded-full transition-colors duration-500',
                  isActive && 'bg-primary/20',
                  isComplete && 'bg-green-500/20',
                  !isActive && !isComplete && 'bg-muted'
                )}>
                  {isComplete ? (
                    <Check className="h-5 w-5 text-green-500" />
                  ) : (
                    <Icon className={cn(
                      'h-5 w-5',
                      isActive && 'text-primary'
                    )} />
                  )}
                </div>
                <span className={cn(
                  'text-sm transition-all duration-500',
                  (isActive || isComplete) && 'font-medium'
                )}>
                  {step.label}
                </span>
                {isActive && (
                  <Loader2 className="h-4 w-4 ml-auto animate-spin text-primary" />
                )}
                {isComplete && (
                  <Check className="h-4 w-4 ml-auto text-green-500" />
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
