import {
  BookOpen,
  BookOpenCheck,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  Clock,
  Eye,
  FileText,
  GraduationCap,
  HeartHandshake,
  Layers,
  LayoutList,
  Library,
  MessageCircle,
  Receipt,
  ShieldCheck,
  Sparkles,
  Trophy,
  User,
  Users,
  Wallet,
} from "lucide-react";

export type NavigationItem = {
  label: string;
  href: string;
  icon: typeof Users;
};

export type MobileNavItem = {
  label: string;
  href: string;
  icon: typeof Users;
  badgeKey?: "complaints" | "approvals" | "messages" | "notifications";
};

export type MobileCategory = {
  category: "Academics" | "Finance" | "People" | "Communication" | "Settings" | "AI & Tools";
  items: MobileNavItem[];
};

export type RoleMobileNav = {
  primary: MobileNavItem[];
  moreCategories: MobileCategory[];
};

// Desktop navigation configuration (preserved for desktop sidebar)
const navigationByRole: Record<string, NavigationItem[]> = {
  DIRECTOR: [
    { label: "Overview", href: "/dashboard", icon: GraduationCap },
    { label: "Learners", href: "/learners", icon: Users },
    { label: "Admissions", href: "/admissions", icon: ClipboardList },
    { label: "Accounts", href: "/accounts", icon: ShieldCheck },
    { label: "Staff", href: "/staff", icon: Users },
    { label: "Assessments", href: "/assessments", icon: BookOpen },
    { label: "Attendance", href: "/attendance", icon: CalendarCheck },
    { label: "Finance", href: "/finance", icon: Wallet },
    { label: "Welfare", href: "/welfare", icon: HeartHandshake },
    { label: "Reports", href: "/reports", icon: FileText },
    { label: "Timetable", href: "/timetable", icon: CalendarDays },
    { label: "KICD videos", href: "/learning-content", icon: BookOpenCheck },
    { label: "Family diary", href: "/diary", icon: MessageCircle },
    { label: "Complaints", href: "/complaints", icon: MessageCircle },
  ],
  HEAD_TEACHER: [
    { label: "Overview", href: "/dashboard", icon: GraduationCap },
    { label: "Learners", href: "/learners", icon: Users },
    { label: "Admissions", href: "/admissions", icon: ClipboardList },
    { label: "Staff", href: "/staff", icon: Users },
    { label: "Assignments", href: "/assignments", icon: ClipboardList },
    { label: "Learning content", href: "/learning-content", icon: BookOpenCheck },
    { label: "Assessments", href: "/assessments", icon: BookOpen },
    { label: "Attendance", href: "/attendance", icon: CalendarCheck },
    { label: "Finance", href: "/finance", icon: Wallet },
    { label: "Welfare", href: "/welfare", icon: HeartHandshake },
    { label: "Reports", href: "/reports", icon: FileText },
    { label: "Timetable", href: "/timetable", icon: CalendarDays },
    { label: "Schemes of work", href: "/schemes", icon: LayoutList },
    { label: "KICD videos", href: "/learning-content", icon: BookOpenCheck },
    { label: "Weekly teaching log", href: "/teaching-log", icon: ClipboardList },
    { label: "Family diary", href: "/diary", icon: MessageCircle },
    { label: "Complaints", href: "/complaints", icon: MessageCircle },
  ],
  DEPUTY: [
    { label: "Overview", href: "/dashboard", icon: GraduationCap },
    { label: "Learners", href: "/learners", icon: Users },
    { label: "Attendance", href: "/attendance", icon: CalendarCheck },
    { label: "Assessments", href: "/assessments", icon: BookOpen },
    { label: "Library", href: "/library", icon: Library },
    { label: "Schemes of work", href: "/schemes", icon: LayoutList },
    { label: "Timetable", href: "/timetable", icon: CalendarDays },
    { label: "Welfare", href: "/welfare", icon: HeartHandshake },
    { label: "KICD videos", href: "/learning-content", icon: BookOpenCheck },
  ],
  SENIOR_TEACHER: [
    { label: "Overview", href: "/dashboard", icon: GraduationCap },
    { label: "Learners", href: "/learners", icon: Users },
    { label: "Attendance", href: "/attendance", icon: CalendarCheck },
    { label: "Assessments", href: "/assessments", icon: BookOpen },
    { label: "Library", href: "/library", icon: Library },
    { label: "Schemes of work", href: "/schemes", icon: LayoutList },
    { label: "Timetable", href: "/timetable", icon: CalendarDays },
    { label: "Welfare", href: "/welfare", icon: HeartHandshake },
    { label: "KICD videos", href: "/learning-content", icon: BookOpenCheck },
  ],
  SECRETARY: [
    { label: "Overview", href: "/dashboard", icon: GraduationCap },
    { label: "Learners", href: "/learners", icon: Users },
    { label: "Admissions", href: "/admissions", icon: ClipboardList },
    { label: "Finance", href: "/finance", icon: Wallet },
    { label: "Welfare", href: "/welfare", icon: HeartHandshake },
    { label: "Family diary", href: "/diary", icon: MessageCircle },
  ],
  ACCOUNTANT: [
    { label: "Overview", href: "/dashboard", icon: GraduationCap },
    { label: "Finance", href: "/finance", icon: Wallet },
    { label: "Learners", href: "/learners", icon: Users },
  ],
  TEACHER: [
    { label: "Overview", href: "/dashboard", icon: GraduationCap },
    { label: "Attendance", href: "/attendance", icon: CalendarCheck },
    { label: "Assessments", href: "/assessments", icon: BookOpen },
    { label: "Learners", href: "/learners", icon: Users },
    { label: "Assignments", href: "/assignments", icon: ClipboardList },
    { label: "Learning content", href: "/learning-content", icon: BookOpenCheck },
    { label: "KICD videos", href: "/learning-content", icon: BookOpenCheck },
    { label: "Weekly teaching log", href: "/teaching-log", icon: FileText },
    { label: "Schemes of work", href: "/schemes", icon: LayoutList },
    { label: "Library", href: "/library", icon: Library },
    { label: "Welfare", href: "/welfare", icon: HeartHandshake },
    { label: "Timetable", href: "/timetable", icon: CalendarDays },
    { label: "Family diary", href: "/diary", icon: MessageCircle },
  ],
  WELFARE_CHAIR: [
    { label: "Overview", href: "/dashboard", icon: GraduationCap },
    { label: "Welfare", href: "/welfare", icon: HeartHandshake },
  ],
  NON_TEACHING_STAFF: [
    { label: "Overview", href: "/dashboard", icon: GraduationCap },
    { label: "Welfare", href: "/welfare", icon: HeartHandshake },
  ],
  PARENT: [
    { label: "My children", href: "/portal", icon: Users },
    { label: "Family diary", href: "/diary", icon: BookOpen },
    { label: "Complaints", href: "/complaints", icon: MessageCircle },
  ],
  LEARNER: [
    { label: "My learning", href: "/learning", icon: BookOpen },
    { label: "Assignments", href: "/assignments", icon: ClipboardList },
  ],
};

