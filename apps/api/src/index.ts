import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import customerRoutes from './routes/customerRoutes';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

/**
 * Frontend is served from the same ALB host as /api (path-based routing),
 * so most browser calls are same-origin. FRONTEND_URL / CORS_ORIGINS cover
 * local Vite and any extra allowed origins.
 */
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:80',
  process.env.FRONTEND_URL,
  process.env.ALB_URL,
  ...(process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',').map((s) => s.trim()) : []),
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      // Non-browser clients / same-origin relative calls may omit Origin
      if (!origin) {
        callback(null, true);
        return;
      }
      if (
        allowedOrigins.includes(origin) ||
        process.env.NODE_ENV !== 'production' ||
        process.env.CORS_ALLOW_ALL === 'true'
      ) {
        callback(null, true);
        return;
      }
      // ALB DNS can change account suffix; allow any http(s) *.elb.amazonaws.com
      if (/^https?:\/\/[^/]+\.elb\.amazonaws\.com(?::\d+)?$/i.test(origin)) {
        callback(null, true);
        return;
      }
      callback(null, true); // permissive for hackathon single-ALB deploy
    },
    credentials: true,
  })
);
app.use(express.json());

// Healthcheck (ALB target group health path)
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'churn-api' });
});

// API Routes — ALB forwards /api/* here without stripping the prefix
app.use('/api', customerRoutes);

app.listen(port, () => {
  console.log(`[churn-api] Express server running on port ${port}`);
});

export default app;
