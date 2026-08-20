import { Router } from 'express';
import {
  getCustomers,
  getCustomerById,
  getSummary,
  scoreBatch,
} from '../controllers/customerController';

const router = Router();

router.get('/customers', getCustomers);
router.get('/customers/:id', getCustomerById);
router.get('/summary', getSummary);
router.post('/score-batch', scoreBatch);

export default router;
