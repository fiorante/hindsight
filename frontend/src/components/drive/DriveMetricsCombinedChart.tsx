import React, { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { usePlayhead } from '../providers/TimelinePlayheadProvider';
import { useThrottledCallback } from '../../hooks/useThrottledCallback';
import { getParameterUnitSymbol } from '../../constants/parameters';
import { DRIVE_PRESENTATION } from '../../constants/drivePresentation';

// Chart margin constants to match individual charts
const TOP_MARGIN_PX = 4;
const LEFT_MARGIN_PX = 24;
const RIGHT_MARGIN_PX = 16;
const BOTTOM_MARGIN_PX = 35;
const Y_AXIS_WIDTH_PX = 28; // Combined chart uses slightly wider Y axis

interface DriveMetricCombinedChartProps {
  driveId: string;
  chartTypes: string[];
  chartsData?: Record<string, any>; // Chart data from new API
}

// Custom tooltip that shows all chart values vertically with units
const CustomTooltip: React.FC<any> = ({ active, payload, label, ...rest }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-300 shadow-lg rounded p-3">
        <div className="font-semibold mb-2">SCLK: {label}</div>
        <div className="space-y-1">
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="font-medium">{entry.name}:</span>
              <span>
                {entry.value}
                {(() => {
                  const sym = getParameterUnitSymbol(entry.name);
                  return sym ? (/[a-zA-Z]/.test(sym) ? ` ${sym}` : sym) : '';
                })()}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

// Empty tooltip component that filters out Recharts internal props
const EmptyTooltip: React.FC<any> = (props) => {
  // Destructure and ignore all Recharts internal props
  const {
    active,
    payload,
    label,
    coordinate,
    viewBox,
    isAnimationActive,
    animationDuration,
    animationEasing,
    axisId,
    contentStyle,
    filterNull,
    itemSorter,
    itemStyle,
    labelStyle,
    reverseDirection,
    useTranslate3d,
    wrapperStyle,
    accessibilityLayer,
    allowEscapeViewBox,
    // Only pass through safe DOM props
    className,
    style,
    id,
    ...rest
  } = props;

  return <div className={className} style={style} id={id} />;
};

// Static combined chart component
const StaticCombinedChart = React.memo<{
  data: any[];
  chartTypes: string[];
  isDragging: boolean;
  onHoverNormalized: (normalized: number) => void;
}>(({ data, chartTypes, isDragging, onHoverNormalized }) => {
  const getChartColor = (_chartType: string, _index: number) => {
    // All chart lines render in the same slate blue (CHART_COLORS[0]) for
    // visual consistency, regardless of parameter type or position.
    return DRIVE_PRESENTATION.COLORS.CHART_COLORS[0];
  };

  // Format time for X axis
  const formatTime = (value: number) => {
    if (!value) return '';
    const totalMinutes = Math.floor(value / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart
        data={data}
        margin={{
          top: 5,
          right: RIGHT_MARGIN_PX,
          left: LEFT_MARGIN_PX,
          bottom: 5,
        }}
        onMouseMove={(state: any) => {
          // Update playhead during drag
          if (!isDragging) return;

          const driveTime = state?.activeLabel;
          if (typeof driveTime === 'number' && onHoverNormalized) {
            const maxDriveTime = data?.[data.length - 1]?.driveTime ?? 0;
            if (maxDriveTime > 0) {
              const normalized = Math.min(1, Math.max(0, driveTime / maxDriveTime));
              onHoverNormalized(normalized);
            }
          }
        }}
        onClick={(state: any) => {
          // Update playhead immediately on click
          const driveTime = state?.activeLabel;
          if (typeof driveTime === 'number' && onHoverNormalized) {
            const maxDriveTime = data?.[data.length - 1]?.driveTime ?? 0;
            if (maxDriveTime > 0) {
              const normalized = Math.min(1, Math.max(0, driveTime / maxDriveTime));
              onHoverNormalized(normalized);
            }
          }
        }}
      >
        <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
        <XAxis
          type="number"
          dataKey="driveTime"
          domain={[0, 'dataMax']}
          allowDataOverflow
          tick={{ fontSize: 10 }}
          tickFormatter={formatTime}
          interval={Math.floor(data.length / 5)}
        />
        <YAxis
          tick={{ fontSize: 10 }}
          width={Y_AXIS_WIDTH_PX}
        />
        <Tooltip
          content={isDragging ? <CustomTooltip /> : <EmptyTooltip />}
          isAnimationActive={false}
          cursor={{ stroke: '#ffffff', strokeWidth: 3, strokeOpacity: 0.9 }}
          active={isDragging}
        />
        <Legend formatter={(value) => String(value).toUpperCase()} />

        {chartTypes.map((chartType, index) => {
          const safeKey = chartType.replaceAll('.', '__');
          return (
            <Line
              key={chartType}
              type="monotone"
              dataKey={safeKey}
              stroke={getChartColor(chartType, index)}
              strokeWidth={2}
              dot={false}
              activeDot={isDragging ? undefined : false}
              name={chartType.toUpperCase()}
              isAnimationActive={false}
            />
          );
        })}


      </ComposedChart>
    </ResponsiveContainer>
  );
});

// Reserved: playhead info calculator for future overlay rendering

// Main component
const DriveMetricsCombinedChartComponent: React.FC<DriveMetricCombinedChartProps> = ({
  driveId,
  chartTypes,
  chartsData,
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const { setDrivePosition, drivePositions } = usePlayhead();
  const [isDragging, setIsDragging] = useState(false);

  // Use throttled callback for drive position updates
  const scheduleSetDrivePosition = useThrottledCallback(
    (normalized: number) => setDrivePosition(driveId, normalized)
  );

  // Process chart data from the new API
  const chartData = useMemo(() => {
    if (!chartsData || Object.keys(chartsData).length === 0) return [];

    // Get the first chart's data to determine the time range
    const firstChartKey = Object.keys(chartsData)[0];
    const firstChartData = chartsData[firstChartKey]?.data;
    if (!firstChartData || firstChartData.length === 0) return [];

    // Calculate drive start time (first SCLK value)
    const driveStartSclk = (typeof firstChartData[0]?.sclk === 'number' && isFinite(firstChartData[0].sclk)) ? firstChartData[0].sclk : 0;

    // Create combined data points
    const combined = firstChartData.map((item: any, index: number) => {
      const s = (typeof item.sclk === 'number' && isFinite(item.sclk)) ? item.sclk : null;
      const dataPoint: any = {
        sclk: s,
        driveTime: s !== null ? (s - driveStartSclk) : 0,
      };

      chartTypes.forEach((chartType) => {
        const chartData = chartsData[chartType]?.data;
        if (chartData && chartData[index]) {
          const safeKey = chartType.replaceAll('.', '__');
          dataPoint[safeKey] = chartData[index].value;
        } else {
          const safeKey = chartType.replaceAll('.', '__');
          dataPoint[safeKey] = 0;
        }
      });

      return dataPoint;
    });
    return combined;
  }, [chartsData, chartTypes]);

  // Handle drag events
  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Add global mouse event listeners for drag
  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseUp = () => setIsDragging(false);
      document.addEventListener('mouseup', handleGlobalMouseUp);
      return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
    }
  }, [isDragging]);

  // Normalized playhead (0..1) for overlay reference line
  const normalizedPlayhead = useMemo(() => {
    const pos = drivePositions?.[driveId];
    if (pos === undefined || pos === null) return 0;
    return Math.max(0, Math.min(1, pos));
  }, [drivePositions, driveId]);

  if (chartData.length === 0) {
    return <div className="h-full flex items-center justify-center text-gray-500">No chart data available</div>;
  }

  return (
    <div
      className="h-full w-full relative"
      ref={chartRef}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      {/* Static chart that never re-renders due to playhead changes */}
      <StaticCombinedChart
        data={chartData}
        chartTypes={chartTypes}
        isDragging={isDragging}
        onHoverNormalized={scheduleSetDrivePosition}
      />

      {/* Overlay reference line aligned to chart plot bounds (left ~50px, right 16px).
          The handle dot stays visible during drag (the line is hidden while Recharts
          renders its own tooltip cursor line at the same position). */}
      <div
        className="absolute inset-y-0 pointer-events-none"
        style={{ left: LEFT_MARGIN_PX + Y_AXIS_WIDTH_PX, right: RIGHT_MARGIN_PX, bottom: BOTTOM_MARGIN_PX, top: TOP_MARGIN_PX }}
      >
        {!isDragging && (
          <div
            className="absolute top-0 h-full bg-white"
            style={{
              // 2px-wide line, shifted left by 1px so its visual center sits
              // exactly on `normalizedPlayhead` — keeps the handle dot aligned.
              left: `${normalizedPlayhead * 100}%`,
              width: 2,
              marginLeft: -1,
            }}
          />
        )}
        {/* Playhead handle dot at the top of the line */}
        <div
          className="absolute w-2.5 h-2.5 rounded-full bg-white"
          style={{
            left: `${normalizedPlayhead * 100}%`,
            top: 0,
            transform: 'translate(-50%, -50%)',
          }}
        />
      </div>
    </div>
  );
};

// Export the memoized component with display name
export const DriveMetricsCombinedChart = React.memo(DriveMetricsCombinedChartComponent);
DriveMetricsCombinedChart.displayName = 'DriveMetricsCombinedChart';