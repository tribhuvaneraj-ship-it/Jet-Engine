# Predictive Maintenance for Jet Engine Failures
## Detailed Implementation Plan and Architecture

**Source:** Product Requirements Document (PRD) — Jet Engine Predictive Maintenance  
**Scope:** NASA C-MAPSS turbofan RUL prediction, training pipeline, prediction API, and Streamlit dashboard  
**Primary outcome:** A reproducible educational/research system that estimates an engine's Remaining Useful Life (RUL) from its latest operating cycle and sensor history.

> **Safety boundary:** NASA C-MAPSS is simulated data. Predictions are model estimates for research and education and must not be used as certified aviation maintenance decisions.

---

## 1. Executive implementation summary

Implement the system in four independently testable layers:

1. **Data and feature pipeline** — ingest C-MAPSS files, validate schemas, generate RUL labels, clean sensors, and create leakage-safe temporal features.
2. **Modeling and evaluation** — establish a linear baseline, train Random Forest and XGBoost candidates, optionally add an LSTM/GRU sequence model, and select a model using engine-level validation.
3. **Serving layer** — package preprocessing and the selected estimator together, expose a validated FastAPI endpoint, and return RUL plus a configurable maintenance-status band.
4. **User experience and operations** — provide a Streamlit dashboard, persist artifacts and metrics, add structured logging, and containerize the service.

The recommended first release is a **scikit-learn/XGBoost tabular pipeline** using the latest-cycle feature vector plus rolling/trend features. The sequence model should be treated as a later experiment rather than a release blocker.

---

## 2. Success criteria

### 2.1 Functional success

- Training and test files load with explicit schema validation.
- RUL labels are generated correctly per engine and never use future information at inference time.
- A single engine's latest available history can be submitted to the API.
- The API returns predicted RUL, maintenance status, model version, and validation warnings.
- The dashboard shows engine input, prediction, status, sensor trends, and model metrics.
- The exact preprocessing and model artifact used for prediction can be reloaded from disk.

### 2.2 Quality success

- Train/validation splitting is performed by engine ID, not by random rows.
- MAE and RMSE are reported on an untouched engine-level holdout.
- All transformations are fitted only on training data.
- Missing, malformed, and out-of-range inputs produce clear validation errors.
- Results are reproducible from a pinned dependency set and recorded configuration.
- The UI and API clearly distinguish model estimates from certified maintenance guidance.

### 2.3 Suggested initial acceptance targets

These are engineering gates, not claims about expected model performance:

| Gate | Acceptance condition |
|---|---|
| Data validation | All required columns present; row counts and engine counts logged; no silent coercion failures |
| Leakage test | Feature-generation tests demonstrate that future cycles cannot affect a prediction row |
| Reproducibility | Re-running training with the same seed produces the same split and materially identical metrics |
| Model quality | Candidate beats the linear baseline on both MAE and RMSE, or the trade-off is documented |
| API reliability | Valid request returns within the agreed latency budget; invalid requests return structured 4xx errors |
| Artifact integrity | Model, feature schema, configuration, metrics, and version metadata are saved together |
| UI usability | A user can load/sample engine data and obtain a prediction without editing code |

---

## 3. Proposed repository structure

```text
jet-engine-rul-prediction/
├── data/
│   ├── raw/                  # C-MAPSS files; excluded from source control if large
│   ├── interim/              # validated and normalized intermediate data
│   └── processed/            # model-ready feature tables/sequences
├── notebooks/
│   ├── 01_eda.ipynb
│   ├── 02_feature_engineering.ipynb
│   └── 03_model_training.ipynb
├── src/
│   └── jet_rul/
│       ├── config.py         # typed configuration and paths
│       ├── schemas.py        # data/API schemas
│       ├── data_validation.py
│       ├── preprocessing.py
│       ├── rul_labels.py
│       ├── features.py
│       ├── split.py
│       ├── train.py
│       ├── evaluate.py
│       ├── predict.py
│       ├── artifacts.py
│       └── logging_config.py
├── api/
│   ├── main.py
│   └── routes.py
├── dashboard/
│   └── app.py
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── models/                   # serialized release artifacts
├── reports/                  # metrics, plots, and experiment summaries
├── configs/
│   ├── default.yaml
│   └── example.env
├── Dockerfile
├── docker-compose.yml        # optional local API + dashboard composition
├── requirements.txt          # or pyproject.toml/uv.lock
├── Makefile                  # test, train, evaluate, run-api, run-dashboard
└── README.md
```

Keep notebooks for exploration only. Production code must call functions in `src/jet_rul` so training and serving share the same feature logic.

