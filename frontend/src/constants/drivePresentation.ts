// Centralized drive presentation constants (colors, weights, opacity) and helpers

// Single source of truth for the unified fault red. Used by:
//   - Map fault circles + connecting lines (RoverPathLayer)
//   - Tailwind `bg-stellar-fault-red` / `error` (mapped via CSS variable
//     `--fault-red` in index.css and tailwind.config.js)
//   - Dev fault-red picker default + reset
// Change here to update the baked-in default in one place.
export const FAULT_RED = '#d23737';

// UI tokens for a Stellar-like grayscale interface
export const UI_TOKENS = {
  PRIMARY_BG: '#000000',
  PRIMARY_TEXT_ON: '#ffffff',
  SURFACE: '#ffffff',
  SURFACE_SUBTLE: '#f6f7f9',
  BORDER: '#e5e7eb',
  TEXT_PRIMARY: '#0f172a',
  TEXT_SECONDARY: '#475569',
} as const;

// Drive presentation constants
export const DRIVE_PRESENTATION = {
  // Colors
  COLORS: {
    FOCUSED_WHITE: '#ffffff',
    DEFAULT: '#ffffff',
    // Single grey color for search result drives
    SEARCH_RESULT_GREY: '#6b7280', // gray-500
    // Chart colors for combined charts view (8 colors that work in both light and dark modes).
    // Note: we intentionally avoid the UI accent color (#3b82f6) here — chart lines use a
    // neutral slate instead so the accent stays reserved for interactive UI elements.
    CHART_COLORS: [
      '#bfcfdf', // 1st selected drive (cool light gray-blue)
      '#70acff', // 2nd selected drive (mid blue)
      '#af99ff', // 3rd selected drive (lavender)
      FAULT_RED, // unified fault red (replaces red-500)
      '#06b6d4', // cyan-500
      '#84cc16', // lime-500
      '#f97316', // orange-500
      '#10b981', // emerald-500
    ] as const,
  },
  // Opacity
  OPACITY: {
    OPAQUE: 1.0,
    NON_FOCUSED: 0.4, // slightly translucent (standard)
    THUMBNAIL_NON_FOCUSED: 0.4, // more translucent in thumbnail
  },
  // Weights: simplified to primary vs others, with thumbnail-scaled versions
  WEIGHTS: {
    PRIMARY: 7,
    OTHER: 4,
    THUMBNAIL_PRIMARY: 4,
    THUMBNAIL_OTHER: 2,
  },
} as const;

// Backwards-compatible named exports (to minimize changes in components)
export const DRIVE_COLORS = {
  FOCUSED: DRIVE_PRESENTATION.COLORS.FOCUSED_WHITE,
  DEFAULT: DRIVE_PRESENTATION.COLORS.DEFAULT,
  // For components still referencing SELECTED, keep it white
  SELECTED: DRIVE_PRESENTATION.COLORS.FOCUSED_WHITE,
  // Light slate for generic search fallback (not usually used directly)
  SEARCH_RESULTS: '#cbd5e1',
} as const;

export const DRIVE_OPACITY = {
  FOCUSED: DRIVE_PRESENTATION.OPACITY.OPAQUE,
  DEFAULT: DRIVE_PRESENTATION.OPACITY.OPAQUE,
  DIMMED_NON_FOCUSED: DRIVE_PRESENTATION.OPACITY.NON_FOCUSED,
  SELECTED_WHEN_FOCUSED: DRIVE_PRESENTATION.OPACITY.NON_FOCUSED,
  HOVERED: DRIVE_PRESENTATION.OPACITY.OPAQUE,
} as const;

export const DRIVE_WEIGHTS = {
  FOCUSED: DRIVE_PRESENTATION.WEIGHTS.PRIMARY,
  SELECTED: DRIVE_PRESENTATION.WEIGHTS.PRIMARY,
  SELECTED_LIGHT: DRIVE_PRESENTATION.WEIGHTS.PRIMARY,
  SEARCH_RESULTS: DRIVE_PRESENTATION.WEIGHTS.PRIMARY,
  DEFAULT: DRIVE_PRESENTATION.WEIGHTS.OTHER,
} as const;

/**
 * Dynamically calculate a darker version of a hex color
 * @param hexColor - Hex color string (e.g., '#ffff00')
 * @param darkenFactor - Factor to darken by (0-1, default 0.2)
 * @returns Darker hex color string
 */
export function darkenColor(hexColor: string, darkenFactor: number = 0.2): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);
  const darkerR = Math.max(0, Math.floor(r * (1 - darkenFactor)));
  const darkerG = Math.max(0, Math.floor(g * (1 - darkenFactor)));
  const darkerB = Math.max(0, Math.floor(b * (1 - darkenFactor)));
  const darkerHex = '#' +
    darkerR.toString(16).padStart(2, '0') +
    darkerG.toString(16).padStart(2, '0') +
    darkerB.toString(16).padStart(2, '0');
  return darkerHex;
}

/**
 * Get the assigned color for a selected drive based on its position in the selection order.
 * Returns undefined if the drive is not selected.
 */
export function getSelectedDriveColor(driveId: string, selectedDrives: string[]): string | undefined {
  const index = selectedDrives.indexOf(driveId);
  if (index === -1) return undefined;
  return DRIVE_PRESENTATION.COLORS.CHART_COLORS[index % DRIVE_PRESENTATION.COLORS.CHART_COLORS.length];
}

// Terrain color mappings (used in charts/UI outside of map rendering)
export const TERRAIN_COLORS = {
  BEDROCK: '#8B4513',    // Saddle brown
  CRATER: '#2F4F4F',     // Dark slate gray
  ROCK_FIELD: '#696969', // Dim gray
  SAND: '#F4A460',       // Sandy brown
  SAND_DUNE: '#DEB887',  // Burlywood
  SOIL: '#8B4A00',       // Dark orange/brown
  DEFAULT: '#D3D3D3'     // Light gray for unknown
} as const;


