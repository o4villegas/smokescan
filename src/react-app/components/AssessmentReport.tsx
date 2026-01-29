/**
 * AssessmentReport Component
 * Displays the FDAM assessment report
 */

import type { AssessmentReport as ReportType } from '../types';
import { MarkdownContent } from './MarkdownContent';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Plus, Clock, FileText, ListOrdered } from 'lucide-react';

type AssessmentReportProps = {
  report: ReportType;
  processingTimeMs?: number;
  onStartChat?: () => void;
  onNewAssessment?: () => void;
};

export function AssessmentReport({
  report,
  processingTimeMs,
  onStartChat,
  onNewAssessment,
}: AssessmentReportProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
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
          {(onStartChat || onNewAssessment) && (
            <div className="flex gap-2">
              {onStartChat && (
                <Button onClick={onStartChat}>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  Ask Follow-up Questions
                </Button>
              )}
              {onNewAssessment && (
                <Button variant="outline" onClick={onNewAssessment}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Assessment
                </Button>
              )}
            </div>
          )}
        </CardHeader>
      </Card>

      {/* Executive Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Executive Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MarkdownContent className="text-muted-foreground">
            {report.executiveSummary}
          </MarkdownContent>
        </CardContent>
      </Card>

      {/* Detailed Assessment */}
      {report.detailedAssessment.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Detailed Assessment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {report.detailedAssessment.map((item, index) => (
              <div key={index} className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">{item.area}</h4>
                  <Badge variant={item.severity as 'heavy' | 'moderate' | 'light' | 'trace' | 'none'}>
                    {item.severity}
                  </Badge>
                </div>
                <MarkdownContent className="text-sm text-muted-foreground">
                  {item.findings}
                </MarkdownContent>
                {item.recommendations.length > 0 && (
                  <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                    {item.recommendations.map((rec, i) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Restoration Priority Matrix */}
      {report.restorationPriority.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ListOrdered className="h-5 w-5" />
              Restoration Priority Matrix
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 pr-4 font-medium text-muted-foreground">Priority</th>
                    <th className="pb-3 pr-4 font-medium text-muted-foreground">Area</th>
                    <th className="pb-3 pr-4 font-medium text-muted-foreground">Action</th>
                    <th className="pb-3 font-medium text-muted-foreground">Rationale</th>
                  </tr>
                </thead>
                <tbody>
                  {report.restorationPriority.map((item, index) => (
                    <tr key={index} className="border-b last:border-0">
                      <td className="py-3 pr-4">
                        <Badge variant="secondary" className="font-mono">
                          #{item.priority}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">{item.area}</td>
                      <td className="py-3 pr-4">{item.action}</td>
                      <td className="py-3 text-muted-foreground">{item.rationale}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scope Indicators */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Scope Indicators</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {report.scopeIndicators.map((indicator, index) => (
              <Badge key={index} variant="outline">
                {indicator}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
