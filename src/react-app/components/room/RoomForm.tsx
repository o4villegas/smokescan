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
import type { RoomType } from '@/types';
import { ROOM_TYPE_OPTIONS } from '@/types';

export interface RoomFormData {
  room_name?: string;
  room_type: RoomType;
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!roomType) return;

    const data: RoomFormData = {
      room_name: roomName || undefined,
      room_type: roomType,
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
              Enter basic room information. Detailed FDAM metadata (dimensions, sensory
              observations) will be collected in the assessment wizard after uploading photos.
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
