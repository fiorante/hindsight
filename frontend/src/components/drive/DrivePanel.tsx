import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { XIcon, ChevronDown, ChevronUp, Play, Pause, AlertTriangle } from 'lucide-react'
import { useDriveState } from '../providers/DriveStateProvider'
import { DriveMapView } from './DriveMapView'
import { DriveChartView } from './DriveChartView'
import { DriveEvrsView } from './DriveEvrsView'
import { DriveImageryView } from './DriveImageryView'
import 'golden-layout/dist/css/goldenlayout-base.css'
import 'golden-layout/dist/css/themes/goldenlayout-light-theme.css'
import { GoldenLayout } from 'golden-layout'
import { useAppStore } from '../../state/store'
import type { DriveLayoutStructure, LayoutItem, LayoutComponent, LayoutContainer } from '../../state/store'
import { usePlayhead } from '../providers/TimelinePlayheadProvider'
import { TimelineBar } from './TimelineBar'
import { useFaults } from '../../hooks/useFaults'
import { getSelectedDriveColor } from '../../constants/drivePresentation'

// Height of the drive-color identifier bar across the top of the panel.
// Matches SEARCH_RESULT_COLOR_BAR_WIDTH_PX in DriveResultView.tsx so the
// search-result row marker and the panel header marker read at the same weight.
const DRIVE_PANEL_COLOR_BAR_HEIGHT_PX = 6

// GoldenLayout's config schema is not exported from the library
type LayoutConfig = Record<string, any>

interface DrivePanelProps {
  driveId: string
  onClose?: () => void
}

