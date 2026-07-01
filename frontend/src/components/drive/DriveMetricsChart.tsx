import React, { useRef, useMemo, useState, useEffect, useCallback } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { usePlayhead } from '../providers/TimelinePlayheadProvider';
import { useThrottledCallback } from '../../hooks/useThrottledCallback';
import { useToast } from '../ui/Toast';

import { TERRAIN_COLORS, DRIVE_PRESENTATION } from '../../constants/drivePresentation';
import { TERRAIN_TYPES } from '../../types';
import { getParameterUnitSymbol } from '../../constants/parameters';

// Keep chart margins centralized so overlay aligns with plot bounds
const TOP_MARGIN_PX = 4;
const LEFT_MARGIN_PX = 24;
const RIGHT_MARGIN_PX = 16;
const BOTTOM_MARGIN_PX = 35;
const Y_AXIS_WIDTH_PX = 26;

interface DriveMetricsChartProps {
  driveId: string;
  chartType?: string;
  chartData?: any; // ChartDataResponse from the new API
  isLoading?: boolean;
}

// Custom terrain chart component that shows continuous color blocks
const TerrainChart: React.FC<{ data: any[] }> = React.memo(({ data }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Group consecutive terrain types for efficient rendering
  const terrainSegments = useMemo(() => {
    if (!data || data.length === 0) return [];

    const segments: Array<{
      terrain: string | null;
      startIndex: number;
      endIndex: number;
      startDriveTime: number;
      endDriveTime: number;
    }> = [];

    let currentTerrain = data[0]?.terrain;
    let startIndex = 0;

    for (let i = 1; i < data.length; i++) {
      if (data[i].terrain !== currentTerrain) {
        segments.push({
          terrain: currentTerrain,
          startIndex,
          endIndex: i - 1,
          startDriveTime: data[startIndex].driveTime,
          endDriveTime: data[i - 1].driveTime
        });
        currentTerrain = data[i].terrain;
        startIndex = i;
      }
    }

    // Add the final segment
    segments.push({
      terrain: currentTerrain,
      startIndex,
      endIndex: data.length - 1,
      startDriveTime: data[startIndex].driveTime,
      endDriveTime: data[data.length - 1].driveTime
    });

    return segments;
  }, [data]);

  // Early return after all hooks
  if (!data || data.length === 0) {
    return <div className="w-full h-full flex items-center justify-center text-gray-500">No terrain data</div>;
  }

  // Get terrain type for display
  const getTerrainDisplayName = (terrainKey: string | null) => {
    if (!terrainKey) return 'Unknown';
    // Convert the terrain key to match TERRAIN_TYPES
    const normalizedKey = terrainKey.toUpperCase().replace(/\s+/g, '_');
    return TERRAIN_TYPES[normalizedKey as keyof typeof TERRAIN_TYPES] || terrainKey;
  };

  // Get color for terrain type
  const getTerrainColor = (terrainKey: string | null) => {
    if (!terrainKey) return TERRAIN_COLORS.DEFAULT;
    const normalizedKey = terrainKey.toUpperCase().replace(/\s+/g, '_');
    return TERRAIN_COLORS[normalizedKey as keyof typeof TERRAIN_COLORS] || TERRAIN_COLORS.DEFAULT;
  };

  const totalDriveTimeRange = data[data.length - 1].driveTime - data[0].driveTime;

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col">
      {/* Terrain blocks */}
      <div className="flex-1 flex">
        {terrainSegments.map((segment, index) => {
          const width = ((segment.endDriveTime - segment.startDriveTime) / totalDriveTimeRange) * 100;
          const color = getTerrainColor(segment.terrain);
          const displayName = getTerrainDisplayName(segment.terrain);

          return (
            <div
              key={index}
              className="h-full flex items-center justify-center text-white text-xs font-medium border-r border-white"
              style={{
                width: `${width}%`,
                backgroundColor: color,
                minWidth: '2px'
              }}
              title={displayName}
            >
              {width > 10 && displayName}
            </div>
          );
        })}
      </div>

      {/* Time axis */}
      <div className="h-6 flex text-xs text-gray-600 border-t">
        <div className="flex-1 text-left pl-1">
          {(() => {
            const totalMinutes = Math.floor(data[0].driveTime / 60);
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
          })()}
        </div>
        <div className="flex-1 text-right pr-1">
          {(() => {
            const totalMinutes = Math.floor(data[data.length - 1].driveTime / 60);
            const hours = Math.floor(totalMinutes / 60);
            const minutes = totalMinutes % 60;
            return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
          })()}
        </div>
      </div>
    </div>
  );
});