---

## 4. Data contract and preprocessing plan

### 4.1 Canonical input schema

The C-MAPSS row should be normalized to:

- `engine_id` — integer identifier
- `cycle` — positive integer, increasing within an engine
- `setting_1`, `setting_2`, `setting_3` — operating settings
- `sensor_1` through `sensor_21` — numeric measurements
- `rul` — training-only target, measured in cycles remaining

Retain the original column names in a mapping file so raw-to-canonical transformations are auditable.

### 4.2 Ingestion and validation

1. Load train/test files with an explicit delimiter and no inferred header.
2. Assign canonical column names and validate column count.
3. Validate types, null counts, duplicate rows, monotonic cycle order, and engine grouping.
4. Identify constant or near-constant sensors separately by dataset variant; do not remove them globally without recording the decision.
5. Persist a validation report containing row counts, engine counts, cycle ranges, nulls, and sensor summary statistics.
6. Fail fast on schema violations; warn on recoverable quality issues.

### 4.3 RUL label generation

For each training engine:

```text
max_cycle(engine) = maximum observed cycle
rul(row) = max_cycle(engine) - cycle(row)
```

If a capped RUL target is used to reduce early-life dominance, make the cap an explicit configuration value and report both raw and capped behavior. The test set requires the provided ground-truth RUL file for evaluation; it must not be reconstructed from test rows alone.

### 4.4 Cleaning and normalization

- Sort by `engine_id`, then `cycle`.
- Preserve the raw data and write cleaned data to a separate location.
- Handle missing values with a documented training-fitted strategy; do not silently forward-fill across engine boundaries.
- Fit scalers only on training engines.
- Store feature names, sensor selection, imputation strategy, scaler parameters, and dataset version in the artifact metadata.
- Treat physically implausible values as validation warnings unless domain limits are explicitly defined for the dataset variant.

---

## 5. Feature engineering plan

### 5.1 Baseline feature set

Start with the latest row per engine containing:

- Current cycle and normalized operating settings
- Selected sensor values after preprocessing
- Engine age proxy: current cycle

This establishes a simple, interpretable baseline.

### 5.2 Temporal feature set

For each engine, calculate features using only rows up to the current cycle:

- Rolling mean and standard deviation over windows such as 3, 5, and 10 cycles
- Difference from the previous cycle and percentage change where numerically safe
- Short-window slope/trend from a linear fit
- Lag values for one and three cycles
- Expanding minimum, maximum, and mean where useful
- Sensor health indicators or selected sensor ratios only when documented and stable

For short histories, use a minimum-period rule and emit a `history_warning`; do not fabricate a full window without documenting the fallback.

### 5.3 Leakage controls

- Group all feature computations by `engine_id`.
- Shift rolling/lag features appropriately when the feature is intended to represent prior behavior.
- Build features before labels only from information available at the prediction cycle.
- Add a test that appends a future row and verifies earlier feature vectors remain unchanged.
- Split by engine before fitting learned preprocessing or tuning hyperparameters.

### 5.4 Feature selection

Use a combination of domain review, missingness/variance checks, correlation inspection, permutation importance, and validation performance. Do not select features using the holdout set.

---

## 6. Modeling and experiment plan

### 6.1 Model sequence

1. **Linear Regression** — sanity-check baseline and feature pipeline.
2. **Random Forest Regressor** — nonlinear ensemble baseline with feature importance.
3. **XGBoost Regressor** — primary tabular candidate; tune conservatively.
4. **LSTM/GRU (optional)** — sequence model using fixed-length windows, introduced only after the tabular pipeline is stable.

### 6.2 Split strategy

- Hold out a final group of engines for testing.
- Use grouped train/validation splits or grouped cross-validation on the remaining engines.
- Keep all rows from an engine in one split.
- Fix and record the random seed.
- If using the official C-MAPSS train/test division, preserve it and use an additional grouped validation split inside training data for tuning.

### 6.3 Training workflow

1. Load validated canonical data.
2. Generate training RUL labels.
3. Split by engine.
4. Fit preprocessing and feature transformations on training engines.
5. Train baseline and candidate models.
6. Tune only against grouped validation metrics.
7. Evaluate the selected configuration once on the untouched test set.
8. Serialize the complete preprocessing-plus-model pipeline.
9. Write metrics, plots, feature schema, configuration, Git commit/version, and training timestamp to `reports/` and `models/`.

### 6.4 Metrics and diagnostics

Primary metrics:

- **MAE:** average absolute cycle error; easy to interpret.
- **RMSE:** penalizes large misses more heavily.

