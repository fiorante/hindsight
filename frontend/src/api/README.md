# API Architecture

This directory implements a **Repository Pattern** for clean separation of data access, business logic, and UI concerns.

## Structure

```
api/
├── client.ts                    # Base HTTP client configuration
├── repositories/               # Data access layer
│   ├── index.ts               # Clean exports
│   ├── searchRepository.ts    # Search-related API calls
│   ├── solRepository.ts       # Sol data API calls
│   └── imageRepository.ts     # Image/PDI API calls
└── transformers/              # Data transformation utilities
    ├── index.ts              # Clean exports
    └── searchTransformers.ts # Search data transformations
```

## Architecture Benefits

### 1. **Separation of Concerns**
- **Repositories**: Handle raw API communication
- **Transformers**: Handle data conversion/business logic
- **Hooks**: Handle React-specific concerns (caching, loading states)

### 2. **Testability**
- Repositories are easily mockable
- Transformers can be unit tested independently
- Clear interfaces for each layer

### 3. **Maintainability**
- Single responsibility for each module
- Easy to find and modify specific functionality
- Consistent patterns across all API interactions

### 4. **Type Safety**
- Strong typing throughout the pipeline
- Compile-time error detection
- IntelliSense support

## Usage Examples

### Search Operations
```typescript
import { useSearch } from '../hooks/useSearch';

const { executeSimilaritySearch, executeParameterSearch } = useSearch();

// Similarity search
await executeSimilaritySearch('sol', ['distance', 'duration'], {
  solNumber: '1041',
  onSuccess: (results) => console.log(results),
  onError: (error) => console.error(error)
});

// Parameter search
await executeParameterSearch([
  { parameter: 'DRIVE_LF.ODOM', min: '100', max: '200' }
], {
  onSuccess: (results) => console.log(results)
});
```

### Sol Data
```typescript
import { useSolData, useSolsList } from '../hooks/useSol';

// Single sol
const { data: solData, isLoading } = useSolData(1041);

// All sols list
const { data: solsList } = useSolsList();
```

### Images
```typescript
import { usePDI, usePDIImageUrls } from '../hooks/useImages';

// PDI data
const { data: pdiData } = usePDI(1041);

// Image URLs
const { getImageUrl } = usePDIImageUrls();
const imageUrl = getImageUrl('filename.jpg');
```

## Key Features

### Motor Parameter Handling
The system automatically handles motor parameters by:
1. Detecting dot notation: `DRIVE_LF.ODOM`
2. Converting to backend format: `drive_lf_odom`
3. Supporting both similarity and parameter searches

### Smart Caching
- Uses React Query for automatic caching
- Appropriate stale times for different data types
- Efficient background refetching

### Error Handling
- Comprehensive error handling at repository level
- User-friendly error messages
- Graceful degradation for failed requests

### Performance Optimizations
- Parallel requests for multiple sols
- Image preloading capabilities
- Efficient batch operations

