# KrishiSetu DSS

DMS624 · Computer Aided Decision Systems · IIT Kanpur

KrishiSetu demonstrates how a bank can allocate a limited agricultural credit budget while a government agency sets inclusion targets and caps expected losses. A farmer receives an estimate, can track a bank decision, and can appeal. The public demo uses synthetic applicants, illustrative crop parameters and simulated payments.

## Run locally

Use Python 3.11 or 3.12 and Node.js 22. From the repository root:

```sh
python -m venv .venv
# Linux/macOS: source .venv/bin/activate
# Windows PowerShell: .\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
npm ci --prefix frontend
npm run build:static --prefix frontend
python run_server.py
```

Open http://127.0.0.1:8000. The launcher serves the built frontend and FastAPI from one origin. For frontend development run the API and `npm run dev --prefix frontend` in separate terminals. The initial install and static build require network access. Docker builds both layers from source. Render uses the Dockerfile in this branch. A local SQLite database on an ephemeral host can reset on redeploy.

## Five-minute walkthrough

1. Choose **Farmer**. Apply using fictional details. For a high-stress case choose one acre of rainfed wheat, no livestock, no insurance and a ₹50,000 request. The baseline scenario recommends ₹31,200 and a bank review. The wallet stays empty. A second case with two acres, drip irrigation, four dairy animals, a different plot and a ₹9,000 request illustrates the allocation path.
2. Choose the lending bank from **Demo bank**, then **Bank officer**. The dossier shows requested credit, recommended credit and the repayment outlook. A documented review can release an application into the eligible pool or reject it. Review does not issue money.
3. Open **Portfolio Optimizer** and use the published policy. Compare the equitable portfolio with the bank-return baseline. Changing a policy slider creates a what-if result. Use **Use latest policy** to restore the published parameters. A saved allocation can be committed once and only by its bank; if policy or an application changes, rerun the optimizer. The budget is per allocation run.
4. Return to **Farmer → Decision**. A partially approved loan shows the requested, recommended and sanctioned amounts separately. The wallet simulates a 60% input voucher, a 30% operations credit and a 10% reserve. The QR encodes a demo identifier. Recording a photo and device coordinates releases the simulated reserve. This records evidence, without authenticating the crop or triggering an actual payment or interest rebate.
5. Open **Government auditor → Policy Levers** and publish a change. The next bank allocation uses the new version. The government dashboard compares district and bank outcomes against the published batch target. A farmer can attach evidence to an appeal. After seven days an open appeal enters the tribunal; a directive returns an undecided or rejected application to review. A background sweep runs once per minute while the service is awake. Queue reads also catch up after downtime.

## Data and model evidence

| Input or result | Implementation and provenance |
|---|---|
| Borrower inputs | The included SBI PM-KISAN form separates outstanding debt from overdues and records tenure and Khasra number. The Axis form supplies irrigation, market access and marketing arrangements. BOI AG-100 section N gives net worth as movable plus immovable assets minus liabilities. Intake snapshots preserve what the applicant declared for each new application. |
| Crop prices, yields, finance limits and allied income | See `backend/data/icrisat_msp_sof.json` and `backend/models/forecast_model.py`. Rupee prices are per quintal, yields in tonnes per acre and scale of finance in rupees per acre. Values are scenario inputs. The original dataset provided no district notification or source-table identifiers. Local government and bank notices should be sourced before substituting field values. The official price series is available from the [Economics, Statistics & Evaluation Division](https://desagri.gov.in/notifications/). |
| Weather and coverage | Open-Meteo provides the 14-day forecast when available. The response identifies its source. A cached district baseline supports offline demos. Set `KRISHISETU_OFFLINE_WEATHER=1` to reproduce the baseline. DSCR divides modeled cash available after expenses by principal plus modeled interest. The drought scenario, household income and insurance payout are assumptions. |
| Credit risk | A deterministic generator creates 1,500 labeled synthetic profiles. The XGBoost and logistic models fit 1,200 profiles. The other 300 supply ROC AUC and Brier score in **Data and model evidence**. The blended and clipped model probability is evaluated on the holdout. Tree SHAP contributions are in log-odds. These scores have no field repayment validation. Historical dossiers retain their original stored evaluations. |
| Portfolio | SciPy MILP selects eligible pending applications from the officer’s bank. It checks budget, SMF share, weaker-section share, expected-loss cap and guarantee budget. Infeasible funding of any applicant yields ₹0. Failed solvers cannot commit. Portfolio net expected loss uses exposure-weighted PD × LGD after guarantee. The 55.6% default SMF batch target is a scenario inspired by bank-level lending targets. The regulatory denominator differs from a batch of agricultural loans. See the [RBI directions](https://www.rbi.org.in/scripts/BS_ViewMasDirections.aspx?id=12799). |

## Accounts, persistence and verification

SQLite is the default. `KRISHISETU_DB_PATH` selects a separate local database. For a persistent PostgreSQL deployment, initialize `supabase/schema.sql`, configure `DATABASE_URL` with a server-only database owner connection, and start the launcher. It adds the workflow tables without resetting existing applications.

Demo logins deliberately allow visitors to select fictional roles. Use an isolated synthetic database for a public demo. For a private instance use `KRISHISETU_DEMO=0`, Supabase URL and key, and provision roles by linking `users_and_roles.auth_uid` to a Supabase user. Link farmer profiles through `user_id`; for officers set `branch_or_dept` to the exact assigned bank name. The server issues four-hour sessions and checks both role and record ownership. Evidence is served through authenticated API requests. Older public storage objects, if any, must be reviewed separately when migrating a previous deployment.

```sh
python test_app.py              # isolated SQLite regression suite; leave DATABASE_URL unset
python e2e_verify_live.py       # smoke check against a running local demo
npm run lint --prefix frontend  # TypeScript
```

The regression suite exercises stressed and eligible applications, repeat submissions, net worth, loan history, policy changes, stale and repeated allocation commits, vouchers, private evidence and overdue appeals. The files uploaded for the course contain planning notes and bank forms. Confirm submission deliverables against the instructor’s original rubric.
