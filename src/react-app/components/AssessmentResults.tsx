/**
 * AssessmentResults Component
 * Side-by-side layout with report, image gallery, and persistent chat
 */

import type { AssessmentReport as ReportType, ChatMessage } from '../types';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ImageGallery } from './ImageGallery';
import { AssessmentReport } from './AssessmentReport';
import { ChatInterface } from './ChatInterface';
import { Clock, Plus } from 'lucide-react';

type AssessmentResultsProps = {
  report: ReportType;
  images: string[];
  processingTimeMs?: number;
  chatHistory: ChatMessage[];
  onSendMessage: (message: string) => Promise<void>;
  onNewAssessment: () => void;
  isLoading: boolean;
};

export function AssessmentResults({
  report,
  images,
  processingTimeMs,
  chatHistory,
  onSendMessage,
  onNewAssessment,
  isLoading,
}: AssessmentResultsProps) {
  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle className="text-2xl">FDAM Assessment Report</CardTitle>
            {processingTimeMs && (
              <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                Generated in {(processingTimeMs / 1000).toFixed(1)}s
              </div>
            )}
          </div>
          <Button variant="outline" onClick={onNewAssessment}>
            <Plus className="mr-2 h-4 w-4" />
            New Assessment
          </Button>
        </CardHeader>
      </Card>

      {/* Main Content: Side-by-side layout */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Report + Gallery (2 cols on lg) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Image Gallery */}
          <ImageGallery images={images} />

          {/* Report Content (headerless) */}
          <AssessmentReport report={report} showHeader={false} />
        </div>

        {/* Right: Chat Panel (1 col on lg) */}
        <div className="lg:col-span-1 lg:sticky lg:top-6 lg:self-start">
          <div className="h-[calc(100vh-200px)] min-h-[400px]">
            <ChatInterface
              messages={chatHistory}
              onSendMessage={onSendMessage}
              isLoading={isLoading}
              embedded={true}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
