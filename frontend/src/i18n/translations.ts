import { Language } from "@/types/dss";

export const TRANSLATIONS: Record<Language, Record<string, string>> = {
  en: {
    brand: "KrishiSetu",
    nav_farmer: "Farmer Credit",
    nav_bank: "Bank Underwriting",
    nav_govt: "Policy & Map",
    farmer_eyebrow: "Agricultural Credit Access",
    farmer_title: "Credit Meets Harvest",
    bank_eyebrow: "Portfolio Underwriting",
    bank_title: "Risk Meets Inclusion",
    govt_eyebrow: "Regional Oversight",
    govt_title: "Policy Meets Precision",
    tab_apply: "Application",
    tab_outcome: "Decision",
    tab_wallet: "e-RUPI Wallet",
    tab_grievances: "Appeals",
    voice_input: "Voice",
    listening: "Listening",
    submit_apply: "Submit Application",
  },
  hi: {
    brand: "कृषिसेतु",
    nav_farmer: "किसान ऋण",
    nav_bank: "बैंक मूल्यांकन",
    nav_govt: "नीति एवं मानचित्र",
    farmer_eyebrow: "कृषि ऋण सुविधा",
    farmer_title: "फसल आधारित सरल ऋण",
    bank_eyebrow: "पोर्टफोलियो प्रबंधन",
    bank_title: "संतुलित ऋण मूल्यांकन",
    govt_eyebrow: "क्षेत्रीय निगरानी",
    govt_title: "सटीक नीति एवं समीक्षा",
    tab_apply: "आवेदन",
    tab_outcome: "निर्णय",
    tab_wallet: "ई-रूपी वॉलेट",
    tab_grievances: "अपील",
    voice_input: "बोलें",
    listening: "सुन रहा है",
    submit_apply: "आवेदन जमा करें",
  },
};

export function t(lang: Language, key: string): string {
  return TRANSLATIONS[lang]?.[key] || TRANSLATIONS.en[key] || key;
}
