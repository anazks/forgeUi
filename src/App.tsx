import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import EntityDetail from './components/EntityDetail';
import UsersPage from './components/UsersPage';
import MenuPage from './components/MenuPage';
import BomPage from './components/BomPage';
import ItemConfigPage from './components/ItemConfigPage';
import StoreDashboard from './components/StoreDashboard';
import FoodRequestPage from './components/FoodRequestPage';
import MasterDatabasePage from './components/MasterDatabasePage';
import PurchasePage from './components/PurchasePage';
import PaymentSettings from './components/PaymentSettings';
import WastagePage from './components/WastagePage';
import CentersDashboardPage from './components/CentersDashboardPage';
import FinancePage from './components/FinancePage';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/store-dashboard" element={<StoreDashboard />} />
        <Route path="/store-requests" element={<FoodRequestPage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/menu" element={<MenuPage />} />
        <Route path="/bom" element={<BomPage />} />
        <Route path="/item-config" element={<ItemConfigPage />} />
        <Route path="/centers" element={<CentersDashboardPage />} />
        <Route path="/kitchens" element={<UsersPage roleType="KITCHEN" />} />
        <Route path="/stores" element={<UsersPage roleType="STORE" />} />
        <Route path="/resorts" element={<UsersPage roleType="RESORT" />} />
        <Route path="/aggregates" element={<UsersPage roleType="AGGREGATE" />} />

        {/* Entity specific routes */}
        <Route path="/entity/:entityId" element={<EntityDetail />} />
        <Route path="/entity/:entityId/users" element={<UsersPage />} />
        <Route path="/entity/:entityId/menu" element={<MenuPage />} />
        <Route path="/entity/:entityId/bom" element={<BomPage />} />
        <Route path="/entity/:entityId/centers" element={<CentersDashboardPage />} />
        <Route path="/entity/:entityId/kitchens" element={<UsersPage roleType="KITCHEN" />} />
        <Route path="/entity/:entityId/stores" element={<UsersPage roleType="STORE" />} />
        <Route path="/entity/:entityId/resorts" element={<UsersPage roleType="RESORT" />} />
        <Route path="/entity/:entityId/aggregates" element={<UsersPage roleType="AGGREGATE" />} />
        <Route path="/entity/:entityId/item-config" element={<ItemConfigPage />} />
        <Route path="/food-requests" element={<FoodRequestPage />} />
        <Route path="/entity/:entityId/food-requests" element={<FoodRequestPage />} />
        <Route path="/wastage" element={<WastagePage />} />
        <Route path="/entity/:entityId/wastage" element={<WastagePage />} />
        <Route path="/master-database" element={<MasterDatabasePage />} />
        <Route path="/entity/:entityId/master-database" element={<MasterDatabasePage />} />
        <Route path="/purchase" element={<PurchasePage />} />
        <Route path="/entity/:entityId/purchase" element={<PurchasePage />} />
        <Route path="/payment-settings" element={<PaymentSettings />} />
        <Route path="/entity/:entityId/payment-settings" element={<PaymentSettings />} />
        <Route path="/finance" element={<FinancePage />} />
        <Route path="/entity/:entityId/finance" element={<FinancePage />} />
        {/* Fallback to landing page if route not found */}
        <Route path="*" element={<LandingPage />} />
      </Routes>
    </Router>
  );
}

export default App;
