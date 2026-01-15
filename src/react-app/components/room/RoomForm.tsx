import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { DimensionsInput } from './DimensionsInput';
import { SensoryObservationsInput } from './SensoryObservations';
import type { RoomType, FloorLevel, RoomDimensions, SensoryObservations } from '@/types';
import { ROOM_TYPE_OPTIONS, FLOOR_LEVEL_OPTIONS } from '@/types';

export interface RoomFormData {
  room_name?: string;
  room_type: RoomType;
  floor_level?: FloorLevel;
  dimensions?: RoomDimensions;
  sensory_observations?: SensoryObservations;
}

interface RoomFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: RoomFormData) => void;
  isLoading?: boolean;
  initialData?: Partial<RoomFormData>;
  mode?: 'create' | 'edit';
}

export function RoomForm({
  open,
  onOpenChange,
  onSubmit,
  isLoading = false,
  initialData,
  mode = 'create',
}: RoomFormProps) {
  const [roomName, setRoomName] = useState(initialData?.room_name ?? '');
  const [roomType, setRoomType] = useState<RoomType | ''>(initialData?.room_type ?? '');
  const [floorLevel, setFloorLevel] = useState<FloorLevel | ''>(initialData?.floor_level ?? '');
  const [dimensions, setDimensions] = useState<Partial<RoomDimensions>>(initialData?.dimensions ?? {});
  const [sensoryObs, setSensoryObs] = useState<Partial<SensoryObservations>>(
    initialData?.sensory_observations ?? {}
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!roomType) return;

    const data: RoomFormData = {
      room_name: roomName || undefined,
      room_type: roomType,
      floor_level: floorLevel || undefined,
      dimensions: dimensions.area_sf ? (dimensions as RoomDimensions) : undefined,
      sensory_observations: sensoryObs.smoke_odor_present !== undefined
        ? (sensoryObs as SensoryObservations)
        : undefined,
    };

    onSubmit(data);
  };

  const isValid = roomType !== '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {mode === 'create' ? 'Add New Room' : 'Edit Room'}
            </DialogTitle>
            <DialogDescription>
              Enter room information. Visual observations (soot, char, zone) will be
              determined by AI analysis of photos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="room-name">Room Name (Optional)</Label>
                <Input
                  id="room-name"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  placeholder="e.g., Master Bedroom, Kitchen #1"
                />
              </div>

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
                <Label htmlFor="floor-level">Floor Level</Label>
                <Select value={floorLevel} onValueChange={(val) => setFloorLevel(val as FloorLevel)}>
                  <SelectTrigger id="floor-level">
                    <SelectValue placeholder="Select floor level" />
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
            </div>

            {/* Dimensions */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">Room Dimensions</Label>
              <DimensionsInput value={dimensions} onChange={setDimensions} />
            </div>

            {/* Sensory Observations */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">Sensory Observations</Label>
              <SensoryObservationsInput value={sensoryObs} onChange={setSensoryObs} />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || isLoading}>
              {isLoading ? 'Saving...' : mode === 'create' ? 'Create Room' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
