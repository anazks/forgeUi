import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import EntityDetail from './components/EntityDetail';
import UsersPage from './components/UsersPage';
import MenuPage from './components/MenuPage';
import BomPage from './components/BomPage';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/menu" element={<MenuPage />} />
        <Route path="/bom" element={<BomPage />} />
        <Route path="/centers" element={<UsersPage roleType="CENTER" />} />
        <Route path="/kitchens" element={<UsersPage roleType="KITCHEN" />} />
        <Route path="/stores" element={<UsersPage roleType="STORE" />} />
        <Route path="/resorts" element={<UsersPage roleType="RESORT" />} />
        <Route path="/aggregates" element={<UsersPage roleType="AGGRIGATE" />} />
        <Route path="/entity/:id" element={<EntityDetail />} />
        {/* Fallback to landing page if route not found */}
        <Route path="*" element={<LandingPage />} />
      </Routes>
    </Router>
  );
}

export default App;
