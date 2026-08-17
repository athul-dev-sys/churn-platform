# churn-platform

A Customer Churn Prediction Platform designed to identify at-risk customers, deliver Machine Learning probability scores, and surface key churn metrics to help teams proactively prevent customer attrition.

## Workspace Architecture

This monorepo contains the following microservices:
- `apps/web`: React + Vite + TypeScript frontend with Tailwind CSS and React Router DOM.
- `apps/api`: Express + TypeScript backend with Prisma ORM for PostgreSQL.
- `apps/model-service`: Python FastAPI microservice serving ML churn predictions.
- `data/`: Directory for raw and processed datasets.
- `docs/`: API contracts and data schema documentation.

## Prerequisites

Before getting started, ensure you have installed:
- **Node.js**: v18+ and `npm`
- **Python**: v3.10+
- **Docker & Docker Compose**

## Getting Started & Local Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd churn-platform
```

### 2. Configure Environment Variables
Copy `.env.example` files to `.env` in the respective application directories:
```bash
cp apps/api/.env.example apps/api/.env
cp apps/model-service/.env.example apps/model-service/.env
```

### 3. Install Dependencies
```bash
# Web Frontend
cd apps/web
npm install

# API Backend
cd ../api
npm install

# Model Service
cd ../model-service
pip install -r requirements.txt
cd ../..
```

### 4. Run Services with Docker Compose
To launch all services (PostgreSQL, Express API, Vite Web, and FastAPI Model Service) in local containers:
```bash
docker-compose up --build
```

### 5. Run Prisma Database Migrations
In a new terminal window, apply the database schema to your PostgreSQL instance:
```bash
cd apps/api
npx prisma migrate dev --name init
```

The Web UI will be available at `http://localhost:5173`, the API at `http://localhost:4000`, and the FastAPI service docs at `http://localhost:8000/docs`.
