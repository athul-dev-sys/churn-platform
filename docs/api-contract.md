# API Contract Specification

This document details the REST API contract for the `churn-platform` Express API service. All request/response payloads strictly align with the Prisma schema database models (`Customer`, `ChurnScore`, `Segment`).

---

## 1. GET `/api/customers`

Fetch a list of customers with optional filtering by segment and risk band.

- **Query Parameters**:
  - `segment` *(optional, string)*: Filter customers by segment name (e.g. `"Enterprise"`).
  - `riskBand` *(optional, string)*: Filter by risk classification (`"High"`, `"Medium"`, `"Low"`).

- **Response Header**: `200 OK`
- **Response Body**:
```json
[
  {
    "id": "c1a2b3c4-0001-4000-8000-000000000001",
    "customerId": "CUST-9821",
    "tenure": 24,
    "contractType": "Month-to-month",
    "monthlyCharges": 85.50,
    "totalCharges": 2052.00,
    "internetService": "Fiber optic",
    "paymentMethod": "Electronic check",
    "actualChurn": false,
    "scores": [
      {
        "id": "s1a2b3c4-0001-4000-8000-000000000001",
        "score": 0.78,
        "riskBand": "High",
        "reason": "High monthly charge relative to contract length",
        "revenueAtRisk": 2052.00,
        "scoredAt": "2026-08-17T12:00:00.000Z"
      }
    ]
  }
]
```

---

## 2. GET `/api/summary`

Retrieve global churn summary statistics for executive dashboards.

- **Query Parameters**: None

- **Response Header**: `200 OK`
- **Response Body**:
```json
{
  "totalCustomers": 1250,
  "highRiskCount": 180,
  "mediumRiskCount": 320,
  "lowRiskCount": 750,
  "totalRevenueAtRisk": 145200.50,
  "averageChurnScore": 0.32
}
```

---

## 3. POST `/api/score-batch`

Trigger batch ML scoring for specified customers or all unscored customers.

- **Request Body**:
```json
{
  "customerIds": ["CUST-9821", "CUST-9822"]
}
```

- **Response Header**: `200 OK`
- **Response Body**:
```json
{
  "processed": 2,
  "scores": [
    {
      "id": "s1a2b3c4-0001-4000-8000-000000000001",
      "customerId": "c1a2b3c4-0001-4000-8000-000000000001",
      "score": 0.78,
      "riskBand": "High",
      "reason": "Recent increase in service tickets",
      "revenueAtRisk": 2052.00,
      "scoredAt": "2026-08-17T12:00:00.000Z"
    },
    {
      "id": "s1a2b3c4-0002-4000-8000-000000000002",
      "customerId": "c1a2b3c4-0002-4000-8000-000000000002",
      "score": 0.15,
      "riskBand": "Low",
      "reason": "Long tenure and annual contract",
      "revenueAtRisk": 450.00,
      "scoredAt": "2026-08-17T12:00:00.000Z"
    }
  ]
}
```
