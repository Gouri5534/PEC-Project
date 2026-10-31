# Run the full project and web dashboard (Windows / VS Code)

1. Extract the full project ZIP.
2. In VS Code, open the folder `hackerrank-orchestrate-october26-main` (the folder containing `code`, `dataset`, and `output.csv`).
3. Open **Terminal → New Terminal**.
4. Generate the challenge output:

   ```powershell
   python code/main.py
   ```

5. Validate output structure:

   ```powershell
   python code/evaluation/main.py
   ```

6. Start the local web page:

   ```powershell
   python web_dashboard/app.py
   ```

7. Open `http://127.0.0.1:5000` in Chrome or Edge.
8. To stop the web server, return to the terminal and press `Ctrl+C`.

No extra package installation is needed. The dashboard uses Python's standard library. Keep the terminal open while viewing the dashboard. It is a local read-only review page; it does not execute deletion actions or guarantee hidden-test accuracy.