Also report:

- Error by RUL band (early, mid, near-failure)
- Error distribution and worst-case examples
- Actual-versus-predicted scatter plot
- Per-engine degradation plots
- Residuals versus cycle and key sensors
- Optional NASA-style asymmetric scoring only as a supplementary metric, never instead of MAE/RMSE

### 6.5 Model selection rule

Choose the simplest model that meets the quality and latency requirements. Use validation MAE/RMSE as the primary rule, then consider interpretability, artifact size, inference latency, and operational robustness. A deep model is not automatically preferable.

---

## 7. Prediction API design

### 7.1 Endpoint contract

`POST /v1/predict`

Request should contain:

```json
{
  "engine_id": 1,
  "current_cycle": 120,
  "readings": [
    {
      "cycle": 118,
      "setting_1": 0.0,
      "setting_2": 0.0,
      "setting_3": 0.0,
      "sensor_1":  ...,
      "sensor_21": ...
    }
  ]
}
```

Allow a history of readings rather than only a single row because rolling and trend features need context. Define the minimum history and the behavior for incomplete windows in the API schema.

Response should contain:

```json
{
  "engine_id": 1,
  "predicted_rul_cycles": 42.7,
  "maintenance_status": "MONITOR",
  "status_thresholds": {"critical": 15, "monitor": 45},
  "model_version": "xgb-2026-10-02-001",
  "warnings": []
}
```

### 7.2 Status bands

Make thresholds configuration-driven and visible in the response:

- `CRITICAL`: predicted RUL below critical threshold
- `MONITOR`: predicted RUL between critical and monitor thresholds
- `NORMAL`: predicted RUL above monitor threshold

The status is a prioritization aid, not an aircraft release or maintenance authorization.

### 7.3 API controls

- Pydantic request and response models
- Strict numeric and range validation
- Consistent error envelope with field-level details
- `/health` endpoint reporting artifact load status and model version
- `/metadata` endpoint reporting feature schema and training timestamp
- Structured request IDs and latency logs
- No raw sensor payloads in ordinary logs unless explicitly enabled for debugging

---

## 8. Streamlit dashboard plan

### Screens/components

1. **Overview:** model version, validation MAE/RMSE, data version, and safety disclaimer.
2. **Engine input:** engine ID, cycle history upload or sample-engine selector, and validation messages.
3. **RUL prediction:** predicted cycles, status band, thresholds, and warnings.
4. **Sensor trends:** selected sensor time-series charts with current-cycle marker.
5. **Model evaluation:** actual-versus-predicted plot, error by RUL band, and per-engine examples.
6. **Artifact information:** model type, feature count, training timestamp, and configuration summary.

Use the same API or shared prediction module as the serving path. Do not reimplement preprocessing separately in the dashboard.

---

## 9. Persistence, configuration, and deployment

### 9.1 Artifacts

Store each release under a versioned directory:

```text
models/xgb-2026-10-02-001/
├── pipeline.joblib
├── metadata.json
├── feature_schema.json
├── metrics.json
├── config.yaml
└── plots/
```

Use `joblib` for scikit-learn/XGBoost pipelines. Use a framework-native format for an optional LSTM/GRU model, and keep its preprocessing metadata beside it.

### 9.2 Configuration

Centralize:

- Dataset paths and variant name (`FD001`–`FD004`)
- Sensor selection and dropped columns
- RUL cap, if any
- Rolling windows and minimum history
- Split seed and validation fraction
- Model hyperparameters
- Status thresholds
- Artifact path and active model version

Prefer YAML or environment variables; never hard-code deployment secrets.

### 9.3 Deployment stages

**Local development:** Python virtual environment, Make targets, API and dashboard processes.  
**Container:** Docker image for API; separate dashboard container or local process.  
**Production-like:** reverse proxy, health checks, artifact mounted read-only, centralized logs, and a controlled model promotion process.

The first deployment should remain stateless. Prediction history can be added later with PostgreSQL/MongoDB after the core model behavior is validated.

---

## 10. Testing and validation strategy

### Unit tests

- Column mapping and schema checks
- RUL calculation on hand-worked engines
- Sorting and engine-boundary behavior
- Rolling/lag feature calculations
- Missing/short-history handling
- Status-band threshold logic
- API request validation

### Integration tests

- Raw fixture → preprocessing → feature vector → model pipeline
- Serialize and reload artifact, then compare predictions
- FastAPI endpoint with valid and invalid payloads
- Dashboard smoke test using a fixed fixture or mocked API

### Data and leakage tests

