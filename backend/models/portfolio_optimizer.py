"""
KrishiSetu DSS - Constrained Portfolio Optimizer (Solving the Govt vs. Bank Conflict)
Mixed-Integer Linear Programming (MILP) Formulation
Resolves the conflict:
- Bank wants to minimize NPA risk and maximize expected financial returns.
- Government mandates 10% SMF sub-target (>= 55.6% of Agri PSL), Weaker Section floor, and farmer equity.
- Government First-Loss Default Guarantee (FLDG) gamma in [0, 0.75] cushions bank risk.

Formulation:
max sum x_i * (w1 * EquityScore_i + w2 * ExpectedReturn_i - w3 * PD_i * LGD_i^net * L_i)
s.t.
1. sum L_i * x_i <= X (Total Fund Budget)
2. sum_{i in SMF} L_i * x_i >= alpha * sum L_i * x_i (RBI SMF Quota, alpha >= 55.6%)
3. sum_{i in Weaker} L_i * x_i >= beta * sum L_i * x_i (Weaker Section Floor)
4. (sum PD_i * LGD_i^net * L_i * x_i) / (sum L_i * x_i) <= MaxNPA_bank (Portfolio Risk Cap)
5. sum_{i in SMF} gamma * PD_i * LGD_i * L_i * x_i <= G_govt (Govt Guarantee Budget)
"""

from typing import List, Dict, Any, Tuple
import numpy as np
from scipy.optimize import milp, LinearConstraint, Bounds

