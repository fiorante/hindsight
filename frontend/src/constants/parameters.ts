// Centralized parameter metadata (display names and units)

export type UnitInfo = {
  // Human-readable unit label used in chips/titles, e.g., "degrees"
  label?: string;
  // Short symbol appended to numeric values, e.g., "°"
  symbol?: string;
};

export type ParameterMetadata = {
  unit?: UnitInfo;
};

// Canonical parameter keys:
// - Non-motor parameters are lowercase (e.g., "slope", "tilt")
// - Motor parameters retain their uppercase dotted form if/when added
export const PARAMETER_METADATA: Record<string, ParameterMetadata> = {
  // Basic telemetry
  elevation: { unit: { label: 'm', symbol: 'm' } },
  slope: { unit: { label: 'degrees', symbol: '°' } },
  slip: {},
  velocity: { unit: { label: 'm/s', symbol: 'm/s' } },
  heading: { unit: { label: 'degrees', symbol: '°' } },
  terrain: {},

  // Position and acceleration
  easting: { unit: { label: 'm', symbol: 'm' } },
  northing: { unit: { label: 'm', symbol: 'm' } },
  pos_x: { unit: { label: 'm', symbol: 'm' } },
  pos_y: { unit: { label: 'm', symbol: 'm' } },
  pos_z: { unit: { label: 'm', symbol: 'm' } },
  accel_x: { unit: { label: 'm/s²', symbol: 'm/s²' } },
  accel_y: { unit: { label: 'm/s²', symbol: 'm/s²' } },
  accel_z: { unit: { label: 'm/s²', symbol: 'm/s²' } },
  raw_accel_x: { unit: { label: 'm/s²', symbol: 'm/s²' } },
  raw_accel_y: { unit: { label: 'm/s²', symbol: 'm/s²' } },
  raw_accel_z: { unit: { label: 'm/s²', symbol: 'm/s²' } },

  // Attitude
  pitch: { unit: { label: 'degrees', symbol: '°' } },
  roll: { unit: { label: 'degrees', symbol: '°' } },
  yaw: { unit: { label: 'degrees', symbol: '°' } },
  tilt: { unit: { label: 'degrees', symbol: '°' } },
  accel_pitch: { unit: { label: 'deg/s²', symbol: '°/s²' } },
  accel_tilt: { unit: { label: 'deg/s²', symbol: '°/s²' } },
  accel_roll: { unit: { label: 'deg/s²', symbol: '°/s²' } },

  // Mobility system
  bogie_l: { unit: { label: 'degrees', symbol: '°' } },
  bogie_r: { unit: { label: 'degrees', symbol: '°' } },
  diff_l: { unit: { label: 'degrees', symbol: '°' } },
  diff_r: { unit: { label: 'degrees', symbol: '°' } },

  // Motor parameter suffixes (apply to any motor prefix like drive_lf, steer_rf, etc.)
  odom: {}, // Unitless
  angle: { unit: { label: 'radians', symbol: 'rad' } },
  voltage: { unit: { label: 'V', symbol: 'V' } },
  field: {}, // Unitless
  state: {}, // Unitless
  cbrake_ma: { unit: { label: 'mA', symbol: 'mA' } },
  cmotor: { unit: { label: 'mA', symbol: 'mA' } },
  cstatus: {}, // Unitless
  cbrake_status: {}, // Unitless
  tprt1: { unit: { label: '°C', symbol: '°C' } },
  angular_rate: { unit: { label: 'rad/s', symbol: 'rad/s' } },
};

const toLower = (p: string | undefined | null) => (p ?? '').toLowerCase();

export const getParameterUnitLabel = (parameter: string): string | undefined => {
  const lower = toLower(parameter);
  const key = lower.includes('.') ? lower.split('.', 2)[1] : lower;
  const meta = PARAMETER_METADATA[key];
  return meta?.unit?.label ?? undefined;
};

export const getParameterUnitSymbol = (parameter: string): string | undefined => {
  const lower = toLower(parameter);
  const key = lower.includes('.') ? lower.split('.', 2)[1] : lower;
  const meta = PARAMETER_METADATA[key];
  return meta?.unit?.symbol ?? undefined;
};

export const getUnitsForParameter = (parameter: string): UnitInfo => {
  return {
    label: getParameterUnitLabel(parameter),
    symbol: getParameterUnitSymbol(parameter),
  };
};

// Helper to expose available parameters in the same shape expected by the repository
// Keys that represent generic motor parameter suffixes, not standalone telemetry parameters
const MOTOR_SUFFIX_KEYS = [
  'odom',
  'angle',
  'voltage',
  'field',
  'state',
  'cbrake_ma',
  'cmotor',
  'cstatus',
  'cbrake_status',
  'tprt1',
  'angular_rate',
];

export const getAvailableParameters = (): Array<{ parameter: string; displayName: string; unit?: string }> => {
  return Object.entries(PARAMETER_METADATA)
    .filter(([key]) => !MOTOR_SUFFIX_KEYS.includes(key))
    .map(([parameter, meta]) => ({
      parameter,
      displayName: parameter,
      unit: meta.unit?.label,
    }));
};


