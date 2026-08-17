# Database Schema Documentation

This document explains the data architecture and entities in the `churn-platform` database schema managed by Prisma ORM.

---

## Data Models Overview

The database contains three main entities: **Customer**, **ChurnScore**, and **Segment**.

### 1. Customer
Represents an individual subscriber/account in the customer base.

- `id`: Internal unique primary key (UUID format).
- `customerId`: Public unique customer identification string (e.g. `"CUST-9821"`).
- `tenure`: Number of months the customer has stayed with the service (Integer).
- `contractType`: Contract duration type, such as `"Month-to-month"`, `"One year"`, or `"Two year"`.
- `monthlyCharges`: Current monthly bill amount (Float/Decimal).
- `totalCharges`: Cumulative amount billed over the customer's lifespan (Float/Decimal).
- `internetService`: Type of internet connection (e.g. `"DSL"`, `"Fiber optic"`, or `"No"`).
- `paymentMethod`: Payment channel (e.g. `"Electronic check"`, `"Mailed check"`, `"Bank transfer"`).
- `actualChurn`: Flag indicating whether the customer has historically churned (Boolean).

---

### 2. ChurnScore
Stores AI/ML model generated predictions and risk calculations performed for a customer.

- `id`: Unique record ID (UUID format).
- `customerId`: Foreign key linking to the `Customer` model `id`.
- `score`: The computed probability of churn between `0.0` (lowest risk) and `1.0` (highest risk).
- `riskBand`: Categorical risk classification based on score ranges:
  - `High`: Score > 0.70
  - `Medium`: 0.30 <= Score <= 0.70
  - `Low`: Score < 0.30
- `reason`: Text explanation highlighting top contributing risk factors identified by feature importance.
- `revenueAtRisk`: Estimated dollar revenue value associated with potential churn for this customer.
- `scoredAt`: Timestamp when the scoring evaluation was executed.

---

### 3. Segment
Represents business segments used to group customers for targeted retention campaigns.

- `id`: Unique identifier (UUID format).
- `name`: Name of the customer segment (e.g. `"Enterprise"`, `"SMB"`, `"Consumer High-Value"`).
- `description`: Detailed explanation of the criteria defining the segment.

---

## Entity Relationships

- **Customer to ChurnScore (One-to-Many)**:
  - A `Customer` can have multiple `ChurnScore` records over time, capturing historical risk score changes as new feature data arrives.
  - Each `ChurnScore` belongs to exactly one `Customer` via the `customerId` foreign key.

- **Segment to Customer**:
  - Customers can optionally be grouped or filtered by `Segment` attributes during API queries.