def optimize_portfolio(
    applications: List[Dict[str, Any]],
    total_fund_budget: float = 5000000.0, # ₹50 Lakh default batch
    smf_quota_alpha: float = 0.556,       # RBI 10% SMF / 18% total agri = 55.6%
    weaker_floor_beta: float = 0.25,      # 25% to Weaker Sections
    bank_max_npa_ceiling: float = 0.040,  # 4.0% maximum acceptable portfolio NPA
    govt_fldg_gamma: float = 0.35,        # 35% Govt First-Loss Default Guarantee
    govt_guarantee_budget: float = 800000.0, # ₹8 Lakh FLDG pool
    weights: Dict[str, float] = None
) -> Dict[str, Any]:
    """
    Executes the MILP Constrained Portfolio Optimization.
    Also computes the unconstrained "Pure Profit Allocation" to show the Bank vs Govt contrast.
    """
    if weights is None:
        weights = {"equity": 0.45, "return": 0.30, "risk_penalty": 0.25}

    n = len(applications)
    if n == 0:
        empty_bucket = {
            "total_disbursed": 0.0,
            "smf_share_pct": 0.0,
            "weaker_share_pct": 0.0,
            "portfolio_npa_pct": 0.0,
            "govt_guarantee_utilized": 0.0,
            "smf_farmers_served": 0,
            "total_farmers_served": 0,
            "rbi_smf_quota_met": False,
            "bank_npa_ceiling_met": True,
        }
        return {
            "status": "EMPTY",
            "dss_allocated_ids": [],
            "pure_profit_ids": [],
            "total_applicants": 0,
            "dss_approved_count": 0,
            "pure_profit_approved_count": 0,
            "metrics": {
                "equitable_dss": empty_bucket,
                "pure_profit": empty_bucket,
                "welfare_delta": {
                    "additional_marginal_farmers_helped": 0,
                    "smf_capital_increase_rupees": 0.0,
                    "bank_risk_neutralized_by_fldg": 0.0,
                },
            },
        }

    L = np.zeros(n)              # Loan amounts requested/sanctioned
    equity_scores = np.zeros(n)  # Equity scores
    pd_arr = np.zeros(n)         # Probability of Default
    lgd_arr = np.zeros(n)        # Loss Given Default
    is_smf = np.zeros(n)         # Binary indicator for SMF
    is_weaker = np.zeros(n)      # Binary indicator for Weaker section
    app_ids = []

    for i, app in enumerate(applications):
        app_ids.append(app["id"])
        L[i] = float(app.get("sanctioned_amount", app.get("requested_amount", 50000.0)))
        equity_scores[i] = float(app.get("equity_priority_score", 50.0))
        pd_arr[i] = float(app.get("pd_score", 0.08))
        lgd_arr[i] = float(app.get("lgd_score", 0.50))
        
        # Check SMF
        cat = app.get("farmer_classification", "Marginal")
        is_smf[i] = 1.0 if cat in ["Marginal", "Small"] else 0.0

        # Check Weaker
        soc = app.get("social_category", "GEN")
        is_weaker[i] = 1.0 if (soc in ["SC", "ST", "Women", "PWD", "Minority"] or is_smf[i] == 1.0) else 0.0

    # Net LGD with Govt FLDG: LGD^net = LGD * (1 - gamma * 1_{SMF})
    lgd_net = lgd_arr * (1.0 - govt_fldg_gamma * is_smf)

    # Expected Return: interest margin (~4% spread) minus servicing cost (1%)
    expected_return_rate = 0.03
    expected_return_rupees = L * expected_return_rate

    # Risk in Rupees: PD * LGD_net * L
    net_expected_loss_rupees = pd_arr * lgd_net * L

    # Objective Function Coefficients (c^T x to MAXIMIZE, so we minimize -c)
    # Objective = w1 * (EquityScore / 100 * L) + w2 * ExpectedReturn - w3 * NetLoss
    obj_coeffs = (
        weights["equity"] * (equity_scores / 100.0 * L) +
        weights["return"] * expected_return_rupees -
        weights["risk_penalty"] * net_expected_loss_rupees
    )
    c = -obj_coeffs # Scipy minimizes c^T x

    # -------------------------------------------------------------------------
    # Setup Constraints for Scipy MILP / Linprog
    # -------------------------------------------------------------------------
    # 1. Budget Constraint: sum L_i * x_i <= X
    # 2. SMF Quota: sum_{SMF} L_i * x_i >= alpha * sum L_i * x_i  ==>  sum ( (1-alpha)*L_i for SMF, -alpha*L_i for others ) * x_i >= 0
    # 3. Weaker Floor: sum_{Weaker} L_i * x_i >= beta * sum L_i * x_i ==> sum ( (1-beta)*L_i for Weaker, -beta*L_i for others ) * x_i >= 0
    # 4. Bank NPA Ceiling: sum (PD_i * LGD_i^net - MaxNPA) * L_i * x_i <= 0
    # 5. Govt Guarantee Cap: sum (gamma * PD_i * LGD_i * L_i * 1_{SMF}) * x_i <= G_govt

    smf_coeffs = np.where(is_smf == 1.0, (1.0 - smf_quota_alpha) * L, -smf_quota_alpha * L)
    weaker_coeffs = np.where(is_weaker == 1.0, (1.0 - weaker_floor_beta) * L, -weaker_floor_beta * L)
    npa_risk_coeffs = (pd_arr * lgd_net - bank_max_npa_ceiling) * L
    govt_guar_coeffs = govt_fldg_gamma * pd_arr * lgd_arr * L * is_smf

    # Constraint matrix A_ub @ x <= b_ub
    A_ub = [
        L,                  # <= total_fund_budget
        -smf_coeffs,        # <= 0  (since smf_coeffs >= 0)
        -weaker_coeffs,     # <= 0  (since weaker_coeffs >= 0)
        npa_risk_coeffs,    # <= 0  (npa risk within cap)
        govt_guar_coeffs    # <= govt_guarantee_budget
    ]
    b_ub = [
        total_fund_budget,
        0.0,
        0.0,
        0.0,
        govt_guarantee_budget
    ]

    # Decision variables x_i in {0, 1}
    integrality = np.ones(n) # binary variables
    bounds = Bounds(0.0, 1.0)

    def solve(objective, matrix, limits):
        try:
            result = milp(c=objective, integrality=integrality, bounds=bounds,
                          constraints=LinearConstraint(matrix, -np.inf, limits))
        except (ValueError, RuntimeError):
            return np.zeros(n), False
        if not result.success or result.x is None:
            return np.zeros(n), False
        selected = np.rint(result.x)
        valid = (np.all((selected == 0) | (selected == 1)) and
                 np.all(np.asarray(matrix) @ selected <= np.asarray(limits) + 1e-6))
        return (selected, True) if valid else (np.zeros(n), False)

    x_dss, solved = solve(c, A_ub, b_ub)
    x_profit, baseline_solved = solve(-(expected_return_rupees - 1.5 * pd_arr * lgd_arr * L),
                                      [L], [total_fund_budget])

    # Compute Comparison Metrics
    # -------------------------------------------------------------------------
    dss_indices = [i for i in range(n) if x_dss[i] > 0.5]
    profit_indices = [i for i in range(n) if x_profit[i] > 0.5]

    metrics = _compute_allocation_metrics(
        x_dss, x_profit, L, is_smf, is_weaker, pd_arr, lgd_net, lgd_arr,
        govt_fldg_gamma, total_fund_budget, smf_quota_alpha, bank_max_npa_ceiling
    )

    return {
        "status": ("OPTIMAL" if dss_indices else "NO_ALLOCATION") if solved else "SOLVER_ERROR",
        "baseline_status": "OPTIMAL" if baseline_solved else "SOLVER_ERROR",
        "dss_allocated_ids": [app_ids[i] for i in dss_indices],
        "pure_profit_ids": [app_ids[i] for i in profit_indices],
        "total_applicants": n,
        "dss_approved_count": len(dss_indices),
        "pure_profit_approved_count": len(profit_indices),
        "parameters_used": {
            "total_fund_budget": total_fund_budget,
            "smf_quota_alpha_pct": round(smf_quota_alpha * 100, 1),
            "bank_max_npa_ceiling_pct": round(bank_max_npa_ceiling * 100, 2),
            "govt_fldg_gamma_pct": round(govt_fldg_gamma * 100, 1)
        },
        "metrics": metrics
    }

