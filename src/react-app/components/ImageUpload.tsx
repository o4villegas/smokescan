/**
 * ImageUpload Component
 * Drag-and-drop or click-to-upload interface for damage photos
 */

import { useCallback, useState } from 'react';

type ImageUploadProps = {
  images: File[];
  previewUrls: string[];
  onImagesChange: (images: File[], previewUrls: string[]) => void;
  onNext: () => void;
  maxImages?: number;
};

export function ImageUpload({
  images,
  previewUrls,
  onImagesChange,
  onNext,
  maxImages = 10,
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files) return;

      const validFiles: File[] = [];
      const validUrls: string[] = [];

      Array.from(files).forEach((file) => {
        if (!file.type.startsWith('image/')) return;
        if (images.length + validFiles.length >= maxImages) return;

        validFiles.push(file);
        validUrls.push(URL.createObjectURL(file));
      });

      onImagesChange(
        [...images, ...validFiles],
        [...previewUrls, ...validUrls]
      );
    },
    [images, previewUrls, onImagesChange, maxImages]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const removeImage = useCallback(
    (index: number) => {
      const newImages = images.filter((_, i) => i !== index);
      const newUrls = previewUrls.filter((_, i) => i !== index);
      // Revoke the old URL to free memory
      URL.revokeObjectURL(previewUrls[index]);
      onImagesChange(newImages, newUrls);
    },
    [images, previewUrls, onImagesChange]
  );

  return (
    <div className="image-upload">
      <h2>Upload Damage Photos</h2>
      <p className="subtitle">
        Upload photos of the fire/smoke-damaged area for assessment.
        Maximum {maxImages} images.
      </p>

      <div
        className={`drop-zone ${isDragging ? 'dragging' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          type="file"
          id="file-input"
          accept="image/*"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          style={{ display: 'none' }}
        />
        <label htmlFor="file-input" className="drop-zone-content">
          <div className="upload-icon">📷</div>
          <p>Drag & drop images here or click to browse</p>
          <p className="hint">
            {images.length} of {maxImages} images selected
          </p>
        </label>
      </div>

      {previewUrls.length > 0 && (
        <div className="image-previews">
          {previewUrls.map((url, index) => (
            <div key={url} className="preview-item">
              <img src={url} alt={`Upload ${index + 1}`} />
              <button
                className="remove-btn"
                onClick={() => removeImage(index)}
                aria-label="Remove image"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="actions">
        <button
          className="primary-btn"
          onClick={onNext}
          disabled={images.length === 0}
        >
          Continue to Details
        </button>
      </div>
    </div>
  );
}