// Mobile 4-tab + More configuration per role (strict permission alignment)
const mobileNavByRole: Record<string, RoleMobileNav> = {
  DIRECTOR: {
    primary: [
      { label: "Home", href: "/dashboard", icon: GraduationCap },
      { label: "Learners", href: "/learners", icon: Users },
      { label: "Finance", href: "/finance", icon: Wallet },
      { label: "Staff", href: "/staff", icon: Users },
    ],
    moreCategories: [
      {
        category: "Academics",
        items: [
          { label: "Assessments", href: "/assessments", icon: BookOpen },
          { label: "Attendance", href: "/attendance", icon: CalendarCheck },
          { label: "Timetable", href: "/timetable", icon: CalendarDays },
          { label: "KICD Videos", href: "/learning-content", icon: BookOpenCheck },
          { label: "Reports", href: "/reports", icon: FileText },
        ],
      },
      {
        category: "Finance",
        items: [
          { label: "Fee Structures", href: "/finance/structures", icon: Layers },
          { label: "Official Receipts", href: "/receipts", icon: Receipt },
        ],
      },
      {
        category: "People",
        items: [
          { label: "Admissions", href: "/admissions", icon: ClipboardList },
          { label: "Accounts & Roles", href: "/accounts", icon: ShieldCheck },
          { label: "Staff Welfare", href: "/welfare", icon: HeartHandshake },
        ],
      },
      {
        category: "Communication",
        items: [
          { label: "Family Diary", href: "/diary", icon: BookOpen },
          { label: "Complaints", href: "/complaints", icon: MessageCircle, badgeKey: "complaints" },
        ],
      },
      {
        category: "Settings",
        items: [
          { label: "Profile & Security", href: "/profile", icon: User },
          { label: "Security Audit", href: "/audit", icon: Eye },
          { label: "Privacy Notice", href: "/privacy", icon: ShieldCheck },
        ],
      },
    ],
  },
  HEAD_TEACHER: {
    primary: [
      { label: "Home", href: "/dashboard", icon: GraduationCap },
      { label: "Learners", href: "/learners", icon: Users },
      { label: "Attendance", href: "/attendance", icon: CalendarCheck },
      { label: "Complaints", href: "/complaints", icon: MessageCircle, badgeKey: "complaints" },
    ],
    moreCategories: [
      {
        category: "Academics",
        items: [
          { label: "Assignments", href: "/assignments", icon: ClipboardList },
          { label: "Learning Content", href: "/learning-content", icon: BookOpenCheck },
          { label: "Assessments", href: "/assessments", icon: BookOpen },
          { label: "Timetable", href: "/timetable", icon: CalendarDays },
          { label: "Schemes of Work", href: "/schemes", icon: LayoutList },
          { label: "Teaching Logs", href: "/teaching-log", icon: FileText },
          { label: "KICD Videos", href: "/learning-content", icon: BookOpenCheck },
          { label: "Reports", href: "/reports", icon: FileText },
        ],
      },
      {
        category: "Finance",
        items: [
          { label: "Financial Management", href: "/finance", icon: Wallet },
          { label: "Fee Structures", href: "/finance/structures", icon: Layers },
          { label: "Official Receipts", href: "/receipts", icon: Receipt },
        ],
      },
      {
        category: "People",
        items: [
          { label: "Admissions", href: "/admissions", icon: ClipboardList },
          { label: "Staff Directory", href: "/staff", icon: Users },
          { label: "Staff Welfare", href: "/welfare", icon: HeartHandshake },
        ],
      },
      {
        category: "Communication",
        items: [
          { label: "Family Diary", href: "/diary", icon: BookOpen },
          { label: "Parent Complaints", href: "/complaints", icon: MessageCircle, badgeKey: "complaints" },
        ],
      },
      {
        category: "Settings",
        items: [
          { label: "Profile & Security", href: "/profile", icon: User },
          { label: "Privacy Notice", href: "/privacy", icon: ShieldCheck },
        ],
      },
    ],
  },
  DEPUTY: {
    primary: [
      { label: "Home", href: "/dashboard", icon: GraduationCap },
      { label: "Attendance", href: "/attendance", icon: CalendarCheck },
      { label: "Exams", href: "/assessments", icon: BookOpen },
      { label: "Timetable", href: "/timetable", icon: CalendarDays },
    ],
    moreCategories: [
      {
        category: "Academics",
        items: [
          { label: "Schemes of Work", href: "/schemes", icon: LayoutList },
          { label: "Textbooks & Library", href: "/library", icon: Library },
          { label: "KICD Videos", href: "/learning-content", icon: BookOpenCheck },
        ],
      },
      {
        category: "People",
        items: [
          { label: "Learners", href: "/learners", icon: Users },
          { label: "Admissions", href: "/admissions", icon: ClipboardList },
          { label: "Staff Welfare", href: "/welfare", icon: HeartHandshake },
        ],
      },
      {
        category: "Settings",
        items: [
          { label: "Profile & Security", href: "/profile", icon: User },
          { label: "Privacy Notice", href: "/privacy", icon: ShieldCheck },
        ],
      },
    ],
  },
  SENIOR_TEACHER: {
    primary: [
      { label: "Home", href: "/dashboard", icon: GraduationCap },
      { label: "Attendance", href: "/attendance", icon: CalendarCheck },
      { label: "Exams", href: "/assessments", icon: BookOpen },
      { label: "Timetable", href: "/timetable", icon: CalendarDays },
    ],
    moreCategories: [
      {
        category: "Academics",
        items: [
          { label: "Schemes of Work", href: "/schemes", icon: LayoutList },
          { label: "Textbooks & Library", href: "/library", icon: Library },
          { label: "KICD Videos", href: "/learning-content", icon: BookOpenCheck },
        ],
      },
      {
        category: "People",
        items: [
          { label: "Learners", href: "/learners", icon: Users },
          { label: "Admissions", href: "/admissions", icon: ClipboardList },
          { label: "Staff Welfare", href: "/welfare", icon: HeartHandshake },
        ],
      },
      {
        category: "Settings",
        items: [
          { label: "Profile & Security", href: "/profile", icon: User },
          { label: "Privacy Notice", href: "/privacy", icon: ShieldCheck },
        ],
      },
    ],
  },
  SECRETARY: {
    primary: [
      { label: "Home", href: "/dashboard", icon: GraduationCap },
      { label: "Admissions", href: "/admissions", icon: ClipboardList },
      { label: "Learners", href: "/learners", icon: Users },
      { label: "Fees", href: "/finance", icon: Wallet },
    ],
    moreCategories: [
      {
        category: "Finance",
        items: [
          { label: "Fee Structures", href: "/finance/structures", icon: Layers },
        ],
      },
      {
        category: "People",
        items: [
          { label: "Staff Welfare", href: "/welfare", icon: HeartHandshake },
        ],
      },
      {
        category: "Communication",
        items: [{ label: "Family Diary", href: "/diary", icon: BookOpen }],
      },
      {
        category: "Settings",
        items: [
          { label: "Profile & Security", href: "/profile", icon: User },
          { label: "Privacy Notice", href: "/privacy", icon: ShieldCheck },
        ],
      },
    ],
  },
  ACCOUNTANT: {
    primary: [
      { label: "Home", href: "/dashboard", icon: GraduationCap },
      { label: "Invoices", href: "/finance?tab=invoices", icon: FileText },
      { label: "Payments", href: "/finance?tab=payments", icon: Wallet },
      { label: "Arrears", href: "/finance?tab=arrears", icon: Clock },
    ],
    moreCategories: [
      {
        category: "Finance",
        items: [
          { label: "Financial Management", href: "/finance", icon: Wallet },
          { label: "Fee Structures", href: "/finance/structures", icon: Layers },
          { label: "Official Receipts", href: "/receipts", icon: Receipt },
        ],
      },
      {
        category: "People",
        items: [
          { label: "Learner Directory", href: "/learners", icon: Users },
          { label: "Staff Welfare", href: "/welfare", icon: HeartHandshake },
        ],
      },
      {
        category: "Settings",
        items: [
          { label: "Profile & Security", href: "/profile", icon: User },
          { label: "Privacy Notice", href: "/privacy", icon: ShieldCheck },
        ],
      },
    ],
  },
  TEACHER: {
    primary: [
      { label: "Home", href: "/dashboard", icon: GraduationCap },
      { label: "Attendance", href: "/attendance", icon: CalendarCheck },
      { label: "Marks", href: "/assessments", icon: BookOpen },
      { label: "Class", href: "/learners", icon: Users },
    ],
    moreCategories: [
      {
        category: "Academics",
        items: [
          { label: "Assignments", href: "/assignments", icon: ClipboardList },
          { label: "Timetable", href: "/timetable", icon: CalendarDays },
          { label: "Schemes of Work", href: "/schemes", icon: LayoutList },
          { label: "Weekly Teaching Log", href: "/teaching-log", icon: FileText },
          { label: "Learn", href: "/learning-content", icon: BookOpenCheck },
          { label: "Family Diary", href: "/diary", icon: MessageCircle },
          { label: "Textbooks & Library", href: "/library", icon: Library },
        ],
      },
      {
        category: "People",
        items: [
          { label: "Staff Welfare", href: "/welfare", icon: HeartHandshake },
        ],
      },
      {
        category: "Settings",
        items: [
          { label: "Profile & Security", href: "/profile", icon: User },
          { label: "Privacy Notice", href: "/privacy", icon: ShieldCheck },
        ],
      },
    ],
  },
  PARENT: {
    primary: [
      { label: "Home", href: "/portal", icon: GraduationCap },
      { label: "Results", href: "/portal?tab=results", icon: Trophy },
      { label: "Fees", href: "/portal?tab=fees", icon: Wallet },
      { label: "Diary", href: "/diary", icon: BookOpen },
    ],
    moreCategories: [
      {
        category: "Academics",
        items: [
          { label: "Learning Content & KICD Videos", href: "/learning-content", icon: BookOpenCheck },
          { label: "Academic Evaluation", href: "/portal?tab=results", icon: Trophy },
        ],
      },
      {
        category: "Finance",
        items: [
          { label: "Fee Statements & Receipts", href: "/portal?tab=fees", icon: Wallet },
        ],
      },
      {
        category: "People",
        items: [
          { label: "My Children", href: "/portal", icon: Users },
        ],
      },
      {
        category: "Communication",
        items: [
          { label: "Direct Inquiries & Complaints", href: "/complaints", icon: MessageCircle, badgeKey: "messages" },
        ],
      },
      {
        category: "Settings",
        items: [
          { label: "Profile & Security", href: "/profile", icon: User },
          { label: "Privacy Notice", href: "/privacy", icon: ShieldCheck },
        ],
      },
    ],
  },
  LEARNER: {
    primary: [
      { label: "Home", href: "/learning", icon: GraduationCap },
      { label: "Homework", href: "/assignments", icon: ClipboardList },
      { label: "Results", href: "/learning?tab=results", icon: Trophy },
      { label: "My Learning", href: "/learning-content", icon: BookOpenCheck },
    ],
    moreCategories: [
      {
        category: "Academics",
        items: [
          { label: "Learning Content & KICD Videos", href: "/learning-content", icon: BookOpenCheck },
          { label: "Learning Activities", href: "/learning", icon: BookOpen },
        ],
      },
      {
        category: "Settings",
        items: [
          { label: "Profile & Security", href: "/profile", icon: User },
          { label: "Privacy Notice", href: "/privacy", icon: ShieldCheck },
        ],
      },
    ],
  },
  WELFARE_CHAIR: {
    primary: [
      { label: "Home", href: "/dashboard", icon: GraduationCap },
      { label: "Welfare", href: "/welfare", icon: HeartHandshake },
      { label: "Profile", href: "/profile", icon: User },
      { label: "Privacy", href: "/privacy", icon: ShieldCheck },
    ],
    moreCategories: [
      {
        category: "Settings",
        items: [
          { label: "Profile & Security", href: "/profile", icon: User },
          { label: "Privacy Notice", href: "/privacy", icon: ShieldCheck },
        ],
      },
    ],
  },
  NON_TEACHING_STAFF: {
    primary: [
      { label: "Home", href: "/dashboard", icon: GraduationCap },
      { label: "Welfare", href: "/welfare", icon: HeartHandshake },
      { label: "Profile", href: "/profile", icon: User },
      { label: "Privacy", href: "/privacy", icon: ShieldCheck },
    ],
    moreCategories: [
      {
        category: "Settings",
        items: [
          { label: "Profile & Security", href: "/profile", icon: User },
          { label: "Privacy Notice", href: "/privacy", icon: ShieldCheck },
        ],
      },
    ],
  },
};

