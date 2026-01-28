/**
 * ImageGallery Component
 * Displays uploaded images in a thumbnail grid with lightbox preview
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Image, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

type ImageGalleryProps = {
  images: string[];
  className?: string;
  collapsible?: boolean;
};

export function ImageGallery({
  images,
  className,
  collapsible = true,
}: ImageGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  if (images.length === 0) {
    return null;
  }

  return (
    <>
      <Card className={cn(className)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Image className="h-5 w-5" />
              Assessment Images ({images.length})
            </CardTitle>
            {collapsible && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsExpanded(!isExpanded)}
              >
                {isExpanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        {isExpanded && (
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {images.map((src, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedImage(src)}
                  className="group relative aspect-square rounded-lg overflow-hidden bg-muted ring-offset-background transition-all hover:ring-2 hover:ring-ring hover:ring-offset-2 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                >
                  <img
                    src={src}
                    alt={`Assessment image ${index + 1}`}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
                </button>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Lightbox Dialog */}
      <Dialog open={selectedImage !== null} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl p-2 bg-black/95 border-none">
          {selectedImage && (
            <img
              src={selectedImage}
              alt="Full size assessment image"
              className="w-full h-auto max-h-[85vh] object-contain rounded"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
