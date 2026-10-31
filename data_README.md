# Real NASA C-MAPSS data

The dashboard can be populated from the public Kaggle dataset:

- Kaggle reference: `behrad3d/nasa-cmaps`
- Dataset title: NASA Turbofan Jet Engine Data Set
- Contents: FD001–FD004 train/test trajectories and RUL labels
- License shown by Kaggle: CC0: Public Domain

Raw files are downloaded and cached by `kagglehub`; they are intentionally not committed to this repository. Run:

```bash
python3 -m pip install -r requirements-data.txt
python3 scripts/prepare_cmapss.py --variant FD001
```

This creates `public/data/cmapss-summary.json`, which contains derived fleet rows, the selected engine history, channel statistics, and test-split MAE/RMSE from a reproducible Random Forest baseline. The browser reads that JSON at startup. The UI continues to render its layout if the file is absent, but real-data mode is enabled only after this preparation step completes.

If Kaggle asks for authentication, configure Kaggle credentials according to Kaggle's official API instructions, then rerun the command. Never commit `kaggle.json`, API tokens, raw archives, or private credentials.