export const DrivePanel: React.FC<DrivePanelProps> = ({
  driveId,
  onClose,
}) => {
  const driveState = useDriveState();
  const {
    drivePositions,
    setDrivePosition,
  } = usePlayhead();
  const containerRef = useRef<HTMLDivElement | null>(null)
  const glRef = useRef<any | null>(null)
  // Prevent feedback loops when applying/saving layout structures
  const isApplyingLayoutRef = useRef<boolean>(false)
  const lastSavedStructureRef = useRef<DriveLayoutStructure | null>(null)
  // Track when GL has fully initialised to avoid calling toConfig too early
  const glReadyRef = useRef<boolean>(false)
  // Debounce saving layout structure to wait for GL to stabilise after drags/splits
  const saveDebounceRef = useRef<number | null>(null)
  // Drag detection (fallback in case GL drag events are unreliable)
  const isDraggingRef = useRef<boolean>(false)

  const isDraggingNow = (): boolean => {
    if (isDraggingRef.current) return true
    // Heuristic: GoldenLayout uses these classes while dragging
    return Boolean(document.querySelector('.lm_dragProxy, .lm_dragging'))
  }
  const [portals, setPortals] = useState<Array<{ id: string; container: HTMLElement; node: React.ReactNode }>>([])
  const lastSearchParameters = useAppStore((s) => s.lastSearchParameters)
  const driveLayoutStructure = useAppStore((s) => s.driveLayoutStructure)
  const setDriveLayoutStructure = useAppStore((s) => s.setDriveLayoutStructure)
  // Store current search parameters in a ref to avoid re-rendering GoldenLayout
  const currentSearchParamsRef = useRef<string[]>([])
  // Sync toggle controls whether other panels should react to store updates
  const syncDrivePanels = useAppStore((s) => s.syncDrivePanels)
  // Global reset trigger nonce
  const resetNonce = useAppStore((s) => s.driveLayoutResetNonce)
  const timelineExpanded = useAppStore((s) => s.timelineExpanded)
  const setTimelineExpanded = useAppStore((s) => s.setTimelineExpanded)
  const faultOverlayEnabled = useAppStore((s) => s.faultOverlayEnabled)
  const setFaultOverlayEnabled = useAppStore((s) => s.setFaultOverlayEnabled)
  const clearCharts = useAppStore((s) => s.clearCharts)
  const selectedDrives = useAppStore((s) => s.selectedDrives)
  const drivePlayStates = useAppStore((s) => s.drivePlayStates)
  const setDrivePlayState = useAppStore((s) => s.setDrivePlayState)
  const isTimelinePlaying = drivePlayStates[driveId] ?? false
  const timelineSpeed = useAppStore((s) => s.timelineSpeed)
  const setTimelineSpeed = useAppStore((s) => s.setTimelineSpeed)
  const setHighlightedEvrIndex = useAppStore((s) => s.setHighlightedEvrIndex)

  const getDriveTitle = (id: string) => `Sol ${id}`

  // Fetch fault data for this drive
  const { data: faults } = useFaults(parseInt(driveId, 10))
  const hasFaults = faults && faults.length > 0

  // Reset highlighted EVR row when drive is opened
  useEffect(() => {
    // Reset highlighted EVR row for this drive
    setHighlightedEvrIndex(driveId, null);
  }, [driveId, setHighlightedEvrIndex]);

  // Handle panel close - clear charts if this is the last panel
  const handleClose = () => {
    if (onClose) {
      // Reset drive position to 0 when panel is closed
      setDrivePosition(driveId, 0);

      // If this is the last panel being closed, clear the charts
      if (selectedDrives.length === 1) {
        clearCharts();
      }
      onClose();
    }
  };

  // Update components when fault overlay state changes
  useEffect(() => {
    if (!glRef.current) return;

    // Find all containers and update their components
    const updateAllComponents = () => {
      const traverseItems = (item: any) => {
        if (item.type === 'component') {
          // Force re-render by updating the portal with current state
          const portalId = item.container?.portalId;
          if (portalId) {
            const componentType = item.componentType;
            const initialParams = (currentSearchParamsRef.current && currentSearchParamsRef.current.length > 0)
              ? currentSearchParamsRef.current
              : ['tilt'];

            let newNode: React.ReactNode;
            switch (componentType) {
              case 'DriveMapView':
                newNode = <DriveMapView driveId={driveId} faults={faults} faultOverlayEnabled={faultOverlayEnabled} />;
                break;
              case 'DriveChartView':
                newNode = <DriveChartView driveId={driveId} sol={parseInt(driveId, 10)} initialParameters={initialParams} faults={faults} faultOverlayEnabled={faultOverlayEnabled} />;
                break;
              case 'DriveEvrsView':
                newNode = <DriveEvrsView driveId={driveId} faults={faults} faultOverlayEnabled={faultOverlayEnabled} />;
                break;
              case 'DriveImageryView':
                newNode = <DriveImageryView driveId={driveId} faults={faults} faultOverlayEnabled={faultOverlayEnabled} />;
                break;
              default:
                return;
            }

            setPortals((prev) => prev.map((p) => p.id === portalId ? { ...p, node: newNode } : p));
          }
        } else if (item.contentItems && item.contentItems.length > 0) {
          // Recursively traverse child items
          item.contentItems.forEach(traverseItems);
        }
      };

      // Start traversal from the root
      if (glRef.current.root) {
        traverseItems(glRef.current.root);
      }
    };

    updateAllComponents();
  }, [faultOverlayEnabled, faults]);

  const defaultConfig: LayoutConfig = useMemo(() => ({
    settings: {
      hasHeaders: true,
      reorderEnabled: true,
      showPopoutIcon: false,
      showMaximiseIcon: false,
      showCloseIcon: true, // Enable close buttons
      constrainDragToContainer: true,
      selectionEnabled: false,
    },
    dimensions: {
      borderWidth: 4,
      minItemHeight: 100,
      minItemWidth: 100,
      headerHeight: 36,
      dragProxyWidth: 300,
      dragProxyHeight: 200,
    },
    content: [{
      type: 'column',
      content: [{
        type: 'row',
        content: [{
          type: 'component',
          componentType: 'DriveMapView',
          title: 'Map',
          componentState: {},
          isClosable: true,
        }, {
          type: 'component',
          componentType: 'DriveImageryView',
          title: 'Imagery',
          componentState: {},
          isClosable: true,
        }]
      },
      {
        type: 'component',
        componentType: 'DriveChartView',
        title: 'Charts',
        componentState: {},
        isClosable: true,
      },
      {
        type: 'component',
        componentType: 'DriveEvrsView',
        title: 'EVRs',
        componentState: {},
        isClosable: true,
      }],
    }]
  }), [])

  // Extract layout structure from GoldenLayout config (strips GoldenLayout internals)
  const extractLayoutStructure = (config: any): DriveLayoutStructure | null => {
    try {
      // GL2 toConfig() returns size as { size: number, sizeUnit: '%'|'fr'|'px'|'em' }
      // but loadLayout expects size as a single string like '40%'. Combine on
      // extract so the round-trip through `loadLayout` actually replays the
      // proportion. Skip when size is the default 1fr (no user intent set).
      const formatSize = (size: any, sizeUnit: any): string | undefined => {
        if (typeof size !== 'number' || typeof sizeUnit !== 'string') return undefined
        return `${size}${sizeUnit}`
      }
      const extractContent = (items: any[]): LayoutItem[] => {
        return items.map((item: any): LayoutItem => {
          const size = formatSize(item.size, item.sizeUnit)
          const minSize = formatSize(item.minSize, item.minSizeUnit)
          if (item.type === 'component') {
            const c: LayoutComponent = {
              type: 'component',
              componentType: item.componentType,
              title: item.title,
              isClosable: item.isClosable,
            }
            if (size) c.size = size
            if (minSize) c.minSize = minSize
            return c
          } else {
            const container: LayoutContainer = {
              type: item.type,
              content: extractContent(item.content || []),
            }
            if (typeof item.activeItemIndex === 'number') {
              container.activeItemIndex = item.activeItemIndex
            }
            if (size) container.size = size
            if (minSize) container.minSize = minSize
            return container
          }
        })
      }

      // Build a canonical root container (row) from the full config
      // Some GL builds return either { root } or top-level { content } during transitions
      const rawRoot = (config.root ?? { type: 'row', content: config.content || [] }) as any
      // If toConfig returned a "partial" where content is a flat array of components,
      // wrap them in a stack so our structure remains valid.
      const coercedContent = Array.isArray(rawRoot.content)
        ? (rawRoot.content.every((i: any) => i && i.type === 'component')
          ? [{ type: 'stack', content: rawRoot.content }]
          : rawRoot.content)
        : []
      const rootContainer: LayoutContainer = {
        type: rawRoot.type === 'row' || rawRoot.type === 'column' || rawRoot.type === 'stack' ? rawRoot.type : 'row',
        content: extractContent(coercedContent),
        activeItemIndex: rawRoot.activeItemIndex,
      }
      return { root: rootContainer }
    } catch (e) {
      console.warn('[DrivePanel] Failed to extract layout structure:', e)
      return null
    }
  }

  // Reconstruct full GoldenLayout config from stored structure + default settings
  const reconstructLayoutConfig = (structure: DriveLayoutStructure): any => {
    const reconstructContent = (items: LayoutItem[]): any[] => {
      return items.map((item: LayoutItem): any => {
        if (item.type === 'component') {
          const c: any = {
            type: 'component',
            componentType: item.componentType,
            title: item.title,
            componentState: {},
            isClosable: item.isClosable !== false, // default to true
          }
          if (typeof (item as LayoutComponent).size === 'string') c.size = (item as LayoutComponent).size
          if (typeof (item as LayoutComponent).minSize === 'string') c.minSize = (item as LayoutComponent).minSize
          return c
        } else {
          const result: any = {
            type: item.type,
            content: reconstructContent(item.content),
          }
          if (typeof (item as LayoutContainer).activeItemIndex === 'number') {
            result.activeItemIndex = (item as LayoutContainer).activeItemIndex
          }
          if (typeof (item as LayoutContainer).size === 'string') result.size = (item as LayoutContainer).size
          if (typeof (item as LayoutContainer).minSize === 'string') result.minSize = (item as LayoutContainer).minSize
          return result
        }
      })
    }

    // Use the stored root container
    const storedRoot = structure.root
    // Coerce top-level to row for GL stability
    const topType = storedRoot.type === 'row' || storedRoot.type === 'column' ? storedRoot.type : 'row'
    return {
      ...defaultConfig,
      content: [
        {
          type: topType,
          content: reconstructContent(storedRoot.content),
          ...(storedRoot.activeItemIndex !== undefined && { activeItemIndex: storedRoot.activeItemIndex }),
        },
      ],
    }
  }



  // Initialize GoldenLayout
  useEffect(() => {
    if (!containerRef.current) return

    const containerEl = containerRef.current

    // Destroy previous instance
    if (glRef.current) {
      try {
        glRef.current.destroy()
      } catch { }
      glRef.current = null
    }

    // Create new GoldenLayout instance
    const gl = new GoldenLayout(containerEl as HTMLDivElement)

    // Helper to create portal for React components
    const mountPortal = (container: any, node: React.ReactNode): string => {
      const el = document.createElement('div')
      el.style.height = '100%'
      container.element.append(el)
      const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
      setPortals((prev) => [...prev, { id, container: el, node }])

      // Cleanup on destroy
      if (typeof container.on === 'function') {
        container.on('destroy', () => {
          setPortals((prev) => prev.filter((p) => p.id !== id))
        })
      }

      return id
    }



    // Register component factories with reactive fault overlay state
    gl.registerComponentFactoryFunction('DriveMapView', (container: any) => {
      const id = mountPortal(container, <DriveMapView driveId={driveId} faults={faults} faultOverlayEnabled={faultOverlayEnabled} />)

      // Store portal ID for later updates
      container.portalId = id
    })

    gl.registerComponentFactoryFunction('DriveChartView', (container: any) => {
      const initialParams = (currentSearchParamsRef.current && currentSearchParamsRef.current.length > 0)
        ? currentSearchParamsRef.current
        : ['tilt']
      const id = mountPortal(container, <DriveChartView driveId={driveId} sol={parseInt(driveId, 10)} initialParameters={initialParams} faults={faults} faultOverlayEnabled={faultOverlayEnabled} />)

      // Store portal ID for later updates
      container.portalId = id
    })

    gl.registerComponentFactoryFunction('DriveEvrsView', (container: any) => {
      const id = mountPortal(container, <DriveEvrsView driveId={driveId} faults={faults} faultOverlayEnabled={faultOverlayEnabled} />)

      // Store portal ID for later updates
      container.portalId = id
    })

    gl.registerComponentFactoryFunction('DriveImageryView', (container: any) => {
      const id = mountPortal(container, <DriveImageryView driveId={driveId} faults={faults} faultOverlayEnabled={faultOverlayEnabled} />)

      // Store portal ID for later updates
      container.portalId = id
    })

    // Mark ready once GL has fully initialised
    try {
      gl.on?.('initialised', () => { glReadyRef.current = true })
      gl.on?.('dragStart', () => { glReadyRef.current = false; isDraggingRef.current = true })
      gl.on?.('dragStop', () => {
        // Delay slightly to ensure layout is fully resolved
        setTimeout(() => { glReadyRef.current = true; isDraggingRef.current = false; scheduleSave() }, 30)
      })
      // Persist when active tab changes: rely on 'stateChanged' and tab's 'setActiveComponentItem'
      // Some GL builds don't expose strongly-typed events for active item changes, so stateChanged suffices
      // Fallback global mouseup to end potential drags
      const onMouseUp = () => { isDraggingRef.current = false; glReadyRef.current = true }
      document.addEventListener('mouseup', onMouseUp)
      // Cleanup listener on unmount
      const cleanup = () => document.removeEventListener('mouseup', onMouseUp)
      // Attach to gl destroy for safety
      gl.on?.('destroy', cleanup)
    } catch { /* no-op */ }

    // Add icons to tabs when they're created
    gl.on('tabCreated', (tab: any) => {
      const componentType = tab.contentItem?.componentType
      if (componentType) {
        // Wait for the next tick to ensure the tab element is fully created
        setTimeout(() => {
          const tabElement = tab.element
          if (tabElement) {
            const titleElement = tabElement.querySelector('.lm_title')
            if (titleElement) {
              let iconSvg = ''
              let title = ''

              switch (componentType) {
                case 'DriveMapView':
                  iconSvg = '<svg style="pointer-events:none" class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m-6 3l6-3"></path></svg>'
                  title = 'Map'
                  break
                case 'DriveChartView':
                  iconSvg = '<svg style="pointer-events:none" class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3v18h18"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"></path></svg>'
                  title = 'Charts'
                  break
                case 'DriveEvrsView':
                  iconSvg = '<svg style="pointer-events:none" class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 21h8a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2Z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 3v4"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 3v4"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9h4"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 13h4"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 17h4"></path></svg>'
                  title = 'EVRs'
                  break
                case 'DriveImageryView':
                  iconSvg = '<svg style="pointer-events:none" class="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>'
                  title = 'Imagery'
                  break
              }

              if (iconSvg && title) {
                titleElement.innerHTML = `${iconSvg}${title}`
              }
            }
          }
        }, 0)
      }
    })

    // Load the layout: use stored structure if available, otherwise default
    try {
      let configToLoad = defaultConfig

      if (driveLayoutStructure) {
        configToLoad = reconstructLayoutConfig(driveLayoutStructure)
      }

      glReadyRef.current = false
      isApplyingLayoutRef.current = true
      gl.loadLayout(configToLoad)
      isApplyingLayoutRef.current = false
      // Ready after initial load
      glReadyRef.current = true
    } catch (e) {
      console.error('[DrivePanel] Error loading layout:', e)
      // Fall back to default config if stored structure fails
      try {
        glReadyRef.current = false
        isApplyingLayoutRef.current = true
        gl.loadLayout(defaultConfig)
        isApplyingLayoutRef.current = false
        glReadyRef.current = true
      } catch (fallbackError) {
        console.error('[DrivePanel] Default config also failed:', fallbackError)
      }
    }

    // Helper: debounce and robustly extract a stable structure
    const scheduleSave = () => {
      if (saveDebounceRef.current) {
        clearTimeout(saveDebounceRef.current)
      }
      saveDebounceRef.current = window.setTimeout(() => {
        const attempt = (tries: number) => {
          try {
            if (!glReadyRef.current || isDraggingNow() || isApplyingLayoutRef.current) {
              if (tries < 12) {
                return setTimeout(() => attempt(tries + 1), 50)
              }
              return
            }
            const currentConfig = typeof gl.toConfig === 'function' ? (gl.toConfig() as any) : null
            if (!currentConfig) {
              if (tries < 12) return setTimeout(() => attempt(tries + 1), 50)
              return
            }
            const structure = extractLayoutStructure(currentConfig)
            if (!structure) {
              if (tries < 12) return setTimeout(() => attempt(tries + 1), 50)
              return
            }
            const prev = lastSavedStructureRef.current
            const changed = JSON.stringify(prev) !== JSON.stringify(structure)
            if (changed) {
              lastSavedStructureRef.current = structure
              setDriveLayoutStructure(structure)
            }
          } catch {
            if (tries < 12) setTimeout(() => attempt(tries + 1), 50)
          }
        }
        attempt(0)
      }, 60)
    }

    // Listen for layout changes and extract structure to store
    try {
      gl.on?.('stateChanged', () => { scheduleSave() })
    } catch { /* no-op */ }

    glRef.current = gl

    return () => {
      try {
        gl.destroy()
      } catch { }
      glRef.current = null
      setPortals([])
    }
  }, [driveId, defaultConfig, resetNonce])

  // Update search parameters ref without re-rendering GoldenLayout
  useEffect(() => {
    currentSearchParamsRef.current = lastSearchParameters || []
  }, [lastSearchParameters])

  // Apply structure changes to existing GL instance without re-creating.
  //
  // Fast path: when only `size`/`minSize` differ between the current GL state
  // and the incoming structure (i.e. someone dragged a splitter elsewhere),
  // walk the GL contentItem tree and mutate sizes in-place, then call
  // updateRootSize() to recompute pixel layout. This avoids the heavy
  // gl.loadLayout() teardown that otherwise re-mounts every component
  // (including DriveMapView, which triggers a fresh map load + zoom animation).
  //
  // Slow path: when the tree shape itself changed (tabs added/moved/closed),
  // fall back to gl.loadLayout() — that path will rebuild components.
  useEffect(() => {
    const gl = glRef.current
    if (!gl) return
    if (!driveLayoutStructure) return
    if (!syncDrivePanels) return

    const stripSizes = (item: LayoutItem): any => {
      if (item.type === 'component') {
        const c = item as LayoutComponent
        return { type: 'component', componentType: c.componentType, title: c.title, isClosable: c.isClosable }
      }
      const co = item as LayoutContainer
      return {
        type: co.type,
        activeItemIndex: co.activeItemIndex,
        content: (co.content || []).map(stripSizes),
      }
    }

    const parseSizeStr = (s: string | undefined): { size: number; sizeUnit: string } | undefined => {
      if (!s) return undefined
      const m = s.match(/^(\d+(?:\.\d+)?)([%a-z]+)$/i)
      if (!m) return undefined
      const n = parseFloat(m[1])
      if (Number.isNaN(n)) return undefined
      return { size: n, sizeUnit: m[2] }
    }

    // Walk GL contentItem tree and structure tree in lockstep, applying sizes.
    const applySizesInPlace = (glItem: any, structItem: LayoutItem): boolean => {
      let changed = false
      const sz = parseSizeStr((structItem as any).size)
      if (sz && glItem) {
        if (glItem.size !== sz.size || glItem.sizeUnit !== sz.sizeUnit) {
          glItem.size = sz.size
          glItem.sizeUnit = sz.sizeUnit
          changed = true
        }
      }
      const ms = parseSizeStr((structItem as any).minSize)
      if (ms && glItem) {
        if (glItem.minSize !== ms.size || glItem.minSizeUnit !== ms.sizeUnit) {
          glItem.minSize = ms.size
          glItem.minSizeUnit = ms.sizeUnit
          changed = true
        }
      }
      if (structItem.type !== 'component') {
        const children = (glItem?.contentItems || []) as any[]
        const structChildren = (structItem as LayoutContainer).content || []
        for (let i = 0; i < structChildren.length && i < children.length; i++) {
          if (applySizesInPlace(children[i], structChildren[i])) changed = true
        }
      }
      return changed
    }

    try {
      // Compare with current structure to avoid unnecessary loads
      const currentConfig = typeof gl.toConfig === 'function' ? gl.toConfig() : null
      const currentStructure = currentConfig ? extractLayoutStructure(currentConfig) : null
      const same = JSON.stringify(currentStructure) === JSON.stringify(driveLayoutStructure)
      if (same) return

      // Detect size-only changes: tree topology identical, only sizes differ.
      const sizeOnly = currentStructure
        && JSON.stringify(stripSizes(currentStructure.root)) === JSON.stringify(stripSizes(driveLayoutStructure.root))

      if (sizeOnly && gl.rootItem) {
        applySizesInPlace(gl.rootItem, driveLayoutStructure.root)
        if (typeof gl.updateRootSize === 'function') {
          gl.updateRootSize(false)
        } else if (typeof gl.updateSize === 'function') {
          gl.updateSize()
        }
        return
      }

      const newConfig = reconstructLayoutConfig(driveLayoutStructure)
      isApplyingLayoutRef.current = true
      gl.loadLayout(newConfig)
      isApplyingLayoutRef.current = false
    } catch (e) {
      console.warn('[DrivePanel] Failed to apply structure to existing GL:', e)
    }
  }, [driveLayoutStructure, syncDrivePanels])

  // Resize GoldenLayout when container size changes
  useEffect(() => {
    if (!containerRef.current || !glRef.current) return

    const container = containerRef.current
    const gl = glRef.current

    const resize = () => {
      try {
        const width = container.clientWidth
        const height = container.clientHeight
        if (typeof gl.updateSize === 'function') {
          gl.updateSize(width, height)
        } else if (typeof gl.setSize === 'function') {
          gl.setSize(width, height)
        }
      } catch { }
    }

    // Initial resize after mount
    requestAnimationFrame(resize)

    const observer = new ResizeObserver(() => resize())
    observer.observe(container)

    return () => {
      try { observer.disconnect() } catch { }
    }
  }, [containerRef.current])



  const driveColor = getSelectedDriveColor(driveId, selectedDrives)

  return (
    <div className="bg-slate-50 dark:bg-stellar-dark-surface border border-slate-200 dark:border-stellar-dark-border rounded-lg shadow-md h-full flex flex-col overflow-visible">
      {/* Drive color identifier — matches the search-result row color so a
          DrivePanel can be visually paired with its result list entry. */}
      {driveColor && (
        <div
          className="flex-shrink-0"
          style={{ backgroundColor: driveColor, height: DRIVE_PANEL_COLOR_BAR_HEIGHT_PX }}
        />
      )}
      {/* Panel header */}
      <div className="p-3 border-b dark:border-stellar-dark-border bg-white dark:bg-stellar-dark-surface-elevated flex-shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-md font-medium text-gray-800 dark:text-stellar-dark-text-primary">
            {getDriveTitle(driveId)}
            {driveState.isReferenceDrive(driveId) && (
              <span className="ml-1 font-normal text-gray-500 dark:text-stellar-dark-text-secondary">(REF)</span>
            )}
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {/* Show Faults toggle - only show if drive has faults */}
          {hasFaults && (
            <button
              onClick={() => setFaultOverlayEnabled(!faultOverlayEnabled)}
              className={`text-xs px-2 py-1 rounded border transition-colors flex items-center gap-1 ${faultOverlayEnabled
                ? 'bg-stellar-fault-red dark:bg-stellar-fault-red text-white dark:text-white border-stellar-fault-red dark:border-stellar-fault-red hover:opacity-90 dark:hover:opacity-90'
                : 'bg-gray-100 dark:bg-stellar-dark-surface-elevated text-gray-600 dark:text-stellar-dark-text-secondary border-gray-300 dark:border-stellar-dark-border hover:bg-gray-200 dark:hover:bg-stellar-dark-surface'
                }`}
              title={faultOverlayEnabled ? 'Hide faults' : 'Show faults'}
            >
              <AlertTriangle className="h-3 w-3" />
              Show Faults
            </button>
          )}
          <button
            onClick={() => setTimelineExpanded(!timelineExpanded)}
            className="text-gray-600 dark:text-stellar-dark-text-secondary hover:text-gray-800 dark:hover:text-stellar-dark-text-primary transition-colors flex items-center gap-1 px-2 py-1 rounded border dark:border-stellar-dark-border"
            title={timelineExpanded ? 'Hide timeline' : 'Show timeline'}
          >
            {/* Play/Pause icon for timeline toggle */}
            {isTimelinePlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {timelineExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {onClose && (
            <button
              onClick={handleClose}
              className="text-gray-400 dark:text-stellar-dark-text-secondary hover:text-gray-600 dark:hover:text-stellar-dark-text-primary transition-colors"
              title="Close drive panel"
            >
              <XIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Collapsible timeline: keep mounted, hide with CSS when collapsed */}
      <div className={`px-3 py-2 flex-shrink-0 bg-white dark:bg-stellar-dark-surface-elevated ${timelineExpanded ? 'border-b dark:border-stellar-dark-border' : 'hidden'}`}>
        <TimelineBar
          driveId={driveId}
          isPlaying={isTimelinePlaying}
          onTogglePlay={() => setDrivePlayState(driveId, !isTimelinePlaying)}
          onPause={() => setDrivePlayState(driveId, false)}
          speed={timelineSpeed}
          onSpeedChange={setTimelineSpeed}
          position={drivePositions[driveId] ?? 0}
          onChangePosition={(p) => setDrivePosition(driveId, p)}
          faults={faults}
          faultOverlayEnabled={faultOverlayEnabled}
        />
      </div>

      {/* GoldenLayout container */}
      <div ref={containerRef} className="flex-1 min-h-0 min-w-0" />
      {/* Render portals so children stay within React context */}
      {portals.map((p) => createPortal(p.node, p.container, p.id))}
    </div>
  )
}
