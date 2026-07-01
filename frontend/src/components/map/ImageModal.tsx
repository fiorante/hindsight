import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X, Pencil, Share2 } from 'lucide-react';
import { imageRepository } from '../../api/repositories/imageRepository';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '../ui/Toast';

interface ModalImage {
  filename: string;
  description?: string;
  sclk?: number;
  source: 'vce' | 'pdi';
}

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  sol: number;
  image: ModalImage | null;
}

// Side selector component (larger version for modal)
const SideSelector: React.FC<{
  value: 'left' | 'both' | 'right';
  onChange: (v: 'left' | 'both' | 'right') => void
}> = ({ value, onChange }) => {
  const base = 'px-4 py-2 text-sm rounded-full font-medium';
  const active = 'bg-gray-900 text-white';
  const inactive = 'bg-white text-gray-700 hover:bg-gray-100';
  return (
    <div className="inline-flex items-center gap-1 border border-gray-200 rounded-full p-1 bg-gray-100">
      <button className={`${base} ${value === 'left' ? active : inactive}`} onClick={() => onChange('left')}>LEFT</button>
      <button className={`${base} ${value === 'both' ? active : inactive}`} onClick={() => onChange('both')}>BOTH</button>
      <button className={`${base} ${value === 'right' ? active : inactive}`} onClick={() => onChange('right')}>RIGHT</button>
    </div>
  );
};

