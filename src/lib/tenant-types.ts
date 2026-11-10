export interface TenantPaymentConfig {
  paybillNumber: string | null;
  accountFormat: string;
  tillNumber: string | null;
  bankName: string | null;
  bankBranch: string | null;
  bankAccountNumber: string | null;
  bankAccountName: string | null;
  darajaShortcode: string | null;
  darajaEnvironment: string;
  /** True when encrypted Daraja credentials exist. The values never leave the server. */
  darajaConfigured: boolean;
}

export interface TenantConfig {
  id: string;
  name: string;
  slug: string;
  motto: string;
  slogan: string | null;
  logoUrl: string;
  primaryColour: string;
  secondaryColour: string;
  accentColour: string;
  contactEmail: string | null;
  contactPhone: string | null;
  poBox: string | null;
  physicalAddress: string | null;
  status: "ACTIVE" | "SUSPENDED" | string;
  paymentConfig: TenantPaymentConfig | null;
}

export const DEMO_FALLBACK_TENANT: TenantConfig = {
  id: "school_demo_mary_royal",
  name: "Mary Royal School",
  slug: "maryroyal",
  motto: "Hard work pays",
  slogan: "Nurturing Excellence Through CBE",
  logoUrl: "/mary-royal-logo.png",
  primaryColour: "#1d4ed8",
  secondaryColour: "#102653",
  accentColour: "#d97706",
  contactEmail: "maryroyalschool81@gmail.com",
  contactPhone: "+254 718 216 374",
  poBox: "P.O. Box 40100, Kisumu",
  physicalAddress: "Obunga, near Breweries, Kisumu",
  status: "ACTIVE",
  paymentConfig: null,
};

export const PLATFORM_TENANT: TenantConfig = {
  id: "platform",
  name: "School Core",
  slug: "platform",
  motto: "One platform. Every school.",
  slogan: "Multi-tenant school management",
  logoUrl: "/school-core-logo.svg",
  primaryColour: "#0f766e",
  secondaryColour: "#134e4a",
  accentColour: "#f59e0b",
  contactEmail: null,
  contactPhone: null,
  poBox: null,
  physicalAddress: null,
  status: "ACTIVE",
  paymentConfig: null,
};
