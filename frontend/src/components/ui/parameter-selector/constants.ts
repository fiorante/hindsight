// Define the parameter categories and their items
export const PARAMETER_CATEGORIES = {
  DRIVE: ['DISTANCE', 'DURATION', 'SOL', 'START_SCLK', 'END_SCLK', 'FAULT'],
  ENVIRONMENT: ['TERRAIN', 'SLOPE', 'SLIP'],
  POSE: ['POS_X', 'POS_Y', 'POS_Z', 'ACCEL_X', 'ACCEL_Y', 'ACCEL_Z', 'PITCH', 'ROLL', 'YAW', 'TILT', 'ACCEL_PITCH', 'ACCEL_TILT', 'ACCEL_ROLL', 'RAW_ACCEL_X', 'RAW_ACCEL_Y', 'RAW_ACCEL_Z'],
  MOBILITY: ['BOGIE_L', 'BOGIE_R', 'DIFF_L', 'DIFF_R'],
  MOTOR: ['DRIVE_LF', 'DRIVE_LM', 'DRIVE_LR', 'DRIVE_RF', 'DRIVE_RM', 'DRIVE_RR', 'STEER_LF', 'STEER_LR', 'STEER_RF', 'STEER_RR']
};

// Motor-specific parameters
export const MOTOR_PARAMETERS = ['ODOM', 'ANGLE', 'VOLTAGE', 'FIELD', 'STATE', 'CBRAKE_MA', 'CMOTOR', 'CSTATUS', 'CBRAKE_STATUS', 'TPRT1', 'ANGULAR_RATE'];

// Terrain options
export const TERRAIN_OPTIONS = ['BEDROCK', 'CRATER', 'ROCK_FIELD', 'SAND', 'SAND_DUNE', 'SOIL'];

// Fault options
export const FAULT_OPTIONS = [
  'ANY',
  'CUTOFF_TIME',
  'NO_PATH',
  'VOSLIP_EXCESSIVE',
  'MOT',
  'UNRECOVERABLE',
  'UNSAFE',
  'VO_FAILURES',
  'SUSP',
  'YAW',
  'SAPP_MARGIN',
  'KEEPOUT',
  'AVGCUR',
  'TILT',
  'LIMIT_CYCLE',
  'FATAL',
  'QUEUE',
  'STOP_CMD',
  'YAWRATE'
];

// Function to get available parameters based on mode
export const getAvailableParameters = (mode: 'parameter-only' | 'parameter-value') => {
  const allParams = Object.values(PARAMETER_CATEGORIES).flat();
  if (mode === 'parameter-only') {
    return allParams.filter(param => !['SOL', 'END_SCLK', 'START_SCLK'].includes(param));
  }
  return allParams;
};
