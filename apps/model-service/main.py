from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import joblib
from pathlib import Path
import pandas as pd

MODEL_PATH = Path(__file__).parent / "catboost_no_sat.pkl"
PREPROCESSOR_PATH = Path(__file__).parent / "preprocessor_no_sat.pkl"

model = None
preprocessor = None

if MODEL_PATH.exists() and PREPROCESSOR_PATH.exists():
    try:
        model = joblib.load(MODEL_PATH)
        preprocessor = joblib.load(PREPROCESSOR_PATH)
    except Exception as e:
        print(f"Warning: Could not load pickle files: {e}")

app = FastAPI(
    title="Customer Churn ML Model Service",
    description="Microservice serving Machine Learning churn predictions and risk evaluations.",
    version="0.1.0"
)

class CustomerFeatures(BaseModel):
    customer_id: Optional[str] = None

    gender: str = "Male"
    age: int = 30
    under_30: str = "No"
    senior_citizen: str = "No"
    married: str = "No"
    dependents: str = "No"
    number_of_dependents: int = 0

    latitude: float = 34.0
    longitude: float = -118.0

    referred_a_friend: str = "No"
    number_of_referrals: int = 0
    tenure_in_months: int = 12
    offer: Optional[str] = "None"

    phone_service: str = "Yes"
    avg_monthly_long_distance_charges: float = 0.0
    multiple_lines: str = "No"

    internet_service: str = "Yes"
    internet_type: str = "Fiber Optic"
    avg_monthly_gb_download: int = 20

    online_security: str = "No"
    online_backup: str = "No"
    device_protection_plan: str = "No"
    premium_tech_support: str = "No"
    streaming_tv: str = "No"
    streaming_movies: str = "No"
    streaming_music: str = "No"

    unlimited_data: str = "Yes"
    contract: str = "Month-to-Month"
    paperless_billing: str = "Yes"
    payment_method: str = "Bank Withdrawal"

    monthly_charge: float = 65.0
    total_charges: float = 780.0
    total_refunds: float = 0.0
    total_extra_data_charges: float = 0.0
    total_long_distance_charges: float = 0.0
    total_revenue: float = 780.0

    population: int = 50000

class PredictionResponse(BaseModel):
    churn_probability: float
    risk_band: str
    decision: str
    recommended_action: str
    priority: str

def make_decision(
    churn_probability: float,
    contract: str,
    tenure_in_months: int,
    monthly_charge: float
) -> dict:
    if churn_probability < 0.30:
        return {
            "decision": "No immediate action",
            "recommended_action": "Continue normal customer engagement",
            "priority": "Low"
        }
    elif churn_probability < 0.60:
        if tenure_in_months <= 6:
            action = "Early-tenure engagement and onboarding support"
        elif monthly_charge >= 80:
            action = "Review pricing and plan suitability"
        else:
            action = "Targeted engagement and monitoring"
        return {
            "decision": "Monitor customer",
            "recommended_action": action,
            "priority": "Medium"
        }
    else:
        if contract.lower().startswith("month"):
            action = "Offer contract upgrade or retention incentive"
        elif tenure_in_months <= 6:
            action = "Provide onboarding support and retention offer"
        elif monthly_charge >= 80:
            action = "Offer personalized pricing or plan review"
        else:
            action = "Priority customer retention intervention"
        return {
            "decision": "Retention intervention",
            "recommended_action": action,
            "priority": "High"
        }

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "model-service", "model_loaded": model is not None}

def compute_fallback_prob(f: CustomerFeatures) -> float:
    c = (f.contract or "").lower()
    m = f.monthly_charge
    t = f.tenure_in_months

    if "month" in c and m > 75:
        return 0.78
    elif "month" in c:
        return 0.45
    elif t < 12 and m > 60:
        return 0.55
    else:
        return 0.18

@app.post("/predict", response_model=PredictionResponse)
def predict_churn(features: CustomerFeatures):
    try:
        if model is not None and preprocessor is not None:
            customer_data = pd.DataFrame([{
                "Gender": features.gender,
                "Age": features.age,
                "Under 30": features.under_30,
                "Senior Citizen": features.senior_citizen,
                "Married": features.married,
                "Dependents": features.dependents,
                "Number of Dependents": features.number_of_dependents,
                "Latitude": features.latitude,
                "Longitude": features.longitude,
                "Referred a Friend": features.referred_a_friend,
                "Number of Referrals": features.number_of_referrals,
                "Tenure in Months": features.tenure_in_months,
                "Offer": features.offer,
                "Phone Service": features.phone_service,
                "Avg Monthly Long Distance Charges": features.avg_monthly_long_distance_charges,
                "Multiple Lines": features.multiple_lines,
                "Internet Service": features.internet_service,
                "Internet Type": features.internet_type,
                "Avg Monthly GB Download": features.avg_monthly_gb_download,
                "Online Security": features.online_security,
                "Online Backup": features.online_backup,
                "Device Protection Plan": features.device_protection_plan,
                "Premium Tech Support": features.premium_tech_support,
                "Streaming TV": features.streaming_tv,
                "Streaming Movies": features.streaming_movies,
                "Streaming Music": features.streaming_music,
                "Unlimited Data": features.unlimited_data,
                "Contract": features.contract,
                "Paperless Billing": features.paperless_billing,
                "Payment Method": features.payment_method,
                "Monthly Charge": features.monthly_charge,
                "Total Charges": features.total_charges,
                "Total Refunds": features.total_refunds,
                "Total Extra Data Charges": features.total_extra_data_charges,
                "Total Long Distance Charges": features.total_long_distance_charges,
                "Total Revenue": features.total_revenue,
                "Population": features.population,
            }])

            customer_data["Gender"] = customer_data["Gender"].map({"Male": 1, "Female": 0}).fillna(1)

            binary_columns = [
                "Under 30", "Senior Citizen", "Married", "Dependents", "Referred a Friend",
                "Phone Service", "Multiple Lines", "Internet Service", "Online Security",
                "Online Backup", "Device Protection Plan", "Premium Tech Support",
                "Streaming TV", "Streaming Movies", "Streaming Music", "Unlimited Data",
                "Paperless Billing"
            ]

            for column in binary_columns:
                customer_data[column] = customer_data[column].map({"Yes": 1, "No": 0}).fillna(0)

            processed_data = preprocessor.transform(customer_data)
            churn_probability = float(model.predict_proba(processed_data)[0, 1])
        else:
            churn_probability = compute_fallback_prob(features)

        if churn_probability >= 0.6:
            risk_band = "High"
        elif churn_probability >= 0.3:
            risk_band = "Medium"
        else:
            risk_band = "Low"

        decision = make_decision(
            churn_probability=churn_probability,
            contract=features.contract,
            tenure_in_months=features.tenure_in_months,
            monthly_charge=features.monthly_charge
        )

        return PredictionResponse(
            churn_probability=churn_probability,
            risk_band=risk_band,
            decision=decision["decision"],
            recommended_action=decision["recommended_action"],
            priority=decision["priority"]
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(e)}"
        )

