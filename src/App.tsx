import { useEffect, useState } from "react";
import { MobileNav, Sidebar } from "./components/Sidebar";
import { Topbar } from "./components/Topbar";
import { AdminOverview } from "./pages/AdminOverview";
import { UsersPage } from "./pages/UsersPage";
import { StudentsPage } from "./pages/StudentsPage";
import { FinanceOverview } from "./pages/FinanceOverview";
import { TuitionPage } from "./pages/TuitionPage";
import { TeacherRoster } from "./pages/TeacherRoster";
import { TeacherReport } from "./pages/TeacherReport";
import { AssessmentsPage } from "./pages/AssessmentsPage";
import { ApplicationsPage } from "./pages/ApplicationsPage";
import { SchedulePage } from "./pages/SchedulePage";
import { AcademyProvider, useAcademy } from "./data/academyStore";
import { LoginPage } from "./pages/LoginPage";

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
    if (tab === "assessments") return <AssessmentsPage />;
    if (tab === "report") return <TeacherReport />;
  }
  if (role === "Registration") {
    if (tab === "applications") return <ApplicationsPage />;
    if (tab === "schedule") return <SchedulePage />;
  }
  return null;
}

function AuthenticatedApp() {
  const { authLoading, isAuthenticated, user } = useAcademy();
  const [role, setRole] = useState<Role>("IT Admin");
  const [tab, setTab] = useState(defaultTab["IT Admin"]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (!user?.role) return;
    const activeRole = user.role as Role;
    setRole(activeRole);
    setTab(defaultTab[activeRole]);
  }, [user?.role]);

  if (authLoading) {
    return (
      <div className="grid min-h-dvh place-items-center bg-cream px-4">
        <div className="rounded-xl border border-line bg-white px-5 py-4 text-sm font-semibold text-ink shadow-sm">
          Checking secure session...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <LoginPage />;

  return (
    <div className="flex h-dvh overflow-hidden bg-cream">
      <Sidebar
        role={role}
        active={tab}
        onSelect={setTab}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((value) => !value)}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar role={role} />
        <main className="flex-1 overflow-y-auto px-4 py-5 pb-24 sm:px-6 lg:px-8 lg:py-6 lg:pb-8">
          <div className="mx-auto w-full max-w-[1500px]">
            <PageFor role={role} tab={tab} />
          </div>
        </main>
        <MobileNav role={role} active={tab} onSelect={setTab} />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AcademyProvider>
      <AuthenticatedApp />
    </AcademyProvider>
  );
}