def _compute_allocation_metrics(
    x_dss, x_profit, L, is_smf, is_weaker, pd_arr, lgd_net, lgd_arr,
    gamma, total_budget, smf_alpha, npa_cap
) -> Dict[str, Any]:
    # DSS Metrics
    dss_total_loan = float(np.sum(L * x_dss))
    dss_smf_loan = float(np.sum(L * x_dss * is_smf))
    dss_smf_pct = (dss_smf_loan / (dss_total_loan or 1.0)) * 100.0
    dss_weaker_loan = float(np.sum(L * x_dss * is_weaker))
    dss_weaker_pct = (dss_weaker_loan / (dss_total_loan or 1.0)) * 100.0
    dss_net_npa = (float(np.sum(pd_arr * lgd_net * L * x_dss)) / (dss_total_loan or 1.0)) * 100.0
    dss_govt_guarantee_payout = float(np.sum(gamma * pd_arr * lgd_arr * L * is_smf * x_dss))
    dss_smf_farmers_count = int(np.sum(x_dss * is_smf))
    dss_total_farmers_count = int(np.sum(x_dss))

    # Pure Profit Metrics
    prof_total_loan = float(np.sum(L * x_profit))
    prof_smf_loan = float(np.sum(L * x_profit * is_smf))
    prof_smf_pct = (prof_smf_loan / (prof_total_loan or 1.0)) * 100.0
    prof_weaker_loan = float(np.sum(L * x_profit * is_weaker))
    prof_weaker_pct = (prof_weaker_loan / (prof_total_loan or 1.0)) * 100.0
    prof_net_npa = (float(np.sum(pd_arr * lgd_arr * L * x_profit)) / (prof_total_loan or 1.0)) * 100.0
    prof_smf_farmers_count = int(np.sum(x_profit * is_smf))
    prof_total_farmers_count = int(np.sum(x_profit))

    return {
        "equitable_dss": {
            "total_disbursed": round(dss_total_loan, 2),
            "smf_share_pct": round(dss_smf_pct, 1),
            "weaker_share_pct": round(dss_weaker_pct, 1),
            "portfolio_npa_pct": round(dss_net_npa, 2),
            "govt_guarantee_utilized": round(dss_govt_guarantee_payout, 2),
            "smf_farmers_served": dss_smf_farmers_count,
            "total_farmers_served": dss_total_farmers_count,
            "rbi_smf_quota_met": dss_smf_pct >= (smf_alpha * 100.0),
            "bank_npa_ceiling_met": dss_net_npa <= (npa_cap * 100.0)
        },
        "pure_profit": {
            "total_disbursed": round(prof_total_loan, 2),
            "smf_share_pct": round(prof_smf_pct, 1),
            "weaker_share_pct": round(prof_weaker_pct, 1),
            "portfolio_npa_pct": round(prof_net_npa, 2),
            "govt_guarantee_utilized": 0.0,
            "smf_farmers_served": prof_smf_farmers_count,
            "total_farmers_served": prof_total_farmers_count,
            "rbi_smf_quota_met": prof_smf_pct >= (smf_alpha * 100.0),
            "bank_npa_ceiling_met": prof_net_npa <= (npa_cap * 100.0)
        },
        "welfare_delta": {
            "additional_marginal_farmers_helped": dss_smf_farmers_count - prof_smf_farmers_count,
            "smf_capital_increase_rupees": round(dss_smf_loan - prof_smf_loan, 2),
            "bank_risk_neutralized_by_fldg": round(dss_govt_guarantee_payout, 2)
        }
    }