// Custom tooltip component styled to match imagery tooltip semantics
const CustomTooltip: React.FC<any> = ({ active, payload, ...rest }) => {
  if (active && payload && payload.length) {
    const point = payload[0];
    const value = point.value;
    const chartTypeKey = point.dataKey;
    const chartName = point.name ?? chartTypeKey;
    const sclk = point.payload?.sclk;
    const symbol = getParameterUnitSymbol(chartTypeKey);

    const formattedValue = typeof value === 'number' ? value.toFixed(3) : value;

    return (
      <div className="bg-white border border-gray-300 shadow-lg rounded p-2 text-xs font-mono">
        <div className="flex items-baseline gap-1">
          <span className="text-[11px] leading-none text-gray-500">sclk</span>
          <span className="font-semibold text-black leading-none">{sclk}</span>
        </div>
        <div className="flex items-baseline gap-1 mt-1">
          <span className="text-[11px] leading-none text-gray-500">{chartName}</span>
          <span className="font-semibold text-black leading-none">
            {formattedValue}
            {symbol ? symbol : ''}
          </span>
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

// Static chart component that never re-renders due to playhead changes
const StaticChart = React.memo<{
  data: any[];
  chartType: string;
  color: string;
  isDragging: boolean;
  onHoverNormalized?: (normalized: number) => void;
  onHoverPoint?: (point: { sclk: number | null; value: number | null } | null) => void;
}>(({ data, chartType, color, isDragging, onHoverNormalized, onHoverPoint }) => {
  // Format time for X axis
  const formatTime = (value: number) => {
    if (!value) return '';
    const totalMinutes = Math.floor(value / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  };

  // Format value for Y axis
  const formatValue = (value: number) => {
    const symbol = getParameterUnitSymbol(chartType);
    if (!symbol) return `${value}`;
    const needsSpace = /[a-zA-Z]/.test(symbol);
    return `${value}${needsSpace ? ' ' : ''}${symbol}`;
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
          if (onHoverPoint) {
            const payload = state?.activePayload?.[0]?.payload;
            if (payload) {
              onHoverPoint({ sclk: payload.sclk ?? null, value: payload.value ?? null });
            } else if (typeof driveTime === 'number' && Array.isArray(data) && data.length > 0) {
              // Fallback: find nearest datapoint by driveTime
              let nearestIdx = 0;
              let nearestDist = Infinity;
              // Linear scan is fine for current data sizes
              for (let i = 0; i < data.length; i++) {
                const d = Math.abs((data[i].driveTime ?? 0) - driveTime);
                if (d < nearestDist) {
                  nearestDist = d;
                  nearestIdx = i;
                }
              }
              const pt = data[nearestIdx];
              onHoverPoint({ sclk: pt?.sclk ?? null, value: pt?.value ?? null });
            } else {
              onHoverPoint(null);
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
          tickFormatter={formatValue}
        />
        <Tooltip
          content={isDragging ? <CustomTooltip /> : <EmptyTooltip />}
          isAnimationActive={false}
          cursor={{ stroke: '#ffffff', strokeWidth: 2, strokeOpacity: 0.9 }}
          active={true}
        />
        <Line
          type="monotone"
          dataKey="value"
          name={chartType}
          stroke={color}
          dot={false}
          // Suppress the white-outlined active dot unless the user is actively
          // scrubbing — otherwise it follows the mouse and feels noisy on hover.
          activeDot={isDragging ? undefined : false}
          strokeWidth={1.5}
          isAnimationActive={false}
        />

      </ComposedChart>
    </ResponsiveContainer>
  );
});

// Reserved for future: Playhead info calculator for overlay rendering

// Main chart component
const DriveMetricsChartComponent: React.FC<DriveMetricsChartProps> = ({
  driveId,
  chartType = 'slope',
  chartData: externalChartData,
  isLoading: externalLoading,
}) => {
  const { setDrivePosition, drivePositions } = usePlayhead();
  const chartRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; sclk: number | null; value: number | null } | null>(null);
  const [tooltipPoint, setTooltipPoint] = useState<{ sclk: number | null; value: number | null } | null>(null);
  const { showToast } = useToast();

  // Close context menu on outside click or Escape
  useEffect(() => {
    if (!contextMenu) return;
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(target)) {
        setContextMenu(null);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKey);
    };
  }, [contextMenu]);

  // Use external loading state, default to false if not provided
  const isLoading = externalLoading ?? false;

  // Memoize the chart data - this only changes when data or chart type changes
  const chartData = useMemo(() => {
    if (!externalChartData?.data) return [];

    const data = externalChartData.data;
    const driveStartSclk = typeof data[0]?.sclk === 'number' && isFinite(data[0].sclk) ? data[0].sclk : 0;

    const mapped = data.map((item: any) => {
      const s = typeof item.sclk === 'number' && isFinite(item.sclk) ? item.sclk : null;
      const dataPoint: any = {
        sclk: s,
        value: item.value,
        driveTime: s !== null ? s - driveStartSclk : 0,
      };

      // For terrain charts, preserve the terrain value for the TerrainChart component
      if (chartType === 'terrain') {
        dataPoint.terrain = item.value;
      }

      return dataPoint;
    });
    return mapped;
  }, [externalChartData, chartType]);

  // All chart lines use the same slate blue (CHART_COLORS[0]) regardless of
  // parameter type, for visual consistency across the panel.
  const chartColor = DRIVE_PRESENTATION.COLORS.CHART_COLORS[0];

  // Throttled playhead updater like combined chart
  const setDrivePositionCallback = useCallback(
    (normalized: number) => setDrivePosition(driveId, normalized),
    [setDrivePosition, driveId]
  );

  const scheduleSetDrivePosition = useThrottledCallback(setDrivePositionCallback);

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



  if (isLoading) {
    return <div className="h-full flex items-center justify-center text-gray-500">Loading...</div>;
  }

  return (
    <div
      className="h-full w-full relative"
      ref={chartRef}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onContextMenu={(e) => {
        e.preventDefault();
        if (!chartRef.current) return;
        const rect = chartRef.current.getBoundingClientRect();
        // If no tooltipPoint yet, compute a nearest fallback by x-offset
        let sclk = tooltipPoint?.sclk ?? null;
        let value = tooltipPoint?.value ?? null;
        if ((sclk === null || value === null) && (e as any).nativeEvent) {
          try {
            const svg = chartRef.current.querySelector('svg');
            if (svg && (svg as any).__data) {
              // Best-effort: skip; Recharts doesn't expose internals cleanly.
            }
          } catch { /* noop */ }
        }
        setContextMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top, sclk, value });
      }}
    >
      {/* Render terrain chart or regular chart based on type */}
      {chartType === 'terrain' ? (
        <TerrainChart data={chartData} />
      ) : (
        <StaticChart
          data={chartData}
          chartType={chartType}
          color={chartColor}
          isDragging={isDragging}
          onHoverNormalized={scheduleSetDrivePosition}
          onHoverPoint={setTooltipPoint}
        />
      )}

      {/* Overlay reference line aligned to chart plot bounds (left ~50px, right 16px).
          The handle dot stays visible during drag so the playhead always reads as a
          timeline scrubber; the line itself is hidden while dragging because Recharts
          renders its own tooltip cursor line at the same position. */}
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

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          className="absolute bg-white border border-gray-300 shadow-lg rounded text-sm z-[100001]"
          style={{ left: contextMenu.x, top: contextMenu.y, minWidth: 160 }}
        >
          {(() => {
            const copyText = async (text: string) => {
              try {
                if (navigator.clipboard && window.isSecureContext) {
                  await navigator.clipboard.writeText(text);
                } else {
                  const textarea = document.createElement('textarea');
                  textarea.value = text;
                  textarea.style.position = 'fixed';
                  textarea.style.left = '-9999px';
                  document.body.appendChild(textarea);
                  textarea.focus();
                  textarea.select();
                  document.execCommand('copy');
                  document.body.removeChild(textarea);
                }
                showToast('Copied to clipboard', 'success');
              } catch {
                showToast('Failed to copy', 'error');
              } finally {
                setContextMenu(null);
              }
            };
            return (
              <>
                <button
                  className="w-full text-left px-3 py-2 hover:bg-gray-100"
                  onClick={() => {
                    if (contextMenu.sclk !== null) {
                      copyText(String(contextMenu.sclk));
                    } else {
                      showToast('No data at cursor', 'info');
                      setContextMenu(null);
                    }
                  }}
                >
                  Copy sclk
                </button>
                <button
                  className="w-full text-left px-3 py-2 hover:bg-gray-100"
                  onClick={() => {
                    if (contextMenu.value !== null) {
                      copyText(String(contextMenu.value));
                    } else {
                      showToast('No data at cursor', 'info');
                      setContextMenu(null);
                    }
                  }}
                >
                  Copy value
                </button>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
};

// Export the memoized component with display name
export const DriveMetricsChart = React.memo(DriveMetricsChartComponent);
DriveMetricsChart.displayName = 'DriveMetricsChart';