- No future cycle can change an earlier prediction feature vector
- No engine appears in more than one split
- Scaler statistics do not include holdout engines
- Test labels are joined only for evaluation, never for prediction input

### Performance tests

- Measure single-request latency and batch throughput
- Test the minimum and maximum supported history lengths
- Verify memory use while loading the artifact

### Release checklist

- Tests pass and coverage is reported for core transformations
- Validation and holdout metrics are saved
- Model card/release notes document limitations
- API and dashboard show the active model version
- Container starts and health check passes
- Safety disclaimer is visible in API documentation and UI

---

## 11. Implementation phases and milestones

| Phase | Work | Deliverable | Exit criteria |
|---|---|---|---|
| 0. Foundation | Repository, dependencies, config, logging, sample fixtures | Runnable project skeleton | `make test` runs; config loads |
| 1. Data contract | Ingestion, schema validation, reports, RUL labels | Validated raw-to-processed data job | Hand-checked RUL and validation report pass |
| 2. EDA | Sensor distributions, constant sensors, engine trajectories | EDA notebook and report plots | Sensor decisions documented |
| 3. Features | Latest-row, rolling, lag, trend features | Reusable feature module | Leakage and boundary tests pass |
| 4. Baselines | Linear Regression and Random Forest | Baseline metrics and plots | Baselines reproducible by seed |
| 5. Candidate model | XGBoost tuning and model selection | Versioned selected pipeline | Grouped validation improves or trade-off documented |
| 6. Evaluation | Official test evaluation and error analysis | Metrics JSON, plots, model card | Holdout evaluated once and archived |
| 7. API | FastAPI schemas, health, predict, metadata routes | Containerized prediction service | Integration tests and health check pass |
| 8. Dashboard | Streamlit screens and charts | Interactive local dashboard | Sample engine can be scored end to end |
| 9. Hardening | Docker, CI checks, docs, artifact promotion | Reproducible release | Clean checkout can train and serve |
| 10. Optional research | LSTM/GRU, drift monitoring, prediction history | Experimental comparison | Added only if tabular limitations justify it |

### Recommended sequencing

Complete Phases 0–5 before investing in deep learning or databases. The highest-risk areas are feature leakage, incorrect RUL labels, and mismatch between training and serving transformations—not the choice of a more complex model.

---

## 12. Key risks and mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Temporal leakage | Inflated validation results | Engine-grouped splits, causal feature tests, pipeline review |
| Incorrect RUL labels | Invalid model target | Hand-calculated fixtures and label audit plots |
| Train/serve skew | Unreliable API predictions | Serialize preprocessing with model; reuse one feature module |
| Sensor noise or redundant sensors | Unstable model | Variance/quality report, documented sensor selection, robust evaluation |
| Overfitting to one C-MAPSS subset | Poor generalization | Evaluate across selected dataset variants where feasible; document scope |
| Short inference history | Missing rolling features | Minimum-history contract, explicit fallback, warning in response |
| Misinterpretation as aviation guidance | Safety risk | Persistent disclaimer, status labels as advisory, no certification claims |
| Artifact/config mismatch | Reproducibility failure | Versioned artifact directory and metadata checks at startup |
| Model drift in real operations | Silent degradation | Future enhancement: monitoring and retraining policy; do not imply C-MAPSS proves live drift behavior |

---

## 13. Recommended first release definition

The first usable release should include:

- One supported C-MAPSS variant, preferably FD001
- Validated ingestion and RUL generation
- Causal rolling/trend features
- Linear, Random Forest, and XGBoost comparison
- Grouped validation plus untouched test evaluation
- Versioned `joblib` pipeline and metrics
- FastAPI `/health`, `/metadata`, and `/v1/predict`
- Streamlit dashboard using sample or uploaded engine history
- Unit, integration, and leakage tests
- README with reproducible commands and the simulated-data disclaimer

Defer LSTM/GRU, external databases, alerting, and production monitoring until the tabular release has stable metrics and a verified serving path.

---

## 14. Suggested development commands

```bash
# install
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# validate and prepare data
python -m jet_rul.data_validation --config configs/default.yaml
python -m jet_rul.rul_labels --config configs/default.yaml

# train and evaluate
python -m jet_rul.train --config configs/default.yaml
python -m jet_rul.evaluate --config configs/default.yaml

# test
pytest -q

# serve
uvicorn api.main:app --host 0.0.0.0 --port 8000
streamlit run dashboard/app.py
```

Adjust module entry points to the final packaging choice; the important requirement is that the same configured feature pipeline is used for training and inference.
