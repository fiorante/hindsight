import React, { useState, useEffect, useRef } from 'react'
import { DriveMetricsChart } from './DriveMetricsChart'
import { DriveMetricsCombinedChart } from './DriveMetricsCombinedChart'
import { ParameterSelector } from '../ui/ParameterSelector'

import { useMultipleTelemetry } from '../../hooks/useTelemetry'
import { useSolData } from '../../hooks/useSol'
import { Grid2X2, Columns2, Plus, X } from 'lucide-react'
import { sanitizeInitialParameters } from '../../utils/chartParameters'
import { getParameterUnitLabel } from '../../constants/parameters'
import { useAppStore } from '../../state/store'
import { useSyncedPanelScroll } from '../../hooks/useSyncedPanelScroll'
import type { FaultRecord } from '../../types'

interface DriveChartViewProps {
  driveId: string
  sol: number
  initialParameters?: string[] // Parameters from search filters
  faults?: FaultRecord[]
  faultOverlayEnabled?: boolean
}

interface ChartConfig {
  parameter: string
  displayName: string
  unit?: string
}

export const DriveChartView: React.FC<DriveChartViewProps> = ({
  driveId,
  sol,
  initialParameters = [],
  faults = [],
  faultOverlayEnabled = false
}) => {
  const [combinedMode, setCombinedMode] = useState(false);
  const [parameterSelectorOpen, setParameterSelectorOpen] = useState(false);
  const [hoveredFault, setHoveredFault] = useState<{ fault: FaultRecord; position: { x: number; y: number } } | null>(null);
  const [parameterSelectorPosition, setParameterSelectorPosition] = useState({
    top: 0,
    left: 0,
  });

  // Ref for the scrollable container
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Get chart state from store
  const {
    activeCharts,
    setActiveCharts,
    addChart,
    removeChart,
    selectedDrives
  } = useAppStore();
  const syncDrivePanels = useAppStore((s) => s.syncDrivePanels);
  const { onScroll: onSyncScroll } = useSyncedPanelScroll('charts', syncDrivePanels, scrollContainerRef);

  const { telemetryData, loadingStates, errors, fetchTelemetry, removeTelemetry } = useMultipleTelemetry(sol);
  const { data: solData } = useSolData(parseInt(driveId), !!driveId);

  // Initialize charts based on number of open panels
  useEffect(() => {
    const openPanelCount = selectedDrives.length;

    if (openPanelCount === 0) {
      // No panels open - clear charts
      setActiveCharts([]);
      return;
    }

    if (openPanelCount === 1 && activeCharts.length === 0) {
      // First panel opening - use initial parameters
      const sanitized = sanitizeInitialParameters(initialParameters)
      if (sanitized.length > 0) {
        setActiveCharts(sanitized)

        // Fetch data for initial charts
        sanitized.forEach((param) => {
          fetchTelemetry(param)
        })
      }
      // If no initial parameters provided, show empty state (no charts will be set)
    }
    // If multiple panels are open or charts already exist, use the existing charts from store (no action needed)
  }, [initialParameters, activeCharts.length, selectedDrives.length, setActiveCharts, fetchTelemetry])

  // Fetch data for any charts that are in the store but not yet loaded
  useEffect(() => {
    activeCharts.forEach((parameter) => {
      // Only fetch if we don't have data for this parameter yet
      if (!telemetryData[parameter] && !loadingStates[parameter]) {
        fetchTelemetry(parameter);
      }
    });
  }, [activeCharts, telemetryData, loadingStates, fetchTelemetry]);

  // Auto-scroll to bottom when a new chart is added
  useEffect(() => {
    if (scrollContainerRef.current && activeCharts.length > 0) {
      // Use requestAnimationFrame to ensure the DOM has updated
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        }
      });
    }
  }, [activeCharts.length]); // Only trigger when the number of charts changes

  // Convert activeCharts strings to ChartConfig objects
  const chartConfigs: ChartConfig[] = activeCharts.map((param) => ({
    parameter: param,
    displayName: param,
    unit: getParameterUnitLabel(param),
  }));

  const handleAddChart = (event: React.MouseEvent) => {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    setParameterSelectorPosition({
      top: rect.top,
      left: rect.right + 8,
    });
    setParameterSelectorOpen(true);
  };

  const handleParameterSelect = (parameter: string) => {
    // Check if chart already exists
    if (activeCharts.includes(parameter)) {
      setParameterSelectorOpen(false);
      return;
    }

    addChart(parameter);
    setParameterSelectorOpen(false);
  };

  const handleRemoveChart = (parameter: string) => {
    removeChart(parameter);
    removeTelemetry(parameter);
  };

  const handleParameterValueSelect = (parameter: string, _min: string, _max: string) => {
    // For chart view, we don't need min/max values, just treat as parameter select
    handleParameterSelect(parameter);
  };

  // Render individual chart
  const renderChart = (chart: ChartConfig) => (
    <div
      key={chart.parameter}
      className="bg-white dark:bg-stellar-dark-surface shadow-sm rounded-lg overflow-hidden"
      style={{ height: '250px' }}
    >
      <div className="h-full flex flex-col pl-0 pr-3 pt-3 pb-3">
        <div className="text-xs text-gray-500 dark:text-stellar-dark-text-secondary mb-2 flex-shrink-0 flex items-center justify-between pl-3">
          <span className="uppercase">
            {chart.displayName}
            {chart.unit && <span className="ml-1 normal-case">({chart.unit})</span>}
          </span>
          {errors[chart.parameter] && (
            <span className="text-red-500 text-xs">
              Error: {errors[chart.parameter]}
            </span>
          )}
        </div>
        <div className="flex-1 min-h-0 relative">
          <DriveMetricsChart
            driveId={driveId}
            chartType={chart.parameter}
            chartData={telemetryData[chart.parameter]}
            isLoading={loadingStates[chart.parameter]}
          />
          {/* Fault overlay */}
          {faultOverlayEnabled && faults.length > 0 && solData && (
            <div className="absolute bottom-0 left-0 right-0 h-6 pl-[50px] pr-4">
              <div className="relative w-full h-full">
                {faults.map((fault, index) => {
                  // Calculate position based on drive's SCLK range
                  const startSclk = solData.start_sclk;
                  const endSclk = solData.end_sclk;
                  const durSclk = Math.max(1, endSclk - startSclk);
                  const position = Math.max(0, Math.min(1, (fault.sclk - startSclk) / durSclk));

                  return (
                    <div
                      key={`fault-${index}`}
                      className="absolute w-3 h-3 bg-stellar-fault-red rounded-full transform -translate-x-1/2 cursor-pointer"
                      style={{
                        left: `${position * 100}%`,
                        top: '50%',
                        transform: 'translate(-50%, -50%)'
                      }}
                      onMouseEnter={(e) => {
                        const rect = e.currentTarget.getBoundingClientRect();
                        setHoveredFault({
                          fault,
                          position: { x: rect.left + rect.width / 2, y: rect.top }
                        });
                      }}
                      onMouseLeave={() => setHoveredFault(null)}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Render combined chart
  const renderCombinedChart = () => (
    <div className="p-2">
      <div className="bg-white dark:bg-stellar-dark-surface shadow-sm rounded-lg overflow-hidden" style={{ height: '300px' }}>
        <div className="h-full flex flex-col p-3">
          <div className="text-xs text-gray-500 dark:text-stellar-dark-text-secondary mb-2 flex-shrink-0">
            Combined Charts ({chartConfigs.map(c => c.displayName).join(', ')})
          </div>
          <div className="flex-1 min-h-0">
            <DriveMetricsCombinedChart
              driveId={driveId}
              chartTypes={chartConfigs.map(c => c.parameter)}
              chartsData={telemetryData}
            />
          </div>
        </div>
      </div>
    </div>
  );

  // Render no charts message
  const renderNoCharts = () => (
    <div className="h-full flex items-center justify-center text-gray-500 dark:text-stellar-dark-text-secondary">
      <div className="text-center">
        <div className="text-lg mb-2">No charts selected</div>
        <button
          onClick={handleAddChart}
          className="flex items-center gap-2 px-4 py-2 bg-stellar-cta dark:bg-stellar-cta text-black dark:text-black rounded hover:bg-stellar-dark-text-secondary dark:hover:bg-stellar-dark-text-secondary mx-auto"
        >
          <Plus className="h-4 w-4" />
          Add your first chart
        </button>
      </div>
    </div>
  );

  // Render charts content
  const renderChartsContent = () => {
    if (chartConfigs.length === 0) {
      return renderNoCharts();
    }

    if (combinedMode) {
      return renderCombinedChart();
    }

    return (
      <div className="px-0 py-2 space-y-3">
        {chartConfigs.map(renderChart)}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-stellar-dark-surface">
      {/* Chart management header - fixed at top */}
      <div className="flex items-center justify-between p-3 border-b dark:border-stellar-dark-border bg-gray-100 dark:bg-stellar-dark-surface-elevated flex-shrink-0">
        <div className="flex flex-wrap gap-2 items-center">
          {/* Active chart chips */}
          {chartConfigs.map((chart) => (
            <div
              key={chart.parameter}
              className="bg-white dark:bg-stellar-dark-surface rounded-full px-3 py-1 flex items-center gap-1 shadow-sm text-xs text-gray-800 dark:text-stellar-dark-text-primary"
            >
              <span className="uppercase">{chart.displayName}</span>
              {loadingStates[chart.parameter] && (
                <div className="w-3 h-3 border border-gray-300 dark:border-stellar-dark-border border-t-transparent rounded-full animate-spin" />
              )}
              <button
                onClick={() => handleRemoveChart(chart.parameter)}
                className="ml-1 hover:bg-gray-100 dark:hover:bg-stellar-dark-surface-elevated rounded-full p-0.5"
                title="Remove chart"
              >
                <X className="h-3 w-3 text-gray-400 dark:text-stellar-dark-text-secondary hover:text-gray-600 dark:hover:text-stellar-dark-text-primary" />
              </button>
            </div>
          ))}

          {/* Add chart button */}
          <button
            onClick={handleAddChart}
            className="bg-white dark:bg-stellar-dark-surface rounded-full px-3 py-1 flex items-center gap-1 shadow-sm text-xs text-gray-800 dark:text-stellar-dark-text-primary hover:bg-gray-50 dark:hover:bg-stellar-dark-surface-elevated"
            title="Add chart"
          >
            <Plus className="h-3 w-3 text-gray-600 dark:text-stellar-dark-text-secondary" />
            Add Chart
          </button>
        </div>

        {/* Combined/Individual mode toggle */}
        {chartConfigs.length > 1 && (
          <div className="flex items-center gap-1 ml-4">
            <button
              className={`p-1 rounded ${!combinedMode ? 'bg-stellar-cta dark:bg-stellar-cta text-black dark:text-black' : 'bg-gray-200 dark:bg-stellar-dark-surface text-gray-700 dark:text-stellar-dark-text-primary'}`}
              onClick={() => setCombinedMode(false)}
              title="Individual charts"
            >
              <Grid2X2 className="h-4 w-4" />
            </button>
            <button
              className={`p-1 rounded ${combinedMode ? 'bg-stellar-cta dark:bg-stellar-cta text-black dark:text-black' : 'bg-gray-200 dark:bg-stellar-dark-surface text-gray-700 dark:text-stellar-dark-text-primary'}`}
              onClick={() => setCombinedMode(true)}
              title="Combined chart"
            >
              <Columns2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Charts - scrollable container */}
      <div className="flex-1 overflow-y-auto min-h-0 min-w-0" ref={scrollContainerRef} onScroll={onSyncScroll}>
        {renderChartsContent()}
      </div>

      {/* Parameter Selector */}
      <ParameterSelector
        isOpen={parameterSelectorOpen}
        onClose={() => setParameterSelectorOpen(false)}
        onSelectParameter={handleParameterSelect}
        onSelectParameterValue={handleParameterValueSelect}
        mode="parameter-only"
        position={parameterSelectorPosition}
        hideDriveCategory={true}
      />

      {/* Custom fault tooltip */}
      {hoveredFault && (
        <div
          className="fixed bg-black bg-opacity-75 text-white px-2 py-1 rounded text-xs pointer-events-none z-50"
          style={{
            left: hoveredFault.position.x,
            top: hoveredFault.position.y,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="font-semibold">{hoveredFault.fault.fault_type}</div>
          <div className="text-xs opacity-90">SCLK: {hoveredFault.fault.sclk}</div>
        </div>
      )}
    </div>
  );
};