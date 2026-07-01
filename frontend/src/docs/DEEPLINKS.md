# Hindsight Deeplink Documentation

This document describes the deeplink functionality implemented in the Hindsight Mars rover data visualization application.

## Overview

Deeplinks allow users to share specific application states via URLs. When a user navigates to a deeplink URL, the application automatically restores the exact view, search parameters, drive selections, and other configurations that were active when the link was created.

## URL Structure

All deeplinks follow this structure:
```
/hindsight/{view}?{parameters}
```

Where:
- `{view}` is either `map` or `drives`
- `{parameters}` are URL query parameters encoding the application state

## Supported Parameters

| Parameter | Description | Example |
|-----------|-------------|---------|
| `sol` | Focused sol number | `sol=1045` |
| `drives` | Selected drives for comparison | `drives=1041,1042,1045` |
| `searchMode` | Search mode (similarity/parameter) | `searchMode=parameter` |
| `simMode` | Similarity mode (sol/plan/segment) | `simMode=segment` |
| `ref` | Reference sol for similarity search | `ref=1041` |
| `filters` | Active UI filters | `filters=TERRAIN,FAULT` |
| `params` | Parameter filters | `params=SPEED:10-25,HEADING:45-90` |
| `charts` | Active chart parameters | `charts=SPEED,HEADING,PITCH` |
| `pos` | Timeline position (0-1) | `pos=0.3` |
| `timeline` | Timeline expanded state | `timeline=false` |
| `speed` | Timeline playback speed | `speed=30` |
| `lat` | Map latitude | `lat=-5.4563` |
| `lng` | Map longitude | `lng=154.8397` |
| `zoom` | Map zoom level | `zoom=15` |
| `searchPanel` | Search panel open state | `searchPanel=false` |
| `vce` | VCE image side mode | `vce=left` |
| `pdi` | PDI image side mode | `pdi=both` |
| `faults` | Fault overlay enabled | `faults=true` |
| `sync` | Panel sync enabled | `sync=false` |
| `results` | Search results (compressed) | `results=1042:0.85,1045:0.73` |

## Example URLs

### Basic Views

**Map View**
```
/hindsight/map
```

**Drives View with Selected Drives**
```
/hindsight/drives?drives=1041,1042,1045
```

### Map View with Focus

**Focused on Specific Sol**
```
/hindsight/map?sol=1045
```

**Map with Specific Viewport**
```
/hindsight/map?sol=1045&lat=-5.4563&lng=154.8397&zoom=15
```

### Search Examples

**Similarity Search**
```
/hindsight/map?searchMode=similarity&ref=1041&filters=TERRAIN,FAULT
```

**Parameter Search**
```
/hindsight/map?searchMode=parameter&params=SPEED:10-25,HEADING:45-90,TERRAIN:ROUGH
```

**Segment Similarity**
```
/hindsight/map?searchMode=similarity&simMode=segment&ref=1041
```

### Drive Comparison Examples

**Drive Comparison with Charts**
```
/hindsight/drives?drives=1041,1042&charts=SPEED,HEADING,PITCH
```

**Timeline Position**
```
/hindsight/drives?drives=1041&pos=0.3&speed=60
```

**Panel Configuration**
```
/hindsight/drives?drives=1041,1042&vce=both&pdi=left&faults=true
```

### Complex Examples

**Complete Search Context**
```
/hindsight/map?searchMode=similarity&ref=1041&filters=TERRAIN,FAULT&results=1042:0.85,1045:0.73,1047:0.68
```

**Full Drive Analysis Setup**
```
/hindsight/drives?drives=1041,1042,1045&charts=SPEED,HEADING,PITCH,ROLL&pos=0.3&vce=both&sync=true&timeline=true
```

## Implementation Details

### State Synchronization

The application uses a middleware-based approach to automatically sync state changes to the URL:

1. **URL Sync Middleware**: Intercepts all state changes and debounces URL updates
2. **Router Wrapper**: Handles initial URL hydration and route changes
3. **URL State Slice**: Manages URL-specific state and navigation functions

### Key Features

- **Automatic Sync**: State changes are automatically reflected in the URL
- **Debounced Updates**: URL changes are debounced to prevent excessive history entries
- **Validation**: URL parameters are validated and sanitized
- **Graceful Fallbacks**: Invalid URLs gracefully fall back to default states
- **Share Functionality**: One-click URL sharing with clipboard integration

### Share Button

The share button generates clean, optimized URLs that include only the essential state for the current view:

- **Map View**: Includes focused sol, viewport, and search context
- **Drives View**: Includes selected drives, charts, and timeline state
- **Search Context**: Always preserved regardless of view

## Development

### Debugging

In development mode, a debugger component is available that shows:
- Current URL and parameters
- Generated shareable URL
- Current application state summary
- Quick copy-to-clipboard functionality

### Adding New Parameters

To add a new URL parameter:

1. Add the parameter key to `URL_PARAMS` in `utils/urlState.ts`
2. Update `serializeStateToUrl()` to include the new parameter
3. Update `deserializeStateFromUrl()` to parse the new parameter
4. Add validation in `validateUrlParams()` if needed
5. Update the state interface in `urlSlice.ts` if required

### URL Length Considerations

- URLs are kept under 2000 characters for broad compatibility
- Complex state (like search results) is compressed
- Unnecessary parameters are omitted from shareable URLs
- Default values are not included in URLs

## Browser Compatibility

The deeplink system supports:
- All modern browsers with HTML5 History API support
- Clipboard API for sharing (with fallbacks)
- URL validation and sanitization
- Graceful degradation for unsupported features

## Security

- All URL parameters are validated and sanitized
- No sensitive data is included in URLs
- XSS protection through parameter validation
- Safe fallbacks for malformed URLs
