/**
 * ProcessingView Component
 * Loading state while assessment is being processed.
 * Supports status-driven step progression for cold start visibility.
 */

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Zap, Camera, BookOpen, FileText, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

type ProcessingViewProps = {
  imageCount: number;
  status?: 'pending' | 'in_progress';
};

const PROCESSING_STEPS = [
  { icon: Zap, label: 'Connecting to AI analysis engine', key: 'init' },
  { icon: Camera, label: 'Analyzing images with AI vision model', key: 'vision' },
  { icon: BookOpen, label: 'Retrieving FDAM methodology context', key: 'rag' },
  { icon: FileText, label: 'Generating assessment report', key: 'report' },
];

// Timer-based fallback duration for steps after status-driven ones
const STEP_DURATION_MS = 20000;

export function ProcessingView({ imageCount, status }: ProcessingViewProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const statusDrivenRef = useRef(false);

  // Elapsed time counter
  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Status-driven step progression
  useEffect(() => {
    if (status === 'in_progress') {
      statusDrivenRef.current = true;
      // Jump to at least step 1 (vision) when worker starts processing
      setActiveStep((prev) => Math.max(prev, 1));
    }
  }, [status]);

  // Timer-based fallback for steps after the status-driven ones
  useEffect(() => {
    // Only start timer-based progression once we're past the init step
    if (activeStep < 1) return;

    const timer = setInterval(() => {
      setActiveStep((prev) => (prev < PROCESSING_STEPS.length - 1 ? prev + 1 : prev));
    }, STEP_DURATION_MS);

    return () => clearInterval(timer);
  }, [activeStep >= 1]); // eslint-disable-line react-hooks/exhaustive-deps

  const minutes = Math.floor(elapsedSeconds / 60);
  const seconds = elapsedSeconds % 60;
  const elapsed = `${minutes}:${String(seconds).padStart(2, '0')}`;

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

        {/* Cold start message */}
        {elapsedSeconds > 90 && status === 'pending' && (
          <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg text-sm text-blue-800 dark:text-blue-200 max-w-md">
            <p>First analyses may take 2-3 minutes as the AI model initializes. Subsequent analyses will be much faster.</p>
          </div>
        )}

        {/* Elapsed time and note */}
        <p className="text-xs text-muted-foreground mt-8">
          Elapsed: {elapsed}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          First analysis: 2-3 min. Subsequent: under 30 seconds.
        </p>
      </CardContent>
    </Card>
  );
}
