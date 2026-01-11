/**
 * MetadataForm Component
 * Form for entering property and damage metadata
 */

import { useState } from 'react';
import type { AssessmentMetadata, RoomType, StructureType } from '../types';
import { ROOM_TYPE_OPTIONS, STRUCTURE_TYPE_OPTIONS } from '../types';

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
    <div className="metadata-form">
      <h2>Property Details</h2>
      <p className="subtitle">
        Provide information about the property to improve assessment accuracy.
      </p>

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="room-type">Room Type *</label>
          <select
            id="room-type"
            value={roomType}
            onChange={(e) => setRoomType(e.target.value as RoomType)}
            required
          >
            {ROOM_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="structure-type">Structure Type *</label>
          <select
            id="structure-type"
            value={structureType}
            onChange={(e) => setStructureType(e.target.value as StructureType)}
            required
          >
            {STRUCTURE_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label htmlFor="fire-origin">Fire Origin (Optional)</label>
          <input
            type="text"
            id="fire-origin"
            value={fireOrigin}
            onChange={(e) => setFireOrigin(e.target.value)}
            placeholder="e.g., Kitchen stove, electrical panel"
            maxLength={200}
          />
        </div>

        <div className="form-group">
          <label htmlFor="notes">Additional Notes (Optional)</label>
          <textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional information about the damage or property..."
            rows={4}
            maxLength={2000}
          />
        </div>

        <div className="actions">
          <button
            type="button"
            className="secondary-btn"
            onClick={onBack}
            disabled={isLoading}
          >
            Back
          </button>
          <button
            type="submit"
            className="primary-btn"
            disabled={isLoading}
          >
            {isLoading ? 'Analyzing...' : 'Start Assessment'}
          </button>
        </div>
      </form>
    </div>
  );
}
