import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import BooksPage from "./pages/BooksPage";
import StudentsPage from "./pages/StudentsPage";
import PlansPage from "./pages/PlansPage";
import PlanDetailPage from "./pages/PlanDetailPage";

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <aside className="sidebar">
          <h1>学習計画アプリ</h1>
          <nav>
            <NavLink to="/" end>
              📚 参考書ライブラリ
            </NavLink>
            <NavLink to="/students">👤 生徒管理</NavLink>
            <NavLink to="/plans">📋 計画一覧</NavLink>
          </nav>
        </aside>
        <main className="main-content">
          <Routes>
            <Route path="/" element={<BooksPage />} />
            <Route path="/students" element={<StudentsPage />} />
            <Route path="/plans" element={<PlansPage />} />
            <Route path="/plans/:planId" element={<PlanDetailPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
