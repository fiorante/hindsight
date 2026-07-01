# Similarity Search Algorithms

This directory contains the similarity search algorithms used to find rover drives similar to a reference drive or segment. The system supports multiple algorithms for comparing time-series telemetry data.

## Current Algorithm in Use

**DTW (Dynamic Time Warping)** is currently the default and actively used algorithm for similarity search.

### Evidence:
- **Backend Default**: The `SimilarityConfig` model defaults to `algorithm: "dtw"`
- **Frontend Usage**: All similarity search requests are hardcoded to use DTW
- **Time Series Focus**: DTW is particularly well-suited for comparing rover drive telemetry data

## Available Algorithms

### 1. DTW (Dynamic Time Warping) - **Currently Used**

**Why DTW was chosen:**
- **Temporal Alignment**: DTW can find optimal alignments between time series of different lengths
- **Rover Drive Characteristics**: Drives often have different durations and temporal patterns
- **Robust Comparison**: Handles variations in timing and speed while preserving temporal relationships

**Implementation:** `dtw.py`

**How multiple parameters are combined:**
```python
# Calculate DTW distance for each variable and combine
total_distance = 0.0
valid_comparisons = 0

for variable in variables:
    # Calculate DTW distance for this variable
    distance = dtw.distance(ref_series, comp_series)
    
    if np.isfinite(distance):
        total_distance += distance
        valid_comparisons += 1

# Average distance across variables
avg_distance = total_distance / valid_comparisons

# Convert distance to similarity score (0-1, higher is more similar)
similarity = np.exp(-avg_distance)
```

**Parameter Combination Method:**
- **Individual DTW calculation**: Each variable (e.g., elevation, tilt) gets its own DTW distance
- **Simple averaging**: All valid DTW distances are summed and averaged
- **Equal weighting**: Each variable contributes equally to the final score
- **Exponential decay**: Final similarity = `exp(-average_distance)`

### 2. KNN (k-Nearest Neighbors) - Available Alternative

**Why KNN was implemented:**
- **Statistical Features**: Focuses on statistical properties rather than temporal alignment
- **Feature-based Comparison**: Extracts meaningful features from time series data
- **Alternative Approach**: Provides a different perspective on similarity

**Implementation:** `knn.py`

**How multiple parameters are combined:**
```python
# Extract features for both drives
ref_features = self.extract_features(reference_df, variables)
comp_features = self.extract_features(comparison_df, variables)

# Convert to feature vectors
ref_vector = self.features_to_vector(ref_features, variables)
comp_vector = self.features_to_vector(comp_features, variables)

# Standardize features to give equal weight
scaler = StandardScaler()
scaled_vectors = scaler.fit_transform(combined_vectors)

# Calculate Euclidean distance in feature space
distance = euclidean_distances(ref_scaled, comp_scaled)[0, 0]

# Convert distance to similarity score
similarity = np.exp(-distance)
```

**Parameter Combination Method:**
- **Feature extraction**: Each variable gets 15 statistical features (mean, std, min, max, etc.)
- **Feature vector concatenation**: All features from all variables form a single vector
- **Standardization**: Features are standardized for equal weighting
- **Euclidean distance**: Distance calculated in standardized feature space
- **Exponential decay**: Final similarity = `exp(-distance)`

## Algorithm Comparison

| Aspect | DTW Strategy | KNN Strategy |
|--------|-------------|--------------|
| **Combination method** | Simple averaging of individual DTW distances | Feature vector concatenation with standardization |
| **Variable weighting** | Equal weight per variable | Equal weight per feature (after standardization) |
| **Temporal alignment** | Preserves temporal relationships | Ignores temporal order, focuses on statistical properties |
| **Scalability** | Linear with number of variables | Linear with number of variables × features per variable |
| **Use case** | Time series with temporal importance | Statistical pattern matching |

## Final Ranking Process

Both algorithms return a similarity score between 0 and 1, where higher values indicate greater similarity. The backend then:

```python
# Sort by similarity score (descending) and limit results
results.sort(key=lambda x: x.similarity_score, reverse=True)
limited_results = results[:request.config.max_results]
```

The results are sorted by similarity score in descending order, so the most similar drives appear first in the ranking.

## Architecture

- **Base Class**: `base.py` - Abstract base class defining the interface
- **Factory**: `factory.py` - Creates strategy instances based on algorithm name
- **Strategies**: `dtw.py`, `knn.py` - Concrete implementations
- **Registration**: New strategies can be registered dynamically

## Usage

The similarity search is used in the main API endpoint:

```python
@app.post("/query/similar", response_model=SimilaritySearchResponse)
async def similarity_search(request: SimilarityRequest):
    # Get the appropriate strategy
    strategy = get_similarity_strategy(request.config.algorithm)
    
    # Calculate similarity for each comparison
    similarity_score = strategy.calculate(
        reference_df, comparison_df, request.config.variables
    )
```

This design allows users to select multiple parameters (variables) for comparison while ensuring that each parameter contributes meaningfully to the final similarity assessment, regardless of the chosen algorithm.

## Fault Similarity - Special Case for Anomaly Investigation

Fault similarity is a special case in the similarity search system. Unlike telemetry-based similarity, it focuses on discrete fault events that occur during drives, which is particularly useful for anomaly investigation workflows.

### How Fault Similarity is Measured

**Implementation:** `base.py` - `calculate_fault_similarity()`

**Fault Data Source:**
- **Database Table**: `faults` table stores mobility faults extracted from EVR records
- **Fault Types**: Examples include `CUTOFF_TIME`, `STOP_MOM`, `NO_PATH`, `TILT`, `SUSP`, etc.
- **Temporal Order**: Faults are stored with SCLK timestamps to preserve occurrence order

Fault lists for each drive are pre-fetched by the service layer and passed into the strategy as `List[str]` — the strategy never touches the database directly.

**Priority-Based Similarity Algorithm:**

The algorithm assigns scores based on how closely two drives' fault sequences match, using a four-level priority hierarchy:

| Priority | Condition | Score |
|----------|-----------|-------|
| 1 | Identical fault sequences | 1.0 |
| 2 | Same last fault | 0.8 |
| 3 | Same fault set (any order) | 0.6 |
| 4 | One set is a subset of the other | 0.0–0.4 |
| — | No overlap | 0.0 |

**Edge Cases:**
- Both drives fault-free: Perfect similarity (1.0)
- One drive fault-free, other has faults: No similarity (0.0)

### Combined Similarity Scoring

When `fault` is included in the search variables, fault similarity is combined with telemetry similarity using a weighted average:

- **Fault weight**: 0.3 (30% of final score, configurable)
- **Telemetry weight**: 0.7 (70% of final score)

If only fault is selected (no telemetry variables), the fault similarity score is returned directly.
