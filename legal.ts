import { Hono } from 'hono';
import type { Env } from '../lib/core';

const legal = new Hono<{ Bindings: Env }>();

const TERMS = {
  title_ar: 'شروط الاستخدام',
  title_en: 'Terms of Service',
  updated: '2026-01-01',
  sections: [
    {
      h_ar: '1. القواعد التنظيمية للنشر',
      h_en: '1. Publishing Rules',
      p_ar: 'يلتزم جميع الأعضاء بنشر محتوى مهني هادف. يُمنع منعاً باتاً نشر أي محتوى مخالف للقوانين، أو محتوى مسيء، أو مضايق للمستخدمين، أو يخالف حقوق الملكية الفكرية للغير. تظل مسؤولية المحتوى المنشور على عاتق صاحبه بالكامل.',
      p_en: 'All members agree to publish purposeful, professional content. Publishing illegal, abusive, harassing, or copyright-infringing material is strictly prohibited. Each member is fully responsible for the content they publish.',
    },
    {
      h_ar: '2. احترام المهن والقطاعات',
      h_en: '2. Respect for Professions',
      p_ar: 'يحق لكل قطاع ومهنة الحفاظ على مجتمعه التخصصي. يُمنع تسجيل الدخول إلى غرف تخصصية لا تتبع مهنة المستخدم. الاحترام المتبادل بين أصحاب المهن المختلفة شرط أساسي للاستمرار على المنصة.',
      p_en: 'Every sector and profession is entitled to its specialised community. Entering professional rooms that do not match your profession is forbidden. Mutual respect between professions is a core requirement to remain on the platform.',
    },
    {
      h_ar: '3. منع الاحتيال',
      h_en: '3. Fraud Prevention',
      p_ar: 'يُمنع أي محاولة للتلاعب بعدد المشاهدات أو المتابعين أو الأرباح. يُمنع انتحال هوية أشخاص أو شركات، أو تقديم سجلات تجارية مزيفة. أي محاولة احتيال تؤدي إلى الإيقاف الدائم وحجز الأرباح.',
      p_en: 'Any attempt to manipulate views, subscribers, or earnings is forbidden. Impersonating people or companies, or submitting fake commercial registrations, is forbidden. Any fraudulent attempt results in permanent suspension and withheld earnings.',
    },
    {
      h_ar: '4. عقوبات الحظر',
      h_en: '4. Ban Penalties',
      p_ar: 'تُطبق عقوبات متدرجة: تحذير، حظر مؤقت بعدد أيام/ساعات محدد مع بيان السبب، ثم حظر دائم في حال التكرار أو المخالفات الجسيمة. الأرباح المكتسبة من مصادر مخالفة تُصادر.',
      p_en: 'Graduated penalties apply: a warning, a temporary ban for a specified number of days/hours with a stated reason, then a permanent ban for repeats or severe violations. Earnings obtained from violating sources are forfeited.',
    },
  ],
};

const PRIVACY = {
  title_ar: 'سياسة الخصوصية',
  title_en: 'Privacy Policy',
  updated: '2026-01-01',
  sections: [
    {
      h_ar: '1. حماية بيانات المستخدمين',
      h_en: '1. Protection of User Data',
      p_ar: 'نجمع الحد الأدنى من البيانات اللازمة لتشغيل الحساب (الاسم، البريد، العمر، النوع، الدولة، المهنة). لا نبيع بياناتك لأي طرف ثالث لأغراض إعلانية.',
      p_en: 'We collect the minimum data required to operate an account (name, email, age, gender, country, profession). We never sell your data to third parties for advertising purposes.',
    },
    {
      h_ar: '2. حماية أرقام الهواتف',
      h_en: '2. Phone Number Protection',
      p_ar: 'تُخزّن أرقام الهواتف بصيغة دولية موحدة وتُقنّع عند العرض للآخرين (مثال: +20****12). لا يمكن لأي عضو آخر رؤية رقمك الكامل.',
      p_en: 'Phone numbers are stored in a unified international format and masked when shown to others (e.g. +20****12). No other member can see your full number.',
    },
    {
      h_ar: '3. حماية السجلات التجارية',
      h_en: '3. Commercial Registration Protection',
      p_ar: 'تُستخدم السجلات التجارية المرفوعة للتحقق من توثيق الشركات فقط، ولا تُنشر علناً ولا تُشارك مع أي جهة تجارية.',
      p_en: 'Uploaded commercial registrations are used solely to verify company badges; they are never published publicly nor shared with any commercial entity.',
    },
    {
      h_ar: '4. تأمين العمليات المالية',
      h_en: '4. Securing Financial Operations',
      p_ar: 'تتم كل عمليات المحفظة والسحب عبر اتصال مشفر. لا نحتفظ ببيانات بطاقات بنكية. تُدقق طلبات السحب يدوياً لحماية الأعضاء من الاحتيال.',
      p_en: 'All wallet and withdrawal operations occur over an encrypted connection. We do not store bank card data. Withdrawal requests are manually reviewed to protect members from fraud.',
    },
  ],
};

const MONETIZATION = {
  title_ar: 'شروط وبرنامج الربح',
  title_en: 'Monetization Terms',
  updated: '2026-01-01',
  sections: [
    {
      h_ar: '1. معايير فتح الربح',
      h_en: '1. Eligibility Criteria',
      p_ar: 'يُفتح برنامج الربح عند وصول القناة إلى 1,000 متابع بالإضافة إلى 4,000 ساعة مشاهدة مؤكدة، أو 10 مليون مشاهدة لفيديوهات Shorts.',
      p_en: 'Monetization unlocks when a channel reaches 1,000 subscribers plus either 4,000 confirmed watch hours or 10 million Shorts views.',
    },
    {
      h_ar: '2. كيفية حساب الأرباح',
      h_en: '2. How Earnings Are Calculated',
      p_ar: 'تُحسب الأرباح وفق نموذج CPM/RPM. الفيديوهات الطويلة: 55% لصانع المحتوى و45% للمنصة. الفيديوهات القصيرة (Shorts): 45% لصانع المحتوى و55% للمنصة.',
      p_en: 'Earnings are computed on a CPM/RPM model. Long videos: 55% to the creator and 45% to the platform. Shorts: 45% to the creator and 55% to the platform.',
    },
    {
      h_ar: '3. شروط السحب',
      h_en: '3. Withdrawal Conditions',
      p_ar: 'تُسحب الأرباح بالدولار الأمريكي ($ USD) عبر تحويل بنكي (IBAN) أو PayPal أو InstaPay، بحد أدنى 100 دولار لكل عملية سحب.',
      p_en: 'Earnings are withdrawn in US Dollars ($ USD) via bank transfer (IBAN), PayPal, or InstaPay, with a minimum of $100 per withdrawal.',
    },
    {
      h_ar: '4. منع المشاهدات الزائفة',
      h_en: '4. Prohibition of Fake Views',
      p_ar: 'يُمنع استخدام أي وسيلة آلية أو مدفوعة لتضخيم المشاهدات أو ساعات المشاهدة. تُستبعد المشاهدات غير الطبيعية آلياً، وتُصادر الأرباح الناتجة عنها.',
      p_en: 'Using any automated or paid means to inflate views or watch hours is forbidden. Abnormal views are automatically filtered out and resulting earnings are forfeited.',
    },
  ],
};

legal.get('/', (c) =>
  c.json({
    ok: true,
    terms: TERMS,
    privacy: PRIVACY,
    monetization: MONETIZATION,
  }),
);

export default legal;
