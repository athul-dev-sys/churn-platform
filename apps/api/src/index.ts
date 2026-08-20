import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import customerRoutes from './routes/customerRoutes';

dotenv.config();

const app = express();
const port = process.env.PORT || 4000;

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL,
].filter(Boolean) as string[];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(null, true);
      }
    },
    credentials: true,
  })
);
app.use(express.json());

// Healthcheck
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'churn-api' });
});

// API Routes
app.use('/api', customerRoutes);

app.listen(port, () => {
  console.log(`[churn-api] Express server running on port ${port}`);
});

export default app;
