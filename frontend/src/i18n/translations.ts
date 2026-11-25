import { Language } from "@/types/dss";

export const TRANSLATIONS: Record<Language, Record<string, string>> = {
  en: {
    app_title: "KrishiSetu DSS",
    app_subtitle: "Three-Sided Agricultural Credit Decision System (Farmer • Bank • Govt)",
    glc_target: "Ground Level Credit Target:",
    nav_farmer: "Farmer Portal",
    nav_bank: "Bank Workbench",
    nav_govt: "Govt Policy Console",
    nav_guide: "DMS624 Guide",
    farmer_portal_title: "Kisan Credit & Welfare Portal",
    farmer_portal_sub: "Low-friction 4-step progressive credit access, instant decision explanation & e-RUPI digital vouchers",
    tab_apply: "1. New Application",
    tab_outcome: "2. Decision Outcome",
    tab_wallet: "3. e-RUPI Vouchers",
    tab_grievances: "4. Appeals & Grievances",
    voice_input: "Voice Input",
    listening: "Listening...",
    submit_apply: "Submit & Run Decision Engine",
    bank_title: "Bank Officer & Credit Manager Workbench",
    bank_sub: "Consolidated 3-Bank Dossier, XGBoost + SHAP Risk Inspector & Constrained MILP Optimizer",
    govt_title: "Government Policy, Geospatial Audit & Tribunal Console",
    govt_sub: "Open-Meteo District Geospatial Monitor (Leaflet), Bank PSL Audit & Live Policy Correction Levers",
    login_btn: "Demo Login",
  },
  hi: {
    app_title: "कृषिसेतु DSS",
    app_subtitle: "त्रि-पक्षीय कृषि ऋण निर्णय प्रणाली (किसान • बैंक • सरकार)",
    glc_target: "वार्षिक कृषि ऋण लक्ष्य:",
    nav_farmer: "किसान पोर्टल",
    nav_bank: "बैंक वर्कबेंच",
    nav_govt: "सरकारी नीति कंसोल",
    nav_guide: "DMS624 गाइड",
    farmer_portal_title: "किसान क्रेडिट एवं कल्याण पोर्टल",
    farmer_portal_sub: "सरल 4-चरणीय आवेदन, एक्सप्लेनेबल एआई निर्णय एवं डिजिटल खाद-बीज ई-रूपी वाउचर",
    tab_apply: "१. नया आवेदन",
    tab_outcome: "२. परिणाम व कारण",
    tab_wallet: "३. वाउचर वॉलेट (e-RUPI)",
    tab_grievances: "४. शिकायत व अपील",
    voice_input: "बोलकर भरें (Voice)",
    listening: "सुन रहा हूँ...",
    submit_apply: "आवेदन जमा करें व निर्णय देखें",
    bank_title: "बैंक अधिकारी एवं क्रेडिट मैनेजर वर्कबेंच",
    bank_sub: "एकीकृत 3-बैंक डोजियर, XGBoost + SHAP जोखिम विश्लेषण एवं MILP पोर्टफोलियो ऑप्टिमाइज़र",
    govt_title: "सरकारी नीति, भू-स्थानिक मानचित्र एवं ट्रिब्यूनल कंसोल",
    govt_sub: "जिला-वार Open-Meteo मानचित्र (Leaflet), बैंक PSL ऑडिट एवं नीति सुधार नियंत्रण",
    login_btn: "डेमो लॉगिन",
  },
};

export function t(lang: Language, key: string): string {
  return TRANSLATIONS[lang]?.[key] || TRANSLATIONS.en[key] || key;
}
