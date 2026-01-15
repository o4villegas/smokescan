import { useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { RoomDimensions } from '@/types';

interface DimensionsInputProps {
  value: Partial<RoomDimensions>;
  onChange: (dimensions: RoomDimensions) => void;
}

export function DimensionsInput({ value, onChange }: DimensionsInputProps) {
  const length = value.length_ft ?? 0;
  const width = value.width_ft ?? 0;
  const height = value.height_ft ?? 0;

  // Auto-calculate area and volume
  useEffect(() => {
    const area_sf = length * width;
    const volume_cf = area_sf * height;

    // Only update if calculated values changed
    if (area_sf !== value.area_sf || volume_cf !== value.volume_cf) {
      onChange({
        length_ft: length,
        width_ft: width,
        height_ft: height,
        area_sf,
        volume_cf,
      });
    }
  }, [length, width, height, value.area_sf, value.volume_cf, onChange]);

  const handleChange = (field: keyof RoomDimensions, val: string) => {
    const numVal = parseFloat(val) || 0;
    const newDimensions = {
      length_ft: field === 'length_ft' ? numVal : length,
      width_ft: field === 'width_ft' ? numVal : width,
      height_ft: field === 'height_ft' ? numVal : height,
      area_sf: 0,
      volume_cf: 0,
    };
    newDimensions.area_sf = newDimensions.length_ft * newDimensions.width_ft;
    newDimensions.volume_cf = newDimensions.area_sf * newDimensions.height_ft;
    onChange(newDimensions);
  };

  // Calculate air scrubber recommendation (4 ACH minimum per FDAM)
  const airScrubbers = value.volume_cf ? Math.ceil((value.volume_cf * 4) / 500 / 60) : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-2">
          <Label htmlFor="length">Length (ft)</Label>
          <Input
            id="length"
            type="number"
            min="0"
            step="0.5"
            value={length || ''}
            onChange={(e) => handleChange('length_ft', e.target.value)}
            placeholder="20"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="width">Width (ft)</Label>
          <Input
            id="width"
            type="number"
            min="0"
            step="0.5"
            value={width || ''}
            onChange={(e) => handleChange('width_ft', e.target.value)}
            placeholder="15"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="height">Height (ft)</Label>
          <Input
            id="height"
            type="number"
            min="0"
            step="0.5"
            value={height || ''}
            onChange={(e) => handleChange('height_ft', e.target.value)}
            placeholder="10"
          />
        </div>
      </div>

      {/* Auto-calculated values */}
      {(value.area_sf ?? 0) > 0 && (
        <div className="rounded-lg border bg-muted/50 p-3">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Area:</span>
              <span className="ml-2 font-medium">{value.area_sf?.toLocaleString()} SF</span>
            </div>
            <div>
              <span className="text-muted-foreground">Volume:</span>
              <span className="ml-2 font-medium">{value.volume_cf?.toLocaleString()} CF</span>
            </div>
            <div>
              <span className="text-muted-foreground">Air Scrubbers:</span>
              <span className="ml-2 font-medium">{airScrubbers} units</span>
              <span className="text-xs text-muted-foreground ml-1">(4 ACH)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
