import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { PDICameraSet, SolVCE, FaultRecord } from '../../types';
import { ImageModal } from '../map/ImageModal';
import { usePDI, useVCE } from '../../hooks/useImages';
import { imageRepository } from '../../api/repositories/imageRepository';
import { usePlayhead } from '../providers/TimelinePlayheadProvider';
import { useThrottledCallback } from '../../hooks/useThrottledCallback';
import { useToast } from '../ui/Toast';
import { useAppStore } from '../../state/store';
import { useSyncedPanelScroll } from '../../hooks/useSyncedPanelScroll';

interface DriveImageryViewProps {
  driveId: string;
  faults?: FaultRecord[];
  faultOverlayEnabled?: boolean;
}

const SectionHeader: React.FC<{ title: string; right?: React.ReactNode }> = ({ title, right }) => (
  <div
    className="-mx-2 px-4 py-2 uppercase tracking-wide flex items-center justify-between text-gray-900 dark:text-stellar-dark-text-primary bg-slate-50 dark:bg-stellar-dark-surface-elevated"
    style={{ fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial', fontSize: 12 }}
  >
    <span>{title}</span>
    {right ? <div className="ml-2">{right}</div> : null}
  </div>
);

const SideSelector: React.FC<{ value: 'left' | 'both' | 'right'; onChange: (v: 'left' | 'both' | 'right') => void }> = ({ value, onChange }) => {
  const base = 'px-2 py-[2px] text-[10px] rounded-full';
  const active = 'bg-gray-900 dark:bg-stellar-cta text-white dark:text-black';
  const inactive = 'bg-gray-100 dark:bg-stellar-dark-surface text-gray-700 dark:text-stellar-dark-text-primary hover:bg-gray-200 dark:hover:bg-stellar-dark-surface-elevated';
  return (
    <div className="inline-flex items-center gap-1 border border-gray-200 dark:border-stellar-dark-border rounded-full p-0.5 bg-white dark:bg-stellar-dark-surface">
      <button className={`${base} ${value === 'left' ? active : inactive}`} onClick={() => onChange('left')}>left</button>
      <button className={`${base} ${value === 'both' ? active : inactive}`} onClick={() => onChange('both')}>both</button>
      <button className={`${base} ${value === 'right' ? active : inactive}`} onClick={() => onChange('right')}>right</button>
    </div>
  );
};

const VCEImageViewer: React.FC<{ vceData: SolVCE; driveId: string; onImageClick: (image: { filename: string; sclk?: number; source: 'vce' }) => void; }> = ({ vceData, driveId, onImageClick }) => {
  const { drivePositions } = usePlayhead();
  const drivePosition = drivePositions[driveId] ?? null;
  const vceMode = useAppStore((s) => s.vceImageSideMode);

  const currentVCEImage = useMemo(() => {
    if (!vceData.images || vceData.images.length === 0 || drivePosition === null) return null;
    const sortedImages = [...vceData.images].sort((a, b) => a.sclk - b.sclk);
    const startSclk = sortedImages[0].sclk;
    const endSclk = sortedImages[sortedImages.length - 1].sclk;
    const totalDuration = endSclk - startSclk;
    const currentSclk = startSclk + (drivePosition * totalDuration);
    let selectedImage = null as null | typeof sortedImages[0];
    for (let i = sortedImages.length - 1; i >= 0; i--) {
      if (sortedImages[i].sclk <= currentSclk) { selectedImage = sortedImages[i]; break; }
    }
    return selectedImage || sortedImages[0];
  }, [vceData.images, drivePosition, driveId]);

  // Current index no longer needed for timeline styling

  if (!currentVCEImage) {
    return <div className="text-center py-6 text-gray-500 dark:text-stellar-dark-text-secondary text-sm">No VCE imagery available</div>;
  }

  const handleExpand = () => {
    const fname = currentVCEImage.left_filename ?? currentVCEImage.right_filename;
    if (!fname) return;
    onImageClick({ filename: fname, sclk: currentVCEImage.sclk, source: 'vce' });
  };

  return (
    <div className="">
      <div className="flex gap-4">
        {(vceMode === 'left' || vceMode === 'both') && (
          <div className="flex-1">
            {currentVCEImage.left_filename ? (
              <div className="relative w-full rounded overflow-hidden">
                <img src={imageRepository.getVCEImageUrl(currentVCEImage.left_filename)} alt="VCE Left" className="w-full h-auto object-contain" />
                <button onClick={handleExpand} className="absolute top-2 right-2 bg-black bg-opacity-60 text-white rounded w-7 h-7 flex items-center justify-center hover:bg-opacity-80 transition-colors cursor-pointer" title="Expand image">⤢</button>
              </div>
            ) : (
              <div className="w-full h-64 bg-gray-100 dark:bg-stellar-dark-surface rounded flex items-center justify-center text-xs text-gray-400 dark:text-stellar-dark-text-secondary">No left image</div>
            )}
          </div>
        )}
        {(vceMode === 'right' || vceMode === 'both') && (
          <div className="flex-1">
            {currentVCEImage.right_filename ? (
              <div className="relative w-full rounded overflow-hidden">
                <img src={imageRepository.getVCEImageUrl(currentVCEImage.right_filename)} alt="VCE Right" className="w-full h-auto object-contain" />
                <button onClick={handleExpand} className="absolute top-2 right-2 bg-black bg-opacity-60 text-white rounded w-7 h-7 flex items-center justify-center hover:bg-opacity-80 transition-colors cursor-pointer" title="Expand image">⤢</button>
              </div>
            ) : (
              <div className="w-full h-64 bg-gray-100 dark:bg-stellar-dark-surface rounded flex items-center justify-center text-xs text-gray-400 dark:text-stellar-dark-text-secondary">No right image</div>
            )}
          </div>
        )}
      </div>
      <div className="text-xs text-gray-500 dark:text-stellar-dark-text-secondary mt-2">SCLK: {currentVCEImage.sclk}</div>
    </div>
  );
};

const VCETimeline: React.FC<{
  vceData: SolVCE;
  driveId: string;
  faults?: FaultRecord[];
  faultOverlayEnabled?: boolean;
}> = ({ vceData, driveId, faults = [], faultOverlayEnabled = false }) => {
  const [hoveredFault, setHoveredFault] = useState<{ fault: FaultRecord; position: { x: number; y: number } } | null>(null);
  const { setDrivePosition, drivePositions } = usePlayhead();
  const timelineRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  const scheduleSetDrivePosition = useThrottledCallback((normalized: number) => setDrivePosition(driveId, normalized));

  const timelineData = useMemo(() => {
    if (!vceData.images || vceData.images.length === 0) return [] as Array<{ sclk: number; position: number; left?: string; right?: string }>;
    const sorted = [...vceData.images].sort((a, b) => a.sclk - b.sclk);
    const start = sorted[0].sclk;
    const end = sorted[sorted.length - 1].sclk;
    const dur = end - start || 1;
    return sorted.map(img => ({ sclk: img.sclk, position: (img.sclk - start) / dur, left: img.left_filename, right: img.right_filename }));
  }, [vceData.images]);

  const [isHovering, setIsHovering] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return; // Only update during drag
    if (timelineRef.current && vceData.images && vceData.images.length > 0) {
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const clampedX = Math.max(0, Math.min(rect.width, x));
      const normalized = rect.width > 0 ? Math.max(0, Math.min(1, clampedX / rect.width)) : 0;
      scheduleSetDrivePosition(normalized);
      setIsHovering(true);
    }
  }, [isDragging, scheduleSetDrivePosition, vceData.images]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    setIsHovering(true);

    // Update playhead immediately on click
    if (timelineRef.current && vceData.images && vceData.images.length > 0) {
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const clampedX = Math.max(0, Math.min(rect.width, x));
      const normalized = rect.width > 0 ? Math.max(0, Math.min(1, clampedX / rect.width)) : 0;
      scheduleSetDrivePosition(normalized);
    }
  }, [scheduleSetDrivePosition, vceData.images]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false);
    // Don't stop dragging when mouse leaves - let global handlers continue
  }, []);

  // Add global mouse event listeners for drag
  React.useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseUp = () => {
        setIsDragging(false);
        setIsHovering(false);
      };
      const handleGlobalMouseMove = (e: MouseEvent) => {
        if (timelineRef.current && vceData.images && vceData.images.length > 0) {
          const rect = timelineRef.current.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const clampedX = Math.max(0, Math.min(rect.width, x));
          const normalized = rect.width > 0 ? Math.max(0, Math.min(1, clampedX / rect.width)) : 0;
          scheduleSetDrivePosition(normalized);
        }
      };

      document.addEventListener('mouseup', handleGlobalMouseUp);
      document.addEventListener('mousemove', handleGlobalMouseMove);
      return () => {
        document.removeEventListener('mouseup', handleGlobalMouseUp);
        document.removeEventListener('mousemove', handleGlobalMouseMove);
      };
    }
  }, [isDragging, scheduleSetDrivePosition, vceData.images]);

  // Prevent text selection during dragging
  React.useEffect(() => {
    if (isDragging) {
      // Store original user-select style
      const originalUserSelect = document.body.style.userSelect;
      const originalWebkitUserSelect = (document.body.style as any).webkitUserSelect;

      // Disable text selection
      document.body.style.userSelect = 'none';
      (document.body.style as any).webkitUserSelect = 'none';

      return () => {
        // Restore original user-select style
        document.body.style.userSelect = originalUserSelect;
        (document.body.style as any).webkitUserSelect = originalWebkitUserSelect;
      };
    }
  }, [isDragging]);

  const copyText = useCallback(async (text: string) => {
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
      showToast('Copied SCLK to clipboard', 'success');
    } catch {
      showToast('Failed to copy', 'error');
    }
  }, [showToast]);

  // Visual constants
  const TIMELINE_TOP_PX = 10;
  const TICK_HEIGHT_PX = 14;
  // The playhead line is short while idle (just past the tick row) and extends
  // fully while the user is dragging it, so the active state is more discoverable.
  const PLAYHEAD_HEIGHT_IDLE_PX = 18;
  const PLAYHEAD_HEIGHT_DRAGGING_PX = 36;
  const playheadHeightPx = isDragging ? PLAYHEAD_HEIGHT_DRAGGING_PX : PLAYHEAD_HEIGHT_IDLE_PX;
  const LINE_COLOR = '#a4a4a4';

  // Compute playhead and sclk for tooltip
  const playheadNormalized = Math.max(0, Math.min(1, drivePositions?.[driveId] ?? 0));
  const sortedForCalc = useMemo(() => (vceData.images ? [...vceData.images].sort((a, b) => a.sclk - b.sclk) : []), [vceData.images]);
  const startSclk = sortedForCalc[0]?.sclk ?? 0;
  const endSclk = sortedForCalc[sortedForCalc.length - 1]?.sclk ?? startSclk;
  const durSclk = Math.max(1, endSclk - startSclk);
  const tooltipSclk = Math.round(startSclk + playheadNormalized * durSclk);

  // The bottom of the timeline reserves space for the SCLK tooltip that appears
  // while dragging. When idle that space is unused, so collapse the container so
  // the surrounding UI tightens up.
  const showTooltipSpace = isDragging || isHovering;

  return (
    <div className="w-full">
      <div
        className={`relative transition-[height] duration-150 ${showTooltipSpace ? 'h-16' : 'h-[30px]'} ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        ref={timelineRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onContextMenu={(e) => {
          e.preventDefault();
          if (!timelineRef.current || !vceData.images || vceData.images.length === 0) return;
          const rect = timelineRef.current.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const clampedX = Math.max(0, Math.min(rect.width, x));
          const normalized = rect.width > 0 ? Math.max(0, Math.min(1, clampedX / rect.width)) : 0;
          const sorted = [...vceData.images].sort((a, b) => a.sclk - b.sclk);
          const start = sorted[0].sclk;
          const end = sorted[sorted.length - 1].sclk;
          const dur = end - start || 1;
          const sclk = Math.round(start + normalized * dur);
          copyText(String(sclk));
        }}
      >
        {/* baseline */}
        <div className="absolute left-0 right-0" style={{ top: TIMELINE_TOP_PX, height: 1, backgroundColor: LINE_COLOR }} />
        {/* vertical ticks */}
        {timelineData.map((img, idx) => (
          <div
            key={idx}
            className="absolute"
            style={{
              left: `${img.position * 100}%`,
              top: TIMELINE_TOP_PX,
              width: 1,
              height: TICK_HEIGHT_PX,
              backgroundColor: LINE_COLOR,
              transform: 'translateX(-50%)'
            }}
            title={`SCLK: ${img.sclk}`}
          />
        ))}
        {/* playhead */}
        <PlayheadLine driveId={driveId} offsetTop={TIMELINE_TOP_PX} heightPx={playheadHeightPx} />

        {/* fault overlay */}
        {faultOverlayEnabled && faults.length > 0 && (
          <>
            {faults.map((fault, index) => {
              // Calculate position based on SCLK
              const sortedForCalc = [...vceData.images].sort((a, b) => a.sclk - b.sclk);
              const startSclk = sortedForCalc[0]?.sclk ?? 0;
              const endSclk = sortedForCalc[sortedForCalc.length - 1]?.sclk ?? startSclk;
              const durSclk = Math.max(1, endSclk - startSclk);
              const position = Math.max(0, Math.min(1, (fault.sclk - startSclk) / durSclk));

              return (
                <div
                  key={`fault-${index}`}
                  className="absolute w-3 h-3 bg-stellar-fault-red rounded-full transform -translate-x-1/2 -translate-y-1/2 cursor-pointer"
                  style={{
                    left: `${position * 100}%`,
                    top: TIMELINE_TOP_PX - 10, // Position above the timeline line
                    zIndex: 10
                  }}
                  onMouseEnter={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setHoveredFault({
                      fault,
                      position: { x: rect.left + rect.width / 2, y: rect.top }
                    });
                  }}
                  onMouseLeave={() => setHoveredFault(null)}
                  onClick={() => {
                    // Move playhead to fault's SCLK timestamp when clicked
                    if (vceData.images && vceData.images.length > 0 && fault.sclk) {
                      const sortedForCalc = [...vceData.images].sort((a, b) => a.sclk - b.sclk);
                      const startSclk = sortedForCalc[0]?.sclk ?? 0;
                      const endSclk = sortedForCalc[sortedForCalc.length - 1]?.sclk ?? startSclk;
                      const durSclk = Math.max(1, endSclk - startSclk);

                      if (durSclk > 0) {
                        // Calculate normalized position (0-1) based on fault's SCLK
                        const normalized = Math.max(0, Math.min(1, (fault.sclk - startSclk) / durSclk));
                        scheduleSetDrivePosition(normalized);
                      }
                    }
                  }}
                />
              );
            })}
          </>
        )}
        {/* tooltip anchored to playhead bottom, shown on hover */}
        {isHovering && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: `${playheadNormalized * 100}%`,
              top: TIMELINE_TOP_PX + playheadHeightPx,
              transform: playheadNormalized > 0.7 ? 'translateX(-100%)' : 'translateX(6px)'
            }}
          >
            <div className="text-xs font-semibold font-mono text-white whitespace-nowrap select-none" style={{ transform: 'translateY(-100%)' }}>
              SCLK {tooltipSclk}
            </div>
          </div>
        )}
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
    </div>
  );
};

const PlayheadLine: React.FC<{ driveId: string; offsetTop?: number; heightPx?: number }> = ({ driveId, offsetTop = 0, heightPx }) => {
  const { drivePositions } = usePlayhead();
  const drivePosition = drivePositions[driveId] ?? null;
  if (drivePosition === null) return null;
  const style: React.CSSProperties = {
    left: `${drivePosition * 100}%`,
    transform: 'translateX(-50%)',
    top: offsetTop,
    height: heightPx ?? undefined,
  };
  return (
    <div className="absolute pointer-events-none" style={style}>
      <div className="absolute left-1/2 -translate-x-1/2 w-[2px] h-full bg-white" />
      {/* Playhead handle dot at the top of the line */}
      <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white" />
    </div>
  );
};

export const DriveImageryView: React.FC<DriveImageryViewProps> = ({ driveId, faults = [], faultOverlayEnabled = false }) => {
  const { data: pdi, isLoading: pdiLoading, error: pdiError } = usePDI(parseInt(driveId));
  const [imageModal, setImageModal] = useState<{ open: boolean; image: { filename: string; sclk?: number; source: 'vce' | 'pdi' } | null }>({ open: false, image: null });

  const { data: vceData, isLoading: vceLoading, error: vceError } = useVCE(parseInt(driveId));
  const { setDrivePosition, drivePositions } = usePlayhead();
  const vceMode = useAppStore((s) => s.vceImageSideMode);
  const setVceMode = useAppStore((s) => s.setVceImageSideMode);
  const pdiMode = useAppStore((s) => s.pdiImageSideMode);
  const setPdiMode = useAppStore((s) => s.setPdiImageSideMode);
  const syncDrivePanels = useAppStore((s) => s.syncDrivePanels);
  const { ref: imageryScrollRef, onScroll: onImageryScroll } = useSyncedPanelScroll('imagery', syncDrivePanels);

  useEffect(() => {
    if (vceData && vceData.images && vceData.images.length > 0) {
      const currentPosition = drivePositions[driveId];
      if (currentPosition === null || currentPosition === undefined) {
        setDrivePosition(driveId, 0);
      }
    }
  }, [vceData, driveId, setDrivePosition, drivePositions]);

  const openImageModal = (image: { filename?: string; sclk?: number; source: 'vce' | 'pdi' }) => {
    if (!image.filename) return;
    setImageModal({ open: true, image: { filename: image.filename, sclk: image.sclk, source: image.source } });
  };

  const closeImageModal = () => setImageModal({ open: false, image: null });

  if (pdiLoading || vceLoading) {
    return <div className="h-full flex items-center justify-center"><div className="text-gray-500 dark:text-stellar-dark-text-secondary">Loading imagery...</div></div>;
  }
  if (pdiError && vceError) {
    return <div className="h-full flex items-center justify-center"><div className="text-gray-500 dark:text-stellar-dark-text-secondary">No imagery available for this drive</div></div>;
  }

  return (
    <div ref={imageryScrollRef} onScroll={onImageryScroll} className="p-2 overflow-y-auto h-full space-y-3 bg-white dark:bg-stellar-dark-surface">
      {/* VCE Section */}
      <SectionHeader
        title={`Visual Compute Elements (${vceData?.images?.length ?? 0})`}
        right={<SideSelector value={vceMode} onChange={setVceMode} />}
      />
      {vceError ? (
        <div className="text-center py-6 text-gray-500 dark:text-stellar-dark-text-secondary text-sm">No VCE imagery available for this drive</div>
      ) : vceData ? (
        <div className="">
          <VCETimeline
            vceData={vceData}
            driveId={driveId}
            faults={faults}
            faultOverlayEnabled={faultOverlayEnabled}
          />
          <VCEImageViewer vceData={vceData} driveId={driveId} onImageClick={(img) => openImageModal(img)} />
        </div>
      ) : (
        <div className="text-center py-6 text-gray-500 dark:text-stellar-dark-text-secondary text-sm">Loading VCE data...</div>
      )}

      {/* PDI Section */}
      <SectionHeader title="Post Drive Imagery" right={<SideSelector value={pdiMode} onChange={setPdiMode} />} />
      {pdiError ? (
        <div className="text-center py-6 text-gray-500 dark:text-stellar-dark-text-secondary text-sm">No PDI imagery available for this drive</div>
      ) : pdi ? (
        <div className="space-y-3">
          {(['fhaz', 'rhaz', 'ncam'] as const).map((key) => {
            const set: PDICameraSet = (pdi as any)[key];
            if (!set) return null;
            const sclk = set.left?.sclk || set.right?.sclk;
            const left = set.left?.filename;
            const right = set.right?.filename;
            return (
              <div key={key} className="w-full">
                <div className="text-xs font-medium text-gray-700 dark:text-stellar-dark-text-primary mb-2">{set.description}{sclk && <span className="text-gray-500 dark:text-stellar-dark-text-secondary ml-1"> (SCLK: {sclk})</span>}</div>
                <div className="flex gap-2">
                  {(pdiMode === 'left' || pdiMode === 'both') && (
                    <div className="flex-1 relative">
                      {left ? (
                        <>
                          <img src={imageRepository.getPDIImageUrl(left)} alt="Left" className="w-full h-auto object-contain border rounded" />
                          <button onClick={() => openImageModal({ filename: left, sclk: set.left?.sclk, source: 'pdi' })} className="absolute top-2 right-2 bg-black bg-opacity-60 text-white rounded w-7 h-7 flex items-center justify-center hover:bg-opacity-80 transition-colors cursor-pointer" title="Expand image">⤢</button>
                        </>
                      ) : (
                        <div className="w-full h-48 bg-gray-100 dark:bg-stellar-dark-surface border dark:border-stellar-dark-border rounded flex items-center justify-center text-xs text-gray-400 dark:text-stellar-dark-text-secondary">No left image</div>
                      )}
                    </div>
                  )}
                  {(pdiMode === 'right' || pdiMode === 'both') && (
                    <div className="flex-1 relative">
                      {right ? (
                        <>
                          <img src={imageRepository.getPDIImageUrl(right)} alt="Right" className="w-full h-auto object-contain border rounded" />
                          <button onClick={() => openImageModal({ filename: right, sclk: set.right?.sclk, source: 'pdi' })} className="absolute top-2 right-2 bg-black bg-opacity-60 text-white rounded w-7 h-7 flex items-center justify-center hover:bg-opacity-80 transition-colors cursor-pointer" title="Expand image">⤢</button>
                        </>
                      ) : (
                        <div className="w-full h-48 bg-gray-100 dark:bg-stellar-dark-surface border dark:border-stellar-dark-border rounded flex items-center justify-center text-xs text-gray-400 dark:text-stellar-dark-text-secondary">No right image</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

        </div>
      ) : (
        <div className="text-center py-6 text-gray-500 dark:text-stellar-dark-text-secondary text-sm">Loading PDI data...</div>
      )}

      {/* Image Modal */}
      <ImageModal isOpen={imageModal.open} onClose={closeImageModal} sol={parseInt(driveId)} image={imageModal.image ? { filename: imageModal.image.filename, sclk: imageModal.image.sclk, description: imageModal.image.filename, source: imageModal.image.source } : null} />
    </div>
  );
};
