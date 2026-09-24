/**
 * Country mapping helper for ISO 3166-1 alpha-2 codes
 */

export interface CountryInfo {
  code: string;
  name: string;
  flag?: string;
}

const COUNTRY_NAMES: Record<string, string> = {
  US: "United States",
  GB: "United Kingdom",
  CA: "Canada",
  AU: "Australia",
  DE: "Germany",
  FR: "France",
  ES: "Spain",
  IT: "Italy",
  JP: "Japan",
  KR: "South Korea",
  BR: "Brazil",
  MX: "Mexico",
  IN: "India",
  NL: "Netherlands",
  SE: "Sweden",
  NO: "Norway",
  DK: "Denmark",
  FI: "Finland",
  IE: "Ireland",
  NZ: "New Zealand",
  CH: "Switzerland",
  AT: "Austria",
  BE: "Belgium",
  PL: "Poland",
  PT: "Portugal",
  AR: "Argentina",
  CL: "Chile",
  CO: "Colombia",
  ZA: "South Africa",
  TR: "Turkey",
  GR: "Greece",
  CZ: "Czech Republic",
  HU: "Hungary",
  RO: "Romania",
  SG: "Singapore",
  HK: "Hong Kong",
  TW: "Taiwan",
  TH: "Thailand",
  PH: "Philippines",
  MY: "Malaysia",
  ID: "Indonesia",
  IL: "Israel",
  AE: "United Arab Emirates",
  SA: "Saudi Arabia",
};

/**
 * Returns flag emoji for a 2-letter country code
 */
export function getCountryFlag(code: string): string {
  if (!code || code.length !== 2) return "🌐";
  const upper = code.toUpperCase();
  const codePoints = [...upper].map((c) => 127397 + c.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

/**
 * Returns country name with fallback to code
 */
export function getCountryName(code: string): string {
  const upper = code.toUpperCase();
  if (COUNTRY_NAMES[upper]) {
    return COUNTRY_NAMES[upper];
  }
  // Try Intl.DisplayNames if supported in environment
  try {
    const regionNames = new Intl.DisplayNames(["en"], { type: "region" });
    const name = regionNames.of(upper);
    if (name) return name;
  } catch {
    // fallback
  }
  return upper;
}

/**
 * Formats a country option for dropdowns: e.g. "🇺🇸 United States (US)"
 */
export function formatCountryOption(code: string): { code: string; label: string; name: string; flag: string } {
  const flag = getCountryFlag(code);
  const name = getCountryName(code);
  return {
    code,
    name,
    flag,
    label: `${flag} ${name} (${code})`,
  };
}
