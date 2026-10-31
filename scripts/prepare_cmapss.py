#!/usr/bin/env python3
"""Download Kaggle NASA C-MAPSS data, train a compact baseline, and export dashboard JSON.

The raw Kaggle archive is cached by kagglehub outside the repository. Only the
small, derived public/data/cmapss-summary.json is written into this project.
"""
from __future__ import annotations

import argparse
import json
import math
import os
from pathlib import Path
from typing import Iterable

import kagglehub
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

DATASET_REF = "behrad3d/nasa-cmaps"
DEFAULT_VARIANT = "FD001"
BASE_COLUMNS = ["engine_id", "cycle", "setting_1", "setting_2", "setting_3"]
SENSOR_COLUMNS = [f"sensor_{i}" for i in range(1, 27)]
ALL_COLUMNS = BASE_COLUMNS + SENSOR_COLUMNS


def read_cmapss(path: Path) -> pd.DataFrame:
    frame = pd.read_csv(path, sep=r"\s+", header=None, names=ALL_COLUMNS, engine="python")
    return frame.dropna(axis=1, how="all")


def find_file(root: Path, filename: str) -> Path:
    matches = list(root.rglob(filename))
    if not matches:
        raise FileNotFoundError(f"Could not find {filename} below {root}")
    return matches[0]


def add_rul(frame: pd.DataFrame) -> pd.DataFrame:
    result = frame.copy()
    max_cycles = result.groupby("engine_id")["cycle"].transform("max")
    result["rul"] = max_cycles - result["cycle"]
    return result


def feature_frame(frame: pd.DataFrame) -> pd.DataFrame:
    """Use current-cycle values plus causal rolling means for a compact baseline."""
    result = frame.sort_values(["engine_id", "cycle"]).copy()
    sensor_cols = [column for column in SENSOR_COLUMNS if column in result.columns]
    for column in sensor_cols:
        result[f"{column}_roll5"] = result.groupby("engine_id")[column].transform(
            lambda values: values.rolling(5, min_periods=1).mean()
        )
    return result


def model_columns(frame: pd.DataFrame) -> list[str]:
    return [column for column in frame.columns if column not in {"engine_id", "rul"}]


def latest_rows(frame: pd.DataFrame) -> pd.DataFrame:
    return frame.sort_values("cycle").groupby("engine_id", as_index=False).tail(1).sort_values("engine_id")


def safe_float(value: object) -> float | None:
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    return round(float(value), 5)


def status_for(rul: float) -> str:
    if rul < 15:
        return "CRITICAL"
    if rul < 45:
        return "MONITOR"
    return "NORMAL"


def chart_history(frame: pd.DataFrame, engine_id: int, limit: int = 48) -> list[dict[str, float]]:
    rows = frame[frame.engine_id == engine_id].sort_values("cycle").tail(limit)
    preferred = ["sensor_2", "sensor_3", "sensor_4", "sensor_11"]
    available = [column for column in preferred if column in rows.columns]
    return [
        {"cycle": int(row["cycle"]), **{column: safe_float(row[column]) for column in available}}
        for _, row in rows.iterrows()
    ]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--variant", default=os.getenv("CMAPSS_VARIANT", DEFAULT_VARIANT), choices=["FD001", "FD002", "FD003", "FD004"])
    parser.add_argument("--output", type=Path, default=Path("public/data/cmapss-summary.json"))
    args = parser.parse_args()

    print(f"Downloading or reusing Kaggle dataset: {DATASET_REF}")
    dataset_root = Path(kagglehub.dataset_download(DATASET_REF))
    train_path = find_file(dataset_root, f"train_{args.variant}.txt")
    test_path = find_file(dataset_root, f"test_{args.variant}.txt")
    rul_path = find_file(dataset_root, f"RUL_{args.variant}.txt")

    train = add_rul(feature_frame(read_cmapss(train_path)))
    test = feature_frame(read_cmapss(test_path))
    ground_truth = pd.read_csv(rul_path, header=None, names=["rul"])
    test_latest = latest_rows(test).reset_index(drop=True)
    test_latest["rul"] = ground_truth["rul"].astype(float).to_numpy()

    features = model_columns(train)
    model = make_pipeline(
        StandardScaler(),
        RandomForestRegressor(n_estimators=160, random_state=42, min_samples_leaf=2, n_jobs=-1),
    )
    model.fit(train[features], train["rul"])
    predictions = np.maximum(model.predict(test_latest[features]), 0)
    mae = mean_absolute_error(test_latest["rul"], predictions)
    rmse = mean_squared_error(test_latest["rul"], predictions) ** 0.5

    fleet = []
    for index, row in test_latest.iterrows():
        predicted = float(predictions[index])
        fleet.append(
            {
                "engine_id": int(row.engine_id),
                "current_cycle": int(row.cycle),
                "predicted_rul": round(predicted, 1),
                "benchmark_rul": round(float(row.rul), 1),
                "status": status_for(predicted),
            }
        )

    selected = test_latest.iloc[0]
    selected_id = int(selected.engine_id)
    selected_prediction = float(predictions[0])
    channel_stats = {
        column: {
            "min": safe_float(train[column].min()),
            "max": safe_float(train[column].max()),
            "mean": safe_float(train[column].mean()),
        }
        for column in SENSOR_COLUMNS
        if column in train.columns
    }
    summary = {
        "source": {
            "provider": "Kaggle",
            "dataset_ref": DATASET_REF,
            "license": "CC0: Public Domain",
            "description": "NASA C-MAPSS turbofan run-to-failure simulation dataset",
        },
        "variant": args.variant,
        "generated_at_utc": pd.Timestamp.now("UTC").isoformat(),
        "stats": {
            "train_rows": int(len(train)),
            "test_rows": int(len(test)),
            "train_engines": int(train.engine_id.nunique()),
            "test_engines": int(test.engine_id.nunique()),
            "sensor_channels": len([column for column in SENSOR_COLUMNS if column in train.columns]),
            "mae": round(float(mae), 2),
            "rmse": round(float(rmse), 2),
        },
        "model": {
            "name": "RandomForestRegressor",
            "features": len(features),
            "seed": 42,
            "evaluation": "Official C-MAPSS test split with provided RUL labels",
        },
        "selected_engine": {
            "engine_id": selected_id,
            "current_cycle": int(selected.cycle),
            "predicted_rul": round(selected_prediction, 1),
            "benchmark_rul": round(float(selected.rul), 1),
            "status": status_for(selected_prediction),
            "history": chart_history(test, selected_id),
        },
        "fleet": fleet,
        "channel_stats": channel_stats,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps({"output": str(args.output), "variant": args.variant, "mae": round(float(mae), 2), "rmse": round(float(rmse), 2), "engines": len(fleet)}, indent=2))


if __name__ == "__main__":
    main()