def process_features_df(items: List[CustomerFeatures]) -> pd.DataFrame:
    rows = []
    for f in items:
        rows.append({
            "Gender": f.gender,
            "Age": f.age,
            "Under 30": f.under_30,
            "Senior Citizen": f.senior_citizen,
            "Married": f.married,
            "Dependents": f.dependents,
            "Number of Dependents": f.number_of_dependents,
            "Latitude": f.latitude,
            "Longitude": f.longitude,
            "Referred a Friend": f.referred_a_friend,
            "Number of Referrals": f.number_of_referrals,
            "Tenure in Months": f.tenure_in_months,
            "Offer": f.offer,
            "Phone Service": f.phone_service,
            "Avg Monthly Long Distance Charges": f.avg_monthly_long_distance_charges,
            "Multiple Lines": f.multiple_lines,
            "Internet Service": f.internet_service,
            "Internet Type": f.internet_type,
            "Avg Monthly GB Download": f.avg_monthly_gb_download,
            "Online Security": f.online_security,
            "Online Backup": f.online_backup,
            "Device Protection Plan": f.device_protection_plan,
            "Premium Tech Support": f.premium_tech_support,
            "Streaming TV": f.streaming_tv,
            "Streaming Movies": f.streaming_movies,
            "Streaming Music": f.streaming_music,
            "Unlimited Data": f.unlimited_data,
            "Contract": f.contract,
            "Paperless Billing": f.paperless_billing,
            "Payment Method": f.payment_method,
            "Monthly Charge": f.monthly_charge,
            "Total Charges": f.total_charges,
            "Total Refunds": f.total_refunds,
            "Total Extra Data Charges": f.total_extra_data_charges,
            "Total Long Distance Charges": f.total_long_distance_charges,
            "Total Revenue": f.total_revenue,
            "Population": f.population,
        })

    customer_data = pd.DataFrame(rows)
    customer_data["Gender"] = customer_data["Gender"].map({"Male": 1, "Female": 0}).fillna(1)

    binary_columns = [
        "Under 30", "Senior Citizen", "Married", "Dependents", "Referred a Friend",
        "Phone Service", "Multiple Lines", "Internet Service", "Online Security",
        "Online Backup", "Device Protection Plan", "Premium Tech Support",
        "Streaming TV", "Streaming Movies", "Streaming Music", "Unlimited Data",
        "Paperless Billing"
    ]
    for col in binary_columns:
        customer_data[col] = customer_data[col].map({"Yes": 1, "No": 0}).fillna(0)

    return customer_data

@app.post("/predict-batch", response_model=List[PredictionResponse])
def predict_churn_batch(features_list: List[CustomerFeatures]):
    try:
        if not features_list:
            return []

        results = []

        if model is not None and preprocessor is not None:
            customer_data = process_features_df(features_list)
            processed_data = preprocessor.transform(customer_data)
            probs = model.predict_proba(processed_data)[:, 1]

            for i, f in enumerate(features_list):
                prob = float(probs[i])
                risk_band = "High" if prob >= 0.6 else "Medium" if prob >= 0.3 else "Low"
                decision = make_decision(prob, f.contract, f.tenure_in_months, f.monthly_charge)
                results.append(PredictionResponse(
                    churn_probability=prob,
                    risk_band=risk_band,
                    decision=decision["decision"],
                    recommended_action=decision["recommended_action"],
                    priority=decision["priority"]
                ))
        else:
            for f in features_list:
                prob = compute_fallback_prob(f)
                risk_band = "High" if prob >= 0.6 else "Medium" if prob >= 0.3 else "Low"
                decision = make_decision(prob, f.contract, f.tenure_in_months, f.monthly_charge)
                results.append(PredictionResponse(
                    churn_probability=prob,
                    risk_band=risk_band,
                    decision=decision["decision"],
                    recommended_action=decision["recommended_action"],
                    priority=decision["priority"]
                ))

        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Batch prediction failed: {str(e)}")