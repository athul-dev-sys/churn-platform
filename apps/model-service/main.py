from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any

app = FastAPI(
    title="Customer Churn ML Model Service",
    description="Microservice serving Machine Learning churn predictions and risk evaluations.",
    version="0.1.0"
)

class CustomerFeatures(BaseModel):
    customer_id: Optional[str] = None
    tenure: Optional[int] = 12
    contract_type: Optional[str] = "Month-to-month"
    monthly_charges: Optional[float] = 65.0
    total_charges: Optional[float] = 780.0
    internet_service: Optional[str] = "Fiber optic"
    payment_method: Optional[str] = "Electronic check"
    additional_features: Optional[Dict[str, Any]] = None

class PredictionResponse(BaseModel):
    churn_probability: float
    risk_band: str

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "model-service"}

@app.post("/predict", response_model=PredictionResponse)
def predict_churn(features: CustomerFeatures):
    """
    POST /predict
    Stub endpoint that accepts a JSON payload of customer features and returns a mock churn probability score.
    TODO: Load trained ML model (.pkl / XGBoost model) and output real predictions.
    """
    # Mock response per specification
    return PredictionResponse(
        churn_probability=0.5,
        risk_band="Medium"
    )
