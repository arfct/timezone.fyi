import airportMap from "./airport-map-data.json" with { type: "json" };

// Zone abbreviations. A number is a fixed UTC offset in hours, allowed only
// where the time zone database uses that abbreviation with that offset this
// year (resolve-zone.test.js checks). Everything else maps to an IANA zone, so
// a country's offset changes arrive with tzdata updates.
export const zoneAbbreviations = {
  ACDT: 10.5,
  ACST: 9.5,
  ADT: -3,
  AEDT: 11,
  AEST: 10,
  AFT: "Asia/Kabul",
  AKDT: -8,
  AKST: -9,
  AMST: "Asia/Yerevan",
  AMT: "Asia/Yerevan",
  ART: "America/Argentina/Buenos_Aires",
  AST: -4,
  AWDT: "Australia/Perth",
  AWST: 8,
  AZOST: "Atlantic/Azores",
  AZT: "Asia/Baku",
  BDT: "Asia/Dhaka",
  BIOT: "Indian/Chagos",
  BIT: "Etc/GMT+12",
  BOT: "America/La_Paz",
  BRT: "America/Sao_Paulo",
  BST: 1,
  BTT: "Asia/Thimphu",
  CAT: 2,
  CCT: "Indian/Cocos",
  CEDT: "Europe/Paris",
  CEST: 2,
  CET: 1,
  CHADT: "Pacific/Chatham",
  CHAST: "Pacific/Chatham",
  CHOT: "Asia/Ulaanbaatar",
  CHST: 10,
  CHUT: "Pacific/Chuuk",
  CIST: "Etc/GMT+8",
  CIT: "Asia/Makassar",
  CKT: "Pacific/Rarotonga",
  CLST: "America/Santiago",
  CLT: "America/Santiago",
  COST: "America/Bogota",
  COT: "America/Bogota",
  CVT: "Atlantic/Cape_Verde",
  CWST: "Australia/Eucla",
  CXT: "Indian/Christmas",
  DAVT: "Antarctica/Davis",
  DDUT: "Antarctica/DumontDUrville",
  DFT: "Europe/Paris",
  EASST: "Pacific/Easter",
  EAST: "Pacific/Easter",
  EAT: 3,
  ECT: "America/Guayaquil",
  EEDT: "Europe/Athens",
  EEST: 3,
  EET: 2,
  EGST: "America/Scoresbysund",
  EGT: "America/Scoresbysund",
  EIT: "Asia/Jayapura",
  FET: "Europe/Minsk",
  FJT: "Pacific/Fiji",
  FKST: "Atlantic/Stanley",
  FKT: "Atlantic/Stanley",
  FNT: "America/Noronha",
  GALT: "Pacific/Galapagos",
  GAMT: "Pacific/Gambier",
  GET: "Asia/Tbilisi",
  GFT: "America/Cayenne",
  GILT: "Pacific/Tarawa",
  GIT: "Pacific/Gambier",
  GMT: 0,
  GST: "Asia/Dubai",
  GYT: "America/Guyana",
  HADT: "America/Adak",
  HAEC: "Europe/Paris",
  HAST: "Pacific/Honolulu",
  HKT: 8,
  HMT: "Indian/Kerguelen",
  HOVT: "Asia/Hovd",
  HST: -10,
  ICT: "Asia/Bangkok",
  IDT: 3,
  IOT: "Indian/Chagos",
  IRDT: "Asia/Tehran",
  IRKT: "Asia/Irkutsk",
  IRST: "Asia/Tehran",
  JST: 9,
  KGT: "Asia/Bishkek",
  KOST: "Pacific/Kosrae",
  KRAT: "Asia/Krasnoyarsk",
  LHST: "Australia/Lord_Howe",
  LINT: "Pacific/Kiritimati",
  MAGT: "Asia/Magadan",
  MART: "Pacific/Marquesas",
  MAWT: "Antarctica/Mawson",
  MEST: "Europe/Paris",
  MET: "Europe/Paris",
  MHT: "Pacific/Majuro",
  MIST: "Antarctica/Macquarie",
  MIT: "Pacific/Marquesas",
  MMT: "Asia/Yangon",
  MSK: "Europe/Moscow",
  MUT: "Indian/Mauritius",
  MVT: "Indian/Maldives",
  MYT: "Asia/Kuala_Lumpur",
  NCT: "Pacific/Noumea",
  NDT: -2.5,
  NFT: "Pacific/Norfolk",
  NPT: "Asia/Kathmandu",
  NST: -3.5,
  NT: "America/St_Johns",
  NUT: "Pacific/Niue",
  NZDT: 13,
  NZST: 12,
  OMST: "Asia/Omsk",
  ORAT: "Asia/Oral",
  PDT: -7,
  PET: "America/Lima",
  PETT: "Asia/Kamchatka",
  PGT: "Pacific/Port_Moresby",
  PHOT: "Pacific/Kanton",
  PHT: "Asia/Manila",
  PKT: 5,
  PMDT: "America/Miquelon",
  PMST: "America/Miquelon",
  PONT: "Pacific/Pohnpei",
  RET: "Indian/Reunion",
  ROTT: "Antarctica/Rothera",
  SAKT: "Asia/Sakhalin",
  SAMT: "Europe/Samara",
  SAST: 2,
  SBT: "Pacific/Guadalcanal",
  SCT: "Indian/Mahe",
  SGT: "Asia/Singapore",
  SLT: "Asia/Colombo",
  SRT: "America/Paramaribo",
  SST: -11,
  SYOT: "Antarctica/Syowa",
  TAHT: "Pacific/Tahiti",
  TFT: "Indian/Kerguelen",
  THA: "Asia/Bangkok",
  TJT: "Asia/Dushanbe",
  TKT: "Pacific/Fakaofo",
  TLT: "Asia/Dili",
  TMT: "Asia/Ashgabat",
  TOT: "Pacific/Tongatapu",
  TVT: "Pacific/Funafuti",
  UCT: "UTC",
  ULAT: "Asia/Ulaanbaatar",
  UYST: "America/Montevideo",
  UYT: "America/Montevideo",
  UZT: "Asia/Tashkent",
  VET: "America/Caracas",
  VLAT: "Asia/Vladivostok",
  VOLT: "Europe/Volgograd",
  VOST: "Antarctica/Vostok",
  VUT: "Pacific/Efate",
  WAKT: "Pacific/Wake",
  WAST: "Africa/Windhoek",
  WAT: 1,
  WEDT: "Europe/Lisbon",
  WEST: 1,
  WET: 0,
  WST: "Australia/Perth",
  YAKT: "Asia/Yakutsk",
  YEKT: "Asia/Yekaterinburg",
  // People use these for the region's time all year (PST in July means
  // Pacific time), so they map to a zone that follows daylight saving time
  EDT: "America/New_York",
  EST: "America/New_York",
  ET: "America/New_York",
  CT: "America/Chicago",
  CDT: "America/Chicago",
  CST: "America/Chicago",
  MDT: "America/Denver",
  MST: "America/Denver",
  PST: "America/Los_Angeles",
  PT: "America/Los_Angeles",
  KST: "Asia/Seoul",
  KDT: "Asia/Seoul",
  IST: "Asia/Kolkata",
  UTC: "UTC",
  WIB: "Asia/Jakarta",
  WITA: "Asia/Makassar",
  WIT: "Asia/Jayapura",
};

