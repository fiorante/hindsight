import { apiClient } from '../client';
import type { SolPDI, SolVCE } from '../../types';

/**
 * Repository for image-related API calls
 */
export class ImageRepository {
  /**
   * Get PDI (Post Drive Imagery) for a specific sol
   */
  async getPDIForSol(sol: number): Promise<SolPDI> {
    // Fetch dedicated PDI endpoint
    const response = await apiClient.get<SolPDI>(`/pdi/${sol}`);
    return response.data;
  }

  /**
   * Get the URL for a specific PDI image
   * @param filename - The PDI image filename
   * @returns Full URL to the image
   */
  getPDIImageUrl(filename: string): string {
    // Using the '/images' path prefix as per memory
    return `${apiClient.defaults.baseURL}/images/pdi/${filename}`;
  }

  /**
   * Get URLs for multiple PDI images
   */
  getPDIImageUrls(filenames: string[]): string[] {
    return filenames.map(filename => this.getPDIImageUrl(filename));
  }

  /**
   * Preload PDI images for better UX
   */
  async preloadPDIImages(filenames: string[]): Promise<void> {
    const preloadPromises = filenames.map(filename => {
      return new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`Failed to load image: ${filename}`));
        img.src = this.getPDIImageUrl(filename);
      });
    });

    try {
      await Promise.all(preloadPromises);
    } catch (error) {
      console.warn('Some images failed to preload:', error);
      // Don't throw - preloading is optional
    }
  }

  /**
   * Get VCE (Visual Compute Element) data for a specific sol
   */
  async getVCEForSol(sol: number): Promise<SolVCE> {
    const response = await apiClient.get(`/vce/${sol}`);
    return response.data;
  }

  /**
   * Get the URL for a specific VCE image
   * @param filename - The VCE image filename
   * @returns Full URL to the image
   */
  getVCEImageUrl(filename: string): string {
    // Using the '/images' path prefix as per memory
    return `${apiClient.defaults.baseURL}/images/vce/${filename}`;
  }

  /**
   * Get URLs for multiple VCE images
   */
  getVCEImageUrls(filenames: string[]): string[] {
    return filenames.map(filename => this.getVCEImageUrl(filename));
  }

  /**
   * Preload VCE images for better UX
   */
  async preloadVCEImages(filenames: string[]): Promise<void> {
    const preloadPromises = filenames.map(filename => {
      return new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`Failed to load VCE image: ${filename}`));
        img.src = this.getVCEImageUrl(filename);
      });
    });

    try {
      await Promise.all(preloadPromises);
    } catch (error) {
      console.warn('Some VCE images failed to preload:', error);
      // Don't throw - preloading is optional
    }
  }
}

// Export singleton instance
export const imageRepository = new ImageRepository();
