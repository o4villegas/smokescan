/**
 * MetadataForm Component
 * Form for entering property and damage metadata
 */

import { useState } from 'react';
import type { AssessmentMetadata, RoomType, StructureType } from '../types';
import { ROOM_TYPE_OPTIONS, STRUCTURE_TYPE_OPTIONS } from '../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Play } from 'lucide-react';

type MetadataFormProps = {
  onSubmit: (metadata: AssessmentMetadata) => void;
  onBack: () => void;
  isLoading: boolean;
};

export function MetadataForm({ onSubmit, onBack, isLoading }: MetadataFormProps) {
  const [roomType, setRoomType] = useState<RoomType>('residential-living');
  const [structureType, setStructureType] = useState<StructureType>('single-family');
  const [fireOrigin, setFireOrigin] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      roomType,
      structureType,
      fireOrigin: fireOrigin.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Property Details</CardTitle>
        <p className="text-sm text-muted-foreground">
          Provide information about the property to improve assessment accuracy.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="room-type">Room Type *</Label>
              <Select value={roomType} onValueChange={(val) => setRoomType(val as RoomType)}>
                <SelectTrigger id="room-type">
                  <SelectValue placeholder="Select room type" />
                </SelectTrigger>
                <SelectContent>
                  {ROOM_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="structure-type">Structure Type *</Label>
              <Select value={structureType} onValueChange={(val) => setStructureType(val as StructureType)}>
                <SelectTrigger id="structure-type">
                  <SelectValue placeholder="Select structure type" />
                </SelectTrigger>
                <SelectContent>
                  {STRUCTURE_TYPE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fire-origin">Fire Origin (Optional)</Label>
            <Input
              id="fire-origin"
              value={fireOrigin}
              onChange={(e) => setFireOrigin(e.target.value)}
              placeholder="e.g., Kitchen stove, electrical panel"
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional information about the damage or property..."
              rows={4}
              maxLength={2000}
            />
          </div>

          <div className="flex justify-between pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onBack}
              disabled={isLoading}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                'Analyzing...'
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Start Assessment
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
