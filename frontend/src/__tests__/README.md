# Frontend Test Suite

This directory contains comprehensive tests for the Mars Paths frontend application, covering utilities, hooks, state management, UI components, API clients, and integration workflows.

## Test Structure

```
src/
├── __tests__/
│   ├── integration/           # Integration tests for user workflows
│   │   ├── SearchWorkflow.test.tsx
│   │   └── AlertSystem.test.tsx
│   └── README.md
├── api/
│   ├── __tests__/
│   │   └── client.test.ts     # API client tests
│   └── transformers/
│       └── __tests__/
│           └── searchTransformers.test.ts
├── components/
│   ├── map/util/__tests__/
│   │   └── marsCoordinateUtils.test.ts
│   └── ui/__tests__/
│       ├── AlertDialog.test.tsx
│       └── Toast.test.tsx
├── hooks/__tests__/
│   ├── useAlert.test.ts
│   ├── useSearch.test.ts
│   └── useThrottledCallback.test.ts
├── state/__tests__/
│   ├── searchSlice.test.ts
│   └── urlSlice.test.ts
├── utils/__tests__/
│   ├── urlState.test.ts
│   └── chartParameters.test.ts
└── test/
    └── setup.ts               # Test configuration and mocks
```

## Test Categories

### 1. Utility Functions (`utils/__tests__/`)
- **urlState.test.ts**: URL serialization/deserialization, validation, sharing
- **chartParameters.test.ts**: Parameter normalization and validation

### 2. Custom Hooks (`hooks/__tests__/`)
- **useAlert.test.ts**: Alert state management and display
- **useSearch.test.ts**: Search functionality with TanStack Query integration
- **useThrottledCallback.test.ts**: Animation frame throttling utility

### 3. State Management (`state/__tests__/`)
- **searchSlice.test.ts**: Search state, filters, and helper methods
- **urlSlice.test.ts**: URL synchronization and navigation

### 4. UI Components (`components/ui/__tests__/`)
- **AlertDialog.test.tsx**: Modal dialog functionality and accessibility
- **Toast.test.tsx**: Toast notifications and auto-dismissal

### 5. Map Utilities (`components/map/util/__tests__/`)
- **marsCoordinateUtils.test.ts**: Mars coordinate system transformations

### 6. API Layer (`api/__tests__/`)
- **client.test.ts**: HTTP client configuration and error handling
- **searchTransformers.test.ts**: Data transformation for API requests/responses

### 7. Integration Tests (`__tests__/integration/`)
- **SearchWorkflow.test.tsx**: Complete search user journey
- **AlertSystem.test.tsx**: Alert and toast system interaction

## Running Tests

### All Tests
```bash
npm test
```

### Watch Mode
```bash
npm test -- --watch
```

### Coverage Report
```bash
npm run test:coverage
```

### UI Mode (Interactive)
```bash
npm run test:ui
```

### Specific Test Files
```bash
# Run utility tests
npm test -- utils

# Run component tests
npm test -- components

# Run integration tests
npm test -- integration

# Run specific test file
npm test -- urlState.test.ts
```

## Test Configuration

### Setup (`src/test/setup.ts`)
- Configures testing environment with jsdom
- Mocks browser APIs (window.matchMedia, IntersectionObserver, etc.)
- Mocks Leaflet and react-leaflet for map components
- Sets up global test utilities

### Vitest Configuration (`vite.config.ts`)
- Configured for React testing with jsdom environment
- Includes CSS processing for component tests
- Uses custom setup file for global mocks

## Test Patterns

### Component Testing
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Test component interactions
const user = userEvent.setup()
await user.click(screen.getByRole('button'))
```

### Hook Testing
```typescript
import { renderHook, act } from '@testing-library/react'

// Test custom hooks
const { result } = renderHook(() => useAlert())
act(() => {
  result.current.showAlert('Title', 'Message')
})
```

### Store Testing
```typescript
// Test Zustand slices in isolation
const mockSet = vi.fn()
const mockGet = vi.fn()
const slice = createSearchSlice(mockSet, mockGet)
```

### Integration Testing
```typescript
// Test complete user workflows
render(
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </BrowserRouter>
)
```

## Mocking Strategy

### API Mocking
- Repository modules are mocked at the module level
- Specific implementations provided per test as needed
- TanStack Query configured with no retries for faster tests

### External Dependencies
- Leaflet completely mocked for map components
- Browser APIs mocked for consistent cross-environment testing
- Router wrapped in test providers

### Component Mocking
- GoldenLayout explicitly excluded from testing (per requirements)
- Complex components mocked when testing integration workflows

## Test Coverage Goals

- **Utilities**: 100% - Pure functions, easy to test comprehensively
- **Hooks**: 95% - Cover main flows and error cases
- **Components**: 90% - Focus on user interactions and accessibility
- **State Management**: 95% - Critical business logic
- **API Layer**: 90% - Request/response transformations
- **Integration**: 80% - Key user journeys

## Best Practices

### 1. Test Behavior, Not Implementation
- Focus on user-visible behavior
- Test component contracts, not internal state
- Use semantic queries (role, label, text)

### 2. Arrange-Act-Assert Pattern
```typescript
// Arrange
const user = userEvent.setup()
render(<Component />)

// Act
await user.click(screen.getByRole('button'))

// Assert
expect(screen.getByText('Success')).toBeInTheDocument()
```

### 3. Error Testing
- Test error boundaries and fallback states
- Verify error messages are user-friendly
- Test network failure scenarios

### 4. Accessibility Testing
- Use semantic queries when possible
- Test keyboard navigation
- Verify ARIA attributes

### 5. Performance Testing
- Test throttling and debouncing behavior
- Verify cleanup functions prevent memory leaks
- Test large dataset handling

## Debugging Tests

### Common Issues
1. **Timer-based tests**: Use `vi.useFakeTimers()` and `vi.advanceTimersByTime()`
2. **Async operations**: Use `waitFor()` for async state updates
3. **Component cleanup**: Ensure components unmount cleanly
4. **Mock reset**: Clear mocks between tests with `vi.clearAllMocks()`

### Debug Tools
```bash
# Run tests with debugging output
npm test -- --reporter=verbose

# Run single test for debugging
npm test -- --run specific-test-name

# Open test UI for interactive debugging
npm run test:ui
```

## Continuous Integration

These tests are designed to run in CI environments with:
- Consistent browser environment (jsdom)
- No external dependencies
- Fast execution (< 30 seconds for full suite)
- Clear failure reporting

## Contributing

When adding new features:
1. Write tests alongside feature implementation
2. Follow existing test patterns and structure
3. Ensure tests are deterministic and don't rely on external state
4. Update this documentation for significant test additions
