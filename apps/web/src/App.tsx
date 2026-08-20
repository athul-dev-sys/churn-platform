import React from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import { AppLayout } from "./components/AppLayout";

import { Dashboard } from "./pages/Dashboard";
import { Customers } from "./pages/Customers";
import { CustomerDetail } from "./pages/CustomerDetail";
import { RiskAnalytics } from "./pages/RiskAnalytics";
import { RevenueRisk } from "./pages/RevenueRisk";
import { RetentionActions } from "./pages/RetentionActions";

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>

        {/* All pages use the same AppLayout */}
        <Route element={<AppLayout />}>

          {/* Dashboard */}
          <Route
            path="/"
            element={<Dashboard />}
          />

          {/* Customers */}
          <Route
            path="/customers"
            element={<Customers />}
          />

          {/* Customer Details */}
          <Route
            path="/customer/:id"
            element={<CustomerDetail />}
          />

          {/* Risk Analytics */}
          <Route
            path="/risk"
            element={<RiskAnalytics />}
          />
          <Route path="/analytics" element={<RiskAnalytics />} />

          {/* Revenue Risk */}
          <Route
            path="/revenue"
            element={<RevenueRisk />}
          />
          <Route path="/revenue-risk" element={<RevenueRisk />} />

          {/* Retention Actions */}
          <Route
            path="/retention"
            element={<RetentionActions />}
          />
          <Route path="/risk-analysis" element={<RetentionActions />} />

        </Route>

        {/* Redirect unknown URLs to Dashboard */}
        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />

      </Routes>
    </BrowserRouter>
  );
};

export default App;