export const ImageModal: React.FC<ImageModalProps> = ({ isOpen, onClose, sol, image }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [sideMode, setSideMode] = useState<'left' | 'both' | 'right'>('left');
  const [allImages, setAllImages] = useState<ModalImage[]>([]);
  const [imagePairs, setImagePairs] = useState<Array<{ left?: ModalImage; right?: ModalImage; sclk?: number }>>([]);
  const [currentPairIndex, setCurrentPairIndex] = useState(0);
  const { showToast } = useToast();

  // Fetch all available images for the sol based on the source type
  const { data: pdiData } = useQuery({
    queryKey: ['pdi', sol],
    queryFn: () => imageRepository.getPDIForSol(sol),
    enabled: isOpen && image?.source === 'pdi',
  });

  const { data: vceData } = useQuery({
    queryKey: ['vce', sol],
    queryFn: () => imageRepository.getVCEForSol(sol),
    enabled: isOpen && image?.source === 'vce',
  });

  // Build the list of all available images and image pairs
  useEffect(() => {
    if (!isOpen || !image) return;

    const images: ModalImage[] = [];
    const pairs: Array<{ left?: ModalImage; right?: ModalImage; sclk?: number }> = [];

    if (image.source === 'pdi' && pdiData) {
      // Add all PDI images
      const cameraSets = [pdiData.fhaz, pdiData.rhaz, pdiData.ncam];
      cameraSets.forEach(set => {
        if (set.left?.filename) {
          images.push({
            filename: set.left.filename,
            description: set.left.description,
            sclk: set.left.sclk,
            source: 'pdi'
          });
        }
        if (set.right?.filename) {
          images.push({
            filename: set.right.filename,
            description: set.right.description,
            sclk: set.right.sclk,
            source: 'pdi'
          });
        }
      });

      // For PDI, each image is its own "pair"
      images.forEach(img => {
        pairs.push({ left: img, sclk: img.sclk });
      });
    } else if (image.source === 'vce' && vceData) {
      // Add all VCE images and group them by SCLK for pair navigation
      vceData.images.forEach(vceImage => {
        const pair: { left?: ModalImage; right?: ModalImage; sclk?: number } = { sclk: vceImage.sclk };

        if (vceImage.left_filename) {
          const leftImg: ModalImage = {
            filename: vceImage.left_filename,
            description: 'VCE Left',
            sclk: vceImage.sclk,
            source: 'vce' as const
          };
          images.push(leftImg);
          pair.left = leftImg;
        }

        if (vceImage.right_filename) {
          const rightImg: ModalImage = {
            filename: vceImage.right_filename,
            description: 'VCE Right',
            sclk: vceImage.sclk,
            source: 'vce' as const
          };
          images.push(rightImg);
          pair.right = rightImg;
        }

        pairs.push(pair);
      });
    }

    setAllImages(images);
    setImagePairs(pairs);

    // Find the current pair index
    const currentPairIndex = pairs.findIndex(pair =>
      pair.left?.filename === image.filename || pair.right?.filename === image.filename
    );
    setCurrentPairIndex(currentPairIndex >= 0 ? currentPairIndex : 0);

    // Set initial side mode based on current image
    if (image.source === 'vce') {
      const currentVceImage = vceData?.images.find(vce =>
        vce.left_filename === image.filename || vce.right_filename === image.filename
      );
      if (currentVceImage) {
        const hasLeft = !!currentVceImage.left_filename;
        const hasRight = !!currentVceImage.right_filename;
        if (hasLeft && hasRight) {
          setSideMode('both');
        } else if (hasLeft) {
          setSideMode('left');
        } else if (hasRight) {
          setSideMode('right');
        }
      }
    } else {
      // For PDI, default to left
      setSideMode('left');
    }
  }, [isOpen, image, pdiData, vceData]);

  const handlePrevious = useCallback(() => {
    setCurrentPairIndex(prev => (prev > 0 ? prev - 1 : imagePairs.length - 1));
  }, [imagePairs.length]);

  const handleNext = useCallback(() => {
    setCurrentPairIndex(prev => (prev < imagePairs.length - 1 ? prev + 1 : 0));
  }, [imagePairs.length]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'Escape':
        onClose();
        break;
      case 'ArrowLeft':
        handlePrevious();
        break;
      case 'ArrowRight':
        handleNext();
        break;
    }
  }, [isOpen, onClose, handlePrevious, handleNext]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!isOpen || !image || imagePairs.length === 0) return null;

  const currentPair = imagePairs[currentPairIndex];
  const currentImage = currentPair.left || currentPair.right;

  const getImageryType = () => {
    return currentImage?.source === 'vce' ? 'VISUAL COMPUTE ELEMENTS (VCE)' : 'POST DRIVE IMAGERY (PDI)';
  };

  const getSubtitle = () => {
    if (!currentPair) return '';

    const sclkText = currentPair.sclk ? ` • SCLK: ${currentPair.sclk}` : '';

    if (currentImage?.source === 'vce' && sideMode === 'both' && currentPair.left && currentPair.right) {
      // Show both filenames for VCE in "both" mode
      return `${currentPair.left.filename} / ${currentPair.right.filename}${sclkText}`;
    } else if (currentPair.left && sideMode === 'left') {
      return `${currentPair.left.filename}${sclkText}`;
    } else if (currentPair.right && sideMode === 'right') {
      return `${currentPair.right.filename}${sclkText}`;
    } else {
      // Fallback to current image
      return `${currentImage?.filename || ''}${sclkText}`;
    }
  };

  // Get the corresponding VCE image pair for side-by-side display
  const getVCEImagePair = () => {
    if (currentImage?.source !== 'vce' || !vceData || !currentPair) return null;

    return {
      left: currentPair.left?.filename ? imageRepository.getVCEImageUrl(currentPair.left.filename) : null,
      right: currentPair.right?.filename ? imageRepository.getVCEImageUrl(currentPair.right.filename) : null,
      sclk: currentPair.sclk
    };
  };

  const vcePair = getVCEImagePair();

  const handleAnnotationsClick = () => {
    showToast('Annotations not yet implemented', 'info');
  };

  const handleSharingClick = () => {
    showToast('Sharing not yet implemented', 'info');
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black bg-opacity-90 backdrop-blur-sm flex items-center justify-center z-[99999]"
      onClick={onClose}
    >
      {/* Main image container - prevent click propagation only on interactive elements */}
      <div
        className="relative w-full h-full flex items-center justify-center"
      >
        {/* Header */}
        <div
          className="absolute top-0 left-0 right-0 bg-black bg-opacity-60 text-white p-4 z-10"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={onClose}
                className="text-white hover:text-gray-300 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
              <span className="text-base font-medium">{getImageryType()}</span>

              {/* Side selector for VCE */}
              {currentImage?.source === 'vce' && vcePair && (
                <SideSelector value={sideMode} onChange={setSideMode} />
              )}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleAnnotationsClick}
                className="text-white hover:text-gray-300 transition-colors p-2"
                title="Annotations"
              >
                <Pencil className="h-5 w-5" />
              </button>
              <button
                onClick={handleSharingClick}
                className="text-white hover:text-gray-300 transition-colors p-2"
                title="Share"
              >
                <Share2 className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Subtitle */}
          <div className="mt-2 text-xs text-gray-300">
            {getSubtitle()}
          </div>
        </div>

        {/* Navigation arrows */}
        {imagePairs.length > 1 && (
          <>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrevious();
              }}
              className="absolute left-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-60 text-white p-3 rounded-full hover:bg-opacity-80 transition-all z-10"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-60 text-white p-3 rounded-full hover:bg-opacity-80 transition-all z-10"
            >
              <ChevronRight className="h-6 w-6" />
            </button>
          </>
        )}

        {/* Image display */}
        <div
          className="w-full h-full flex items-center justify-center p-4 pt-20"
        >
          {currentImage?.source === 'vce' && vcePair ? (
            // Show VCE images based on side mode
            <div className="flex gap-4 w-full h-full max-w-7xl">
              {(sideMode === 'left' || sideMode === 'both') && vcePair.left && (
                <div className="flex-1 flex items-center justify-center">
                  <img
                    src={vcePair.left}
                    alt="VCE Left"
                    className="max-w-full max-h-full object-contain"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              )}
              {(sideMode === 'right' || sideMode === 'both') && vcePair.right && (
                <div className="flex-1 flex items-center justify-center">
                  <img
                    src={vcePair.right}
                    alt="VCE Right"
                    className="max-w-full max-h-full object-contain"
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              )}
            </div>
          ) : currentImage ? (
            // Show single image
            <img
              src={currentImage.source === 'vce'
                ? imageRepository.getVCEImageUrl(currentImage.filename)
                : imageRepository.getPDIImageUrl(currentImage.filename)
              }
              alt={currentImage.description || currentImage.filename}
              className="max-w-full max-h-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div className="text-white text-center">No image available</div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
