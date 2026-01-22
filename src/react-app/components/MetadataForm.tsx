/**
 * MetadataForm Component
 * Form for entering property and damage metadata including FDAM field data
 *
 * Field Order (confirmed):
 * 1. Room Type
 * 2. Structure Type
 * 3. Floor Level
 * 4. Dimensions (MANDATORY)
 * 5. Sensory Observations
 * 6. Fire Origin
 * 7. Notes
 */

import { useState, useMemo } from 'react';
import type {
  AssessmentMetadata,
  RoomType,
  StructureType,
  FloorLevel,
  SmokeOdorIntensity,
  SensoryObservations,
} from '../types';
import {
  ROOM_TYPE_OPTIONS,
  STRUCTURE_TYPE_OPTIONS,
  FLOOR_LEVEL_OPTIONS,
  SMOKE_ODOR_INTENSITY_OPTIONS,
  WHITE_WIPE_RESULT_OPTIONS,
} from '../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Play, Ruler } from 'lucide-react';

type MetadataFormProps = {
  onSubmit: (metadata: AssessmentMetadata) => void;
  onBack: () => void;
  isLoading: boolean;
  initialRoomType?: RoomType;
  initialData?: AssessmentMetadata | null;
};

export function MetadataForm({ onSubmit, onBack, isLoading, initialRoomType, initialData }: MetadataFormProps) {
  // Basic metadata - prefer initialData over initialRoomType
  const [roomType, setRoomType] = useState<RoomType>(
    initialData?.roomType ?? initialRoomType ?? 'residential-living'
  );
  const [structureType, setStructureType] = useState<StructureType>(
    initialData?.structureType ?? 'single-family'
  );

  // Floor level (optional)
  const [floorLevel, setFloorLevel] = useState<FloorLevel | ''>(
    initialData?.floor_level ?? ''
  );

  // Dimensions (MANDATORY)
  const [lengthFt, setLengthFt] = useState<string>(
    initialData?.dimensions?.length_ft?.toString() ?? ''
  );
  const [widthFt, setWidthFt] = useState<string>(
    initialData?.dimensions?.width_ft?.toString() ?? ''
  );
  const [heightFt, setHeightFt] = useState<string>(
    initialData?.dimensions?.height_ft?.toString() ?? ''
  );

  // Sensory observations (optional)
  const [smokeOdorPresent, setSmokeOdorPresent] = useState(
    initialData?.sensory_observations?.smoke_odor_present ?? false
  );
  const [smokeOdorIntensity, setSmokeOdorIntensity] = useState<SmokeOdorIntensity | ''>(
    initialData?.sensory_observations?.smoke_odor_intensity ?? ''
  );
  const [whiteWipeResult, setWhiteWipeResult] = useState<string>(
    initialData?.sensory_observations?.white_wipe_result ?? ''
  );
  const [whiteWipeFreeText, setWhiteWipeFreeText] = useState('');
  const [useWhiteWipeFreeText, setUseWhiteWipeFreeText] = useState(false);

  // Additional info
  const [fireOrigin, setFireOrigin] = useState(initialData?.fireOrigin ?? '');
  const [notes, setNotes] = useState(initialData?.notes ?? '');

  // Auto-calculate area and volume
  const calculatedValues = useMemo(() => {
    const length = parseFloat(lengthFt) || 0;
    const width = parseFloat(widthFt) || 0;
    const height = parseFloat(heightFt) || 0;

    if (length > 0 && width > 0 && height > 0) {
      const area = length * width;
      const volume = area * height;
      return { area, volume };
    }
    return null;
  }, [lengthFt, widthFt, heightFt]);

  // Validation: all dimensions required
  const dimensionsValid = useMemo(() => {
    const length = parseFloat(lengthFt);
    const width = parseFloat(widthFt);
    const height = parseFloat(heightFt);
    return length > 0 && width > 0 && height > 0;
  }, [lengthFt, widthFt, heightFt]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!dimensionsValid) {
      return; // Form validation should prevent this
    }

    // Build sensory observations if any provided
    let sensoryObs: SensoryObservations | undefined;
    const wipeResult = useWhiteWipeFreeText ? whiteWipeFreeText.trim() : whiteWipeResult;

    if (smokeOdorPresent || wipeResult) {
      sensoryObs = {};
      if (smokeOdorPresent) {
        sensoryObs.smoke_odor_present = true;
        if (smokeOdorIntensity) {
          sensoryObs.smoke_odor_intensity = smokeOdorIntensity;
        }
      }
      if (wipeResult) {
        sensoryObs.white_wipe_result = wipeResult;
      }
    }

    onSubmit({
      roomType,
      structureType,
      floor_level: floorLevel || undefined,
      dimensions: {
        length_ft: parseFloat(lengthFt),
        width_ft: parseFloat(widthFt),
        height_ft: parseFloat(heightFt),
      },
      sensory_observations: sensoryObs,
      fireOrigin: fireOrigin.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Property Details</CardTitle>
        <p className="text-sm text-muted-foreground">
          Provide information about the property for FDAM assessment.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Row 1: Room Type & Structure Type */}
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

          {/* Row 2: Floor Level */}
          <div className="space-y-2">
            <Label htmlFor="floor-level">Floor Level</Label>
            <Select value={floorLevel} onValueChange={(val) => setFloorLevel(val as FloorLevel)}>
              <SelectTrigger id="floor-level">
                <SelectValue placeholder="Select floor level (optional)" />
              </SelectTrigger>
              <SelectContent>
                {FLOOR_LEVEL_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Row 3: Dimensions (MANDATORY) */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Ruler className="h-4 w-4 text-muted-foreground" />
              <Label className="text-base font-medium">Room Dimensions *</Label>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="length-ft" className="text-sm">Length (ft)</Label>
                <Input
                  id="length-ft"
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={lengthFt}
                  onChange={(e) => setLengthFt(e.target.value)}
                  placeholder="e.g., 20"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="width-ft" className="text-sm">Width (ft)</Label>
                <Input
                  id="width-ft"
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={widthFt}
                  onChange={(e) => setWidthFt(e.target.value)}
                  placeholder="e.g., 15"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="height-ft" className="text-sm">Height (ft)</Label>
                <Input
                  id="height-ft"
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={heightFt}
                  onChange={(e) => setHeightFt(e.target.value)}
                  placeholder="e.g., 10"
                  required
                />
              </div>
            </div>

            {/* Calculated Area & Volume (read-only) */}
            {calculatedValues && (
              <div className="grid gap-4 sm:grid-cols-2 pt-2">
                <div className="rounded-md bg-muted px-3 py-2">
                  <span className="text-sm text-muted-foreground">Area: </span>
                  <span className="font-medium">{calculatedValues.area.toLocaleString()} SF</span>
                </div>
                <div className="rounded-md bg-muted px-3 py-2">
                  <span className="text-sm text-muted-foreground">Volume: </span>
                  <span className="font-medium">{calculatedValues.volume.toLocaleString()} CF</span>
                </div>
              </div>
            )}
          </div>

          {/* Row 4: Sensory Observations */}
          <div className="space-y-4">
            <Label className="text-base font-medium">Sensory Observations</Label>

            {/* Smoke Odor */}
            <div className="space-y-3 pl-1">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="smoke-odor-present"
                  checked={smokeOdorPresent}
                  onCheckedChange={(checked) => {
                    setSmokeOdorPresent(checked === true);
                    if (!checked) {
                      setSmokeOdorIntensity('');
                    }
                  }}
                />
                <Label htmlFor="smoke-odor-present" className="text-sm font-normal">
                  Smoke odor detected
                </Label>
              </div>

              {/* Intensity dropdown - only shown when odor present */}
              {smokeOdorPresent && (
                <div className="ml-6 space-y-2">
                  <Label htmlFor="smoke-intensity" className="text-sm">Odor Intensity</Label>
                  <Select value={smokeOdorIntensity} onValueChange={(val) => setSmokeOdorIntensity(val as SmokeOdorIntensity)}>
                    <SelectTrigger id="smoke-intensity" className="w-[200px]">
                      <SelectValue placeholder="Select intensity" />
                    </SelectTrigger>
                    <SelectContent>
                      {SMOKE_ODOR_INTENSITY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* White Wipe Test */}
            <div className="space-y-3 pl-1">
              <Label htmlFor="white-wipe" className="text-sm">White Wipe Test Result</Label>

              {!useWhiteWipeFreeText ? (
                <div className="flex items-center gap-2">
                  <Select value={whiteWipeResult} onValueChange={setWhiteWipeResult}>
                    <SelectTrigger id="white-wipe" className="w-[200px]">
                      <SelectValue placeholder="Select result (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {WHITE_WIPE_RESULT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setUseWhiteWipeFreeText(true);
                      setWhiteWipeResult('');
                    }}
                  >
                    Other...
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input
                    value={whiteWipeFreeText}
                    onChange={(e) => setWhiteWipeFreeText(e.target.value)}
                    placeholder="Describe white wipe result"
                    maxLength={100}
                    className="w-[300px]"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setUseWhiteWipeFreeText(false);
                      setWhiteWipeFreeText('');
                    }}
                  >
                    Use dropdown
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Row 5: Fire Origin */}
          <div className="space-y-2">
            <Label htmlFor="fire-origin">Fire Origin</Label>
            <Input
              id="fire-origin"
              value={fireOrigin}
              onChange={(e) => setFireOrigin(e.target.value)}
              placeholder="e.g., Kitchen stove, electrical panel"
              maxLength={200}
            />
          </div>

          {/* Row 6: Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Additional Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional information about the damage or property..."
              rows={3}
              maxLength={2000}
            />
          </div>

          {/* Actions */}
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
            <Button type="submit" disabled={isLoading || !dimensionsValid}>
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