// Places that beat everything else: corrections to the airport data, and
// nicknames that aren't IATA codes.
const placeAliases = {
  // IATA metropolitan area codes not covered by airport-map-data.json
  // Most metro codes (NYC, LON, TYO, PAR, etc.) are now in the JSON via
  // lxndrblz/Airports citycodes.csv. Only keep overrides here for codes that
  // are absent or incorrect in that dataset.
  TCI: "Atlantic/Canary",   // Tenerife — lxndrblz maps TCI to a Russian airport
  QDF: "America/Chicago",   // Dallas/Fort Worth — not in lxndrblz
  QHO: "America/Chicago",   // Houston — not in lxndrblz
  QMI: "America/New_York",  // Miami — not in lxndrblz

  // City/colloquial aliases that are not IATA airport codes
  SF: "America/Los_Angeles",
  MTV: "America/Los_Angeles",  // Mountain View
  MPO: "America/Los_Angeles",  // Menlo Park Office
  CAM: "America/New_York",     // Cambridge
  TOK: "Asia/Tokyo",           // Tokyo (IATA TOK = Torokina, PNG)
};

// Codes that are both a zone abbreviation and an airport or metro code, where
// the abbreviation doesn't simply win. resolve-zone.test.js fails if an
// abbreviation matches a major place (major-places.json) not listed here.
//   zone:   the abbreviation wins
//   place:  the airport or metro code wins
//   either: both are plausible; the rest of the URL decides
export const collisions = {
  CIT: "place",  // Shymkent; CIT is an obsolete name for WITA
  CLT: "place",  // Charlotte; Chile Time
  GST: "zone",   // Gulf Standard Time; Gustavus, Alaska
  HKT: "either", // Hong Kong Time or Phuket
  ICT: "either", // Indochina Time or Wichita
  IST: "either", // India Standard Time or Istanbul
  MHT: "place",  // Manchester, NH (a medium airport); Marshall Islands Time
  MST: "zone",   // Mountain Time; Maastricht
};

const gmtOffset = /^GMT[+-]\d+$/;

// One code's reading, ignoring the rest of the URL: its value, and whether it
// reads as a zone or a place. A two-sided code has neither until resolveCodes.
function readCode(upper) {
  const collision = collisions[upper];
  if (collision === "either") return {};
  if (upper in placeAliases) return { value: placeAliases[upper], kind: "place" };
  if (upper in zoneAbbreviations && collision !== "place") {
    return { value: zoneAbbreviations[upper], kind: "zone" };
  }
  if (upper in airportMap) return { value: airportMap[upper], kind: "place" };
  if (gmtOffset.test(upper)) return { kind: "zone" };
  return {};
}

// in: the zone codes from a URL, e.g. ["pst", "lhr"]
// out: for each code, a UTC offset in hours (number), an IANA zone name,
// or the code unchanged when nothing matches
export function resolveCodes(codes) {
  const uppers = codes.map((code) => code.toUpperCase());
  const readings = uppers.map(readCode);
  // Two-sided codes follow the first code that reads as a zone or a place
  const preferPlace = readings.find((reading) => reading.kind)?.kind === "place";
  return codes.map((code, i) => {
    const upper = uppers[i];
    if (collisions[upper] === "either") {
      return preferPlace ? airportMap[upper] : zoneAbbreviations[upper];
    }
    return readings[i].value ?? code;
  });
}
