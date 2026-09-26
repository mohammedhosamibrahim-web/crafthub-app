// CraftHub Global Professions Database (sectors -> professions)
// Each profession: { id, ar, en }. Room slug derives from profession id.

export type Profession = { id: string; ar: string; en: string };
export type Sector = { id: string; ar: string; en: string; icon: string; professions: Profession[] };

export const SECTORS: Sector[] = [
  {
    id: 'engineering',
    ar: 'القطاع الهندسي والتقني',
    en: 'Engineering & Technical',
    icon: 'fa-helmet-safety',
    professions: [
      { id: 'civil_eng', ar: 'هندسة مدنية', en: 'Civil Engineering' },
      { id: 'architect', ar: 'معماري', en: 'Architect' },
      { id: 'software_eng', ar: 'برمجيات وتطوير', en: 'Software & Development' },
      { id: 'electrical_eng', ar: 'هندسة كهرباء', en: 'Electrical Engineering' },
      { id: 'mechanical_eng', ar: 'هندسة ميكانيكا', en: 'Mechanical Engineering' },
      { id: 'mechatronics', ar: 'ميكاترونكس', en: 'Mechatronics' },
      { id: 'networks', ar: 'شبكات', en: 'Networks' },
      { id: 'ai_eng', ar: 'ذكاء اصطناعي', en: 'Artificial Intelligence' },
      { id: 'aviation_eng', ar: 'هندسة طيران', en: 'Aviation Engineering' },
      { id: 'petroleum_eng', ar: 'هندسة بترول', en: 'Petroleum Engineering' },
      { id: 'renewable_eng', ar: 'طاقة متجددة', en: 'Renewable Energy' },
    ],
  },
  {
    id: 'medical',
    ar: 'القطاع الطبي والصحي',
    en: 'Medical & Health',
    icon: 'fa-stethoscope',
    professions: [
      { id: 'physician', ar: 'طب بشري', en: 'Physician' },
      { id: 'dentist', ar: 'طب أسنان', en: 'Dentistry' },
      { id: 'pharmacist', ar: 'صيدلة', en: 'Pharmacy' },
      { id: 'nurse', ar: 'تمريض', en: 'Nursing' },
      { id: 'physiotherapy', ar: 'علاج طبيعي', en: 'Physiotherapy' },
      { id: 'vet', ar: 'طب بيطري', en: 'Veterinary' },
      { id: 'lab_tech', ar: 'تحاليل طبية', en: 'Medical Labs' },
      { id: 'radiology', ar: 'أشعة', en: 'Radiology' },
      { id: 'surgeon', ar: 'جراحة', en: 'Surgery' },
      { id: 'psychiatry', ar: 'طب نفسي', en: 'Psychiatry' },
    ],
  },
  {
    id: 'automotive',
    ar: 'قطاع السيارات والمركبات',
    en: 'Automotive & Vehicles',
    icon: 'fa-car',
    professions: [
      { id: 'auto_dealer_eng', ar: 'مهندس قطاع توكيلات السيارات العالمية', en: 'Global Auto Dealership Engineer' },
      { id: 'auto_repair', ar: 'صيانة وإصلاح سيارات', en: 'Auto Repair & Maintenance' },
      { id: 'car_ecu', ar: 'برمجة شريحة السيارات', en: 'Car ECU Programming' },
      { id: 'auto_mechatronics', ar: 'فني ميكاترونكس سيارات', en: 'Auto Mechatronics Technician' },
      { id: 'showroom_sales', ar: 'إدارة مبيعات المعارض', en: 'Showroom Sales Management' },
    ],
  },
  {
    id: 'media',
    ar: 'قطاع التصوير والإعلام',
    en: 'Photography & Media',
    icon: 'fa-camera',
    professions: [
      { id: 'photographer', ar: 'مصور فوتوغرافي محترف', en: 'Professional Photographer' },
      { id: 'cinematographer', ar: 'مصور فيديو سينمائي', en: 'Cinematic Videographer' },
      { id: 'drone_pilot', ar: 'مصور دروّن Drone', en: 'Drone Pilot' },
      { id: 'content_creator', ar: 'صانع محتوى', en: 'Content Creator' },
      { id: 'audio_distributor', ar: 'موزع صوتي', en: 'Audio Distributor' },
      { id: 'video_editor', ar: 'مونتير', en: 'Video Editor' },
    ],
  },
  {
    id: 'crafts',
    ar: 'قطاع الحرف والمهن اليدوية والصناعية',
    en: 'Crafts & Industrial Trades',
    icon: 'fa-screwdriver-wrench',
    professions: [
      { id: 'plumber', ar: 'سباكة', en: 'Plumbing' },
      { id: 'home_electrician', ar: 'كهرباء منازل', en: 'Home Electrical' },
      { id: 'carpenter', ar: 'نجارة', en: 'Carpentry' },
      { id: 'blacksmith', ar: 'حدادة', en: 'Blacksmithing' },
      { id: 'painter_decor', ar: 'نقاشة وديكور', en: 'Painting & Decor' },
      { id: 'hvac', ar: 'تبريد وتكييف', en: 'HVAC / Refrigeration' },
      { id: 'alumital', ar: 'ألوميتال', en: 'Aluminium Works' },
      { id: 'appliance_repair', ar: 'صيانة أجهزة منزلية', en: 'Home Appliance Repair' },
      { id: 'lathe_tech', ar: 'فني خراطة', en: 'Lathe Technician' },
    ],
  },
  {
    id: 'business',
    ar: 'قطاع التجارة والأعمال',
    en: 'Business & Commerce',
    icon: 'fa-briefcase',
    professions: [
      { id: 'accountant', ar: 'محاسب', en: 'Accountant' },
      { id: 'business_admin', ar: 'إدارة أعمال', en: 'Business Administration' },
      { id: 'digital_marketing', ar: 'تسويق رقمي', en: 'Digital Marketing' },
      { id: 'sales', ar: 'مبيعات', en: 'Sales' },
      { id: 'hr', ar: 'موارد بشرية HR', en: 'Human Resources' },
      { id: 'data_analyst', ar: 'تحليل بيانات', en: 'Data Analysis' },
      { id: 'lawyer', ar: 'مستشار قانوني / محامي', en: 'Legal Consultant / Lawyer' },
      { id: 'import_export', ar: 'استيراد وتصدير', en: 'Import & Export' },
    ],
  },
  {
    id: 'education',
    ar: 'قطاع التعليم والعلوم',
    en: 'Education & Science',
    icon: 'fa-graduation-cap',
    professions: [
      { id: 'teacher', ar: 'معلم / أستاذ مدرسي', en: 'School Teacher' },
      { id: 'lecturer', ar: 'محاضر جامعي', en: 'University Lecturer' },
      { id: 'personal_trainer', ar: 'مدرب شخصي', en: 'Personal Trainer' },
      { id: 'researcher', ar: 'باحث علمي', en: 'Scientific Researcher' },
      { id: 'translator', ar: 'مترجم لغات', en: 'Translator' },
    ],
  },
  {
    id: 'services',
    ar: 'قطاع الخدمات والضيافة',
    en: 'Services & Hospitality',
    icon: 'fa-bell-concierge',
    professions: [
      { id: 'chef', ar: 'طاهي / شيف', en: 'Chef' },
      { id: 'hotel_mgmt', ar: 'إدارة فنادق', en: 'Hotel Management' },
      { id: 'airline_host', ar: 'طيران وضيافة', en: 'Aviation & Hospitality' },
      { id: 'logistics', ar: 'خدمات لوجستية ونقل', en: 'Logistics & Transport' },
    ],
  },
  {
    id: 'general',
    ar: 'متنوع',
    en: 'General',
    icon: 'fa-globe',
    professions: [
      { id: 'general', ar: 'متنوع / تصفح عام', en: 'General / Browse All' },
    ],
  },
];

export const ALL_PROFESSIONS: Profession[] = SECTORS.flatMap((s) => s.professions);

const PMAP = new Map(ALL_PROFESSIONS.map((p) => [p.id, p]));
const SMAP = new Map(SECTORS.map((s) => [s.id, s]));

export function professionById(id: string): Profession | undefined {
  return PMAP.get(id);
}
export function sectorById(id: string): Sector | undefined {
  return SMAP.get(id);
}
export function isGeneral(id: string): boolean {
  return id === 'general';
}
export function sectorOfProfession(professionId: string): Sector | undefined {
  for (const s of SECTORS) if (s.professions.some((p) => p.id === professionId)) return s;
  return undefined;
}
