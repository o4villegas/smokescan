import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { SensoryObservations } from '@/types';
import { SMOKE_ODOR_INTENSITY_OPTIONS, WHITE_WIPE_RESULT_OPTIONS } from '@/types';

interface SensoryObservationsInputProps {
  value: Partial<SensoryObservations>;
  onChange: (observations: SensoryObservations) => void;
}

export function SensoryObservationsInput({ value, onChange }: SensoryObservationsInputProps) {
  const handleOdorPresentChange = (present: boolean) => {
    onChange({
      smoke_odor_present: present,
      smoke_odor_intensity: present ? value.smoke_odor_intensity : undefined,
      white_wipe_result: value.white_wipe_result,
    });
  };

  const handleIntensityChange = (intensity: SensoryObservations['smoke_odor_intensity']) => {
    onChange({
      ...value,
      smoke_odor_present: true,
      smoke_odor_intensity: intensity,
    } as SensoryObservations);
  };

  const handleWipeResultChange = (result: SensoryObservations['white_wipe_result']) => {
    onChange({
      ...value,
      smoke_odor_present: value.smoke_odor_present ?? false,
      white_wipe_result: result,
    } as SensoryObservations);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        These observations cannot be determined from photos and must be recorded in the field.
      </p>

      {/* Smoke/Fire Odor */}
      <div className="space-y-3">
        <Label>Smoke/Fire Odor Present?</Label>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => handleOdorPresentChange(true)}
            className={cn(
              'flex-1 rounded-md border px-4 py-2 text-sm font-medium transition-colors',
              value.smoke_odor_present === true
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-input bg-background hover:bg-accent hover:text-accent-foreground'
            )}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => handleOdorPresentChange(false)}
            className={cn(
              'flex-1 rounded-md border px-4 py-2 text-sm font-medium transition-colors',
              value.smoke_odor_present === false
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-input bg-background hover:bg-accent hover:text-accent-foreground'
            )}
          >
            No
          </button>
        </div>

        {/* Intensity (only shown if odor present) */}
        {value.smoke_odor_present && (
          <div className="ml-4 space-y-2">
            <Label htmlFor="odor-intensity">Odor Intensity</Label>
            <Select
              value={value.smoke_odor_intensity}
              onValueChange={(val) => handleIntensityChange(val as SensoryObservations['smoke_odor_intensity'])}
            >
              <SelectTrigger id="odor-intensity">
                <SelectValue placeholder="Select intensity" />
              </SelectTrigger>
              <SelectContent>
                {SMOKE_ODOR_INTENSITY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value!}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {/* White Wipe Test */}
      <div className="space-y-2">
        <Label htmlFor="wipe-result">White Wipe Test Result</Label>
        <Select
          value={value.white_wipe_result}
          onValueChange={(val) => handleWipeResultChange(val as SensoryObservations['white_wipe_result'])}
        >
          <SelectTrigger id="wipe-result">
            <SelectValue placeholder="Select result" />
          </SelectTrigger>
          <SelectContent>
            {WHITE_WIPE_RESULT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value!}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Wipe a white cloth/paper towel across a surface to check for soot deposits
        </p>
      </div>
    </div>
  );
}