export function getRoleNavigation(role: string): NavigationItem[] {
  const items = navigationByRole[role] ?? navigationByRole.LEARNER;
  return [...items, { label: "Assistant", href: "/assistant", icon: Sparkles }];
}

export function getMobileNavigation(role: string): RoleMobileNav {
  const base = mobileNavByRole[role] ?? mobileNavByRole.LEARNER;
  // Return a copy: the shared definition must not gain a category per call.
  return {
    primary: base.primary,
    moreCategories: [
      ...base.moreCategories,
      { category: "AI & Tools" as const, items: [{ label: "AI Assistant", href: "/assistant", icon: Sparkles }] },
    ],
  };
}

export function getNavigationHref(label: string, role: string): string | undefined {
  return getRoleNavigation(role).find((item) => item.label === label)?.href;
}

/** Flat list of every destination a role may open from the mobile navigation. */
export function getMobileDestinations(role: string): (MobileNavItem & { group: string })[] {
  const nav = getMobileNavigation(role);
  return [
    ...nav.primary.map((item) => ({ ...item, group: item.href === "/dashboard" ? "Overview" : item.label })),
    ...nav.moreCategories.flatMap((category) => category.items.map((item) => ({ ...item, group: category.category }))),
  ];
}

const detailSections: { prefix: string; roles?: string[]; label: string }[] = [
  { prefix: "/learners/", label: "Learners" },
  { prefix: "/staff/new", label: "Staff" },
  { prefix: "/staff/", label: "Staff" },
  { prefix: "/admissions/new", label: "Admissions" },
  { prefix: "/admissions/", label: "Admissions" },
  { prefix: "/assessments/exams", label: "Exams", roles: ["DEPUTY", "SENIOR_TEACHER"] },
  { prefix: "/assessments", label: "Academics" },
  { prefix: "/finance/structures", label: "Finance" },
  { prefix: "/finance", label: "Finance" },
  { prefix: "/receipts", label: "Finance" },
  { prefix: "/profile", label: "Settings" },
  { prefix: "/privacy", label: "Settings" },
  { prefix: "/audit", label: "Settings" },
  { prefix: "/complaints", label: "Messages" },
  { prefix: "/learning-videos", label: "Academics" },
];

/** Section label shown in the compact app bar (never duplicates the page title). */
export function getSectionForPath(pathname: string, role: string): string {
  const path = pathname.split("?")[0];
  if (path === "/dashboard") return "Overview";
  if (path === "/assistant") return "Assistant";
  if (path === "/help") return "Help & guides";
  const destinations = getMobileDestinations(role);
  // Tab siblings share one pathname, so an exact href must win before a pathname-only match.
  const exact = destinations.find((item) => item.href === pathname) ?? destinations.find((item) => item.href.split("?")[0] === path);
  if (exact) return exact.group;
  const detail = detailSections.find((item) => path.startsWith(item.prefix) && (!item.roles || item.roles.includes(role)));
  if (detail) return detail.label;
  return "Workspace";
}

