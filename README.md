# Ghost Data Still Exists — Local Web Dashboard

A read-only dashboard for reviewing generated `output.csv` alongside `dataset/deletion_requests.csv`. It uses Python's standard library only—no Flask install, no API key, and no paid API. It does not change the HackerRank output schema or perform real deletion/remediation actions.

## Run on Windows

From the repository root in VS Code Terminal:

```powershell
python code/main.py
python web_dashboard/app.py
```

Open `http://127.0.0.1:5000` in your browser. Keep the terminal window open while using the dashboard. Press `Ctrl+C` in the terminal to stop it.

The dashboard reads `output.csv` and `dataset/deletion_requests.csv` from the repository root. It listens only on `127.0.0.1`, so it is not published to the internet.

## Features

- Summary cards for total requests and each deletion status.
- Outcome distribution chart and evidence/action signal counts.
- Search by case ID, email, or reported status; filter by status.
- Case details with request timestamps and ordered steps including evidence IDs.
- Download generated `output.csv`.

**Interpretation note:** counts describe the current generated output. Structural validation does not prove that every classification matches the challenge's hidden canonical answer. Proposed remediation steps are plans, not executed deletions.
