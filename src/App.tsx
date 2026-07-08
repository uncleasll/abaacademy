import { useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { AdminOverview } from "./pages/AdminOverview";
import { UsersPage } from "./pages/UsersPage";
import { StudentsPage } from "./pages/StudentsPage";
import { FinanceOverview } from "./pages/FinanceOverview";
import { TuitionPage } from "./pages/TuitionPage";
import { TeacherRoster } from "./pages/TeacherRoster";
import { TeacherReport } from "./pages/TeacherReport";
import { ApplicationsPage } from "./pages/ApplicationsPage";
import { SchedulePage } from "./pages/SchedulePage";

export type Role = "IT Admin" | "Finance" | "Teacher" | "Registration";

const defaultTab: Record<Role, string> = {
  "IT Admin": "overview",
  Finance: "overview",
  Teacher: "roster",
  Registration: "applications",
};

function PageFor({ role, tab }: { role: Role; tab: string }) {
  if (role === "IT Admin") {
    if (tab === "overview") return <AdminOverview />;
    if (tab === "users") return <UsersPage />;
    if (tab === "students") return <StudentsPage />;
  }
  if (role === "Finance") {
    if (tab === "overview") return <FinanceOverview />;
    if (tab === "tuition") return <TuitionPage />;
  }
  if (role === "Teacher") {
    if (tab === "roster") return <TeacherRoster />;
    if (tab === "report") return <TeacherReport />;
  }
  if (role === "Registration") {
    if (tab === "applications") return <ApplicationsPage />;
    if (tab === "schedule") return <SchedulePage />;
  }
  return null;
}

export default function App() {
  const [role, setRole] = useState<Role>("Teacher");
  const [tab, setTab] = useState(defaultTab["Teacher"]);

  const handleRoleChange = (r: Role) => {
    setRole(r);
    setTab(defaultTab[r]);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-cream">
      <Sidebar role={role} active={tab} onSelect={setTab} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar role={role} onChangeRole={handleRoleChange} />
        <main className="flex-1 overflow-y-auto px-8 py-8">
          <PageFor role={role} tab={tab} />
        </main>
      </div>
    </div>
  );
}
