import { useQuery, useMutation } from '@tanstack/react-query';
import { imageRepository } from '../api/repositories/imageRepository';
import type { SolPDI, SolVCE } from '../types';

/**
 * Hook for fetching PDI (Post Drive Imagery) for a specific sol
 */
export const usePDI = (sol: number, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['pdi', sol],
    queryFn: () => imageRepository.getPDIForSol(sol),
    enabled: enabled && !!sol,
    staleTime: 30 * 60 * 1000, // 30 minutes - images don't change
    gcTime: 60 * 60 * 1000, // 1 hour
  });
};

/**
 * Hook for getting PDI image URLs
 * This is a utility hook that doesn't make network calls
 */
export const usePDIImageUrls = () => {
  const getImageUrl = (filename: string) => {
    return imageRepository.getPDIImageUrl(filename);
  };

  const getImageUrls = (filenames: string[]) => {
    return imageRepository.getPDIImageUrls(filenames);
  };

  return {
    getImageUrl,
    getImageUrls,
  };
};

/**
 * Hook for preloading PDI images
 * Useful for better UX when you know images will be needed soon
 */
export const usePreloadPDIImages = () => {
  return useMutation({
    mutationFn: (filenames: string[]) => imageRepository.preloadPDIImages(filenames),
  });
};

/**
 * Hook for multiple PDI data queries
 */
export const useMultiplePDI = (sols: number[], enabled: boolean = true) => {
  return useQuery({
    queryKey: ['multiplePDI', sols.sort().join(',')],
    queryFn: async () => {
      const promises = sols.map(sol => imageRepository.getPDIForSol(sol));
      const results = await Promise.allSettled(promises);

      // Return successful results, log failures
      const successfulResults: { sol: number; pdi: SolPDI }[] = [];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successfulResults.push({ sol: sols[index], pdi: result.value });
        } else {
          console.warn(`Failed to fetch PDI for sol ${sols[index]}:`, result.reason);
        }
      });

      return successfulResults;
    },
    enabled: enabled && sols.length > 0,
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  });
};

/**
 * Hook for fetching VCE (Visual Compute Element) data for a specific sol
 */
export const useVCE = (sol: number, enabled: boolean = true) => {
  return useQuery({
    queryKey: ['vce', sol],
    queryFn: () => imageRepository.getVCEForSol(sol),
    enabled: enabled && !!sol,
    staleTime: 30 * 60 * 1000, // 30 minutes - images don't change
    gcTime: 60 * 60 * 1000, // 1 hour
  });
};

/**
 * Hook for getting VCE image URLs
 * This is a utility hook that doesn't make network calls
 */
export const useVCEImageUrls = () => {
  const getImageUrl = (filename: string) => {
    return imageRepository.getVCEImageUrl(filename);
  };

  const getImageUrls = (filenames: string[]) => {
    return imageRepository.getVCEImageUrls(filenames);
  };

  return {
    getImageUrl,
    getImageUrls,
  };
};

/**
 * Hook for preloading VCE images
 * Useful for better UX when you know images will be needed soon
 */
export const usePreloadVCEImages = () => {
  return useMutation({
    mutationFn: (filenames: string[]) => imageRepository.preloadVCEImages(filenames),
  });
};

/**
 * Hook for multiple VCE data queries
 */
export const useMultipleVCE = (sols: number[], enabled: boolean = true) => {
  return useQuery({
    queryKey: ['multipleVCE', sols.sort().join(',')],
    queryFn: async () => {
      const promises = sols.map(sol => imageRepository.getVCEForSol(sol));
      const results = await Promise.allSettled(promises);

      // Return successful results, log failures
      const successfulResults: { sol: number; vce: SolVCE }[] = [];
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successfulResults.push({ sol: sols[index], vce: result.value });
        } else {
          console.warn(`Failed to fetch VCE for sol ${sols[index]}:`, result.reason);
        }
      });

      return successfulResults;
    },
    enabled: enabled && sols.length > 0,
    staleTime: 30 * 60 * 1000, // 30 minutes
    gcTime: 60 * 60 * 1000, // 1 hour
  });
};
