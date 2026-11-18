import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  Wallet,
  Briefcase,
  Target,
  Building2,
  LineChart,
  Crown,
  UserCog,
  Banknote,
  CalendarDays,
  Receipt,
  ClipboardList,
  Boxes,
  LifeBuoy,
  KanbanSquare,
  Clock,
  FileText,
  ShieldCheck,
  FileSignature,
  KeyRound,
  Workflow,
} from "lucide-react";

export interface NavItem {
  titleKey: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  // Nur fuer Manager sichtbar (z. B. Zugriffsverwaltung).
  managerOnly?: boolean;
}

export interface NavGroup {
  labelKey: string;
  items: NavItem[];
}

export const navigation: NavGroup[] = [
  {
    labelKey: "nav.group.dashboards",
    items: [
      { titleKey: "nav.executive", href: "/dashboard/executive", icon: Crown },
      { titleKey: "nav.hr", href: "/dashboard/hr", icon: LayoutDashboard },
      { titleKey: "nav.employee", href: "/dashboard/employee", icon: Users },
      { titleKey: "nav.finance", href: "/dashboard/finance", icon: Banknote },
      { titleKey: "nav.recruitment", href: "/dashboard/recruitment", icon: Briefcase },
      { titleKey: "nav.analytics", href: "/dashboard/analytics", icon: LineChart },
    ],
  },
  {
    labelKey: "nav.group.attendance",
    items: [
      { titleKey: "nav.timesheet", href: "/attendance/timesheet", icon: Clock },
      { titleKey: "nav.leave", href: "/attendance/leave", icon: CalendarDays },
    ],
  },
  {
    labelKey: "nav.group.payroll",
    items: [
      { titleKey: "nav.payslips", href: "/payroll/payslips", icon: Receipt },
      { titleKey: "nav.reimbursements", href: "/payroll/reimbursements", icon: Wallet },
      { titleKey: "nav.payrollAnalytics", href: "/payroll/analytics", icon: LineChart },
    ],
  },
  {
    labelKey: "nav.group.people",
    items: [
      { titleKey: "nav.employees", href: "/people/employees", icon: Users },
      { titleKey: "nav.orgChart", href: "/people/org-chart", icon: Workflow },
      { titleKey: "nav.ess", href: "/people/ess", icon: UserCog },
      { titleKey: "nav.assets", href: "/people/assets", icon: Boxes },
      { titleKey: "nav.helpdesk", href: "/people/helpdesk", icon: LifeBuoy },
      { titleKey: "nav.onboarding", href: "/people/onboarding", icon: ClipboardList },
    ],
  },
  {
    labelKey: "nav.group.recruitment",
    items: [
      { titleKey: "nav.vacancies", href: "/recruitment/vacancies", icon: Building2 },
      { titleKey: "nav.pipeline", href: "/recruitment/pipeline", icon: KanbanSquare },
    ],
  },
  {
    labelKey: "nav.group.performance",
    items: [
      { titleKey: "nav.goals", href: "/performance/goals", icon: Target },
      { titleKey: "nav.appraisals", href: "/performance/appraisals", icon: FileText },
    ],
  },
  {
    labelKey: "nav.group.director",
    items: [
      { titleKey: "nav.director.overview", href: "/director", icon: ShieldCheck },
      { titleKey: "nav.director.contracts", href: "/director/contracts", icon: FileSignature },
      { titleKey: "nav.director.payroll", href: "/director/payroll", icon: Banknote },
    ],
  },
  {
    labelKey: "nav.group.admin",
    items: [
      { titleKey: "nav.access", href: "/people/access", icon: KeyRound, managerOnly: true },
      { titleKey: "nav.org", href: "/org", icon: Building2, managerOnly: true },
    ],
  },
];

export const mobileNav: NavItem[] = [
  { titleKey: "nav.home", href: "/ess", icon: LayoutDashboard },
  { titleKey: "nav.mobile.leave", href: "/ess/leave", icon: CalendarDays },
  { titleKey: "nav.mobile.payslip", href: "/ess/payslip", icon: Receipt },
  { titleKey: "nav.mobile.profile", href: "/ess/profile", icon: UserCog },
];

export const flatRoutes = navigation.flatMap((g) => g.items);
