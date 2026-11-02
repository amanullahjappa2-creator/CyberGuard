import { readFile, writeFile } from "node:fs/promises";

const pair = (en, ur) => ({ en, ur });
const item = (titleEn, detailEn, titleUr, detailUr) => ({
  title: pair(titleEn, titleUr),
  detail: pair(detailEn, detailUr),
});
const choice = (en, ur) => pair(en, ur);

const definitions = [
  {
    id: 11,
    skillTag: "passwords",
    type: "auth",
    title: pair("Two-Factor Authentication and SIM Swap", "دو مرحلوں کی تصدیق اور سم سواپ"),
    scenario: pair(
      "Choose a strong sign-in factor and protect recovery from a simulated SIM-swap attempt.",
      "مضبوط سائن اِن طریقہ چنیں اور سم سواپ کی فرضی کوشش سے اکاؤنٹ کی بحالی محفوظ کریں۔",
    ),
    tip: pair(
      "Prefer passkeys or an authenticator app over SMS codes for important accounts; add a carrier account PIN.",
      "اہم اکاؤنٹس کے لیے SMS کے بجائے پاس کی یا تصدیقی ایپ چنیں اور موبائل کمپنی اکاؤنٹ پر پن لگائیں۔",
    ),
    context: pair(
      "Pakistani mobile carriers and mobile-wallet account recovery.",
      "پاکستانی موبائل کمپنیوں اور موبائل والٹ اکاؤنٹ کی بحالی۔",
    ),
    terms: ["passkey", "sim-swap", "otp"],
    items: [
      item(
        "Primary email sign-in",
        "Only an SMS code is offered for a high-value account.",
        "بنیادی ای میل سائن اِن",
        "اہم اکاؤنٹ کے لیے صرف SMS کوڈ دیا گیا ہے۔",
      ),
      item(
        "Mobile carrier account",
        "No account PIN or extra identity check is set.",
        "موبائل کمپنی اکاؤنٹ",
        "اکاؤنٹ پر پن یا اضافی شناختی جانچ موجود نہیں۔",
      ),
      item(
        "Wallet recovery",
        "A support caller asks the user to read an OTP aloud.",
        "والٹ کی بحالی",
        "معاون کال کرنے والا صارف سے OTP بلند آواز میں بتانے کو کہتا ہے۔",
      ),
      item(
        "Training note",
        "Recovery details are private and must not be shared.",
        "تربیتی نوٹ",
        "بحالی کی تفصیل نجی ہے اور شیئر نہیں کرنی چاہیے۔",
      ),
    ],
    choices: [
      choice("Use a passkey or authenticator app", "پاس کی یا تصدیقی ایپ استعمال کریں"),
      choice("Add a carrier account PIN and port-out lock", "موبائل اکاؤنٹ پن اور نمبر منتقلی لاک لگائیں"),
      choice(
        "Never share the OTP; verify in the official app",
        "OTP کبھی نہ بتائیں؛ سرکاری ایپ میں تصدیق کریں",
      ),
      choice(
        "Keep SMS as the only factor and share codes with support",
        "صرف SMS رکھیں اور معاون عملے کو کوڈ بتائیں",
      ),
    ],
    fixes: [0, 1, 2],
  },
  {
    id: 12,
    skillTag: "network",
    type: "wifi",
    title: pair("Public Wi-Fi at a Cafe", "کیفے کا عوامی وائی فائی"),
    scenario: pair(
      "Review a cafe hotspot list and choose safer behavior before signing in.",
      "سائن اِن سے پہلے کیفے کے ہاٹ اسپاٹ دیکھیں اور محفوظ رویہ چنیں۔",
    ),
    tip: pair(
      "Confirm the cafe network name with staff, use HTTPS, avoid sensitive transactions on unknown Wi-Fi, and use a trusted VPN when appropriate.",
      "کیفے کے عملے سے نیٹ ورک نام کی تصدیق کریں، HTTPS استعمال کریں اور نامعلوم وائی فائی پر حساس لین دین سے بچیں۔",
    ),
    context: pair(
      "Cafe, airport and university hotspots used for banking or mobile-wallet access.",
      "کیفے، ہوائی اڈے اور یونیورسٹی کے ہاٹ اسپاٹ پر بینک یا موبائل والٹ کا استعمال۔",
    ),
    terms: ["evil-twin", "vpn", "https"],
    items: [
      item(
        "Cafe_Free_WiFi",
        "The cafe staff confirms this network name.",
        "Cafe_Free_WiFi",
        "کیفے کا عملہ اس نیٹ ورک نام کی تصدیق کرتا ہے۔",
      ),
      item(
        "Cafe_Free_WiFi_Guest",
        "A second, stronger-looking network appears without staff confirmation.",
        "Cafe_Free_WiFi_Guest",
        "ایک دوسرا ملتا جلتا نیٹ ورک عملے کی تصدیق کے بغیر نظر آتا ہے۔",
      ),
      item(
        "Wallet sign-in",
        "The task asks for banking details over an unverified hotspot.",
        "والٹ سائن اِن",
        "کام میں غیر تصدیق شدہ ہاٹ اسپاٹ پر بینک تفصیل مانگی جاتی ہے۔",
      ),
      item(
        "Cafe notice",
        "Staff can confirm the official network name.",
        "کیفے کا نوٹس",
        "عملہ سرکاری نیٹ ورک نام بتا سکتا ہے۔",
      ),
    ],
    choices: [
      choice("Ask staff to confirm the exact network name", "عملے سے درست نیٹ ورک نام کی تصدیق کریں"),
      choice("Avoid sensitive sign-ins on untrusted Wi-Fi", "غیر معتبر وائی فائی پر حساس سائن اِن سے بچیں"),
      choice("Use a trusted VPN and HTTPS when needed", "ضرورت پر معتبر VPN اور HTTPS استعمال کریں"),
      choice(
        "Join the strongest-looking network and ignore warnings",
        "سب سے طاقتور دکھنے والے نیٹ ورک سے جڑیں اور تنبیہ نظرانداز کریں",
      ),
    ],
    fixes: [0, 1, 2],
  },
  {
    id: 13,
    skillTag: "social-engineering",
    type: "marketplace",
    title: pair("QR and Marketplace Payment Scams", "کیو آر اور مارکیٹ پلیس ادائیگی کا دھوکا"),
    scenario: pair(
      "A pretend buyer sends a payment screenshot and a QR code. Verify payment in the official app.",
      "فرضی خریدار ادائیگی کا اسکرین شاٹ اور QR کوڈ بھیجتا ہے۔ سرکاری ایپ میں ادائیگی دیکھیں۔",
    ),
    tip: pair(
      "A screenshot is not proof of payment. Never scan a buyer's payment QR or share an OTP to receive money.",
      "اسکرین شاٹ ادائیگی کا ثبوت نہیں۔ خریدار کا ادائیگی QR اسکین یا رقم لینے کے لیے OTP شیئر نہ کریں۔",
    ),
    context: pair(
      "Online marketplace sales and fictional NovaPay or SahulatPay payment claims.",
      "آن لائن مارکیٹ پلیس اور فرضی NovaPay یا SahulatPay ادائیگی کے دعوے۔",
    ),
    terms: ["qr-payment", "otp", "phishing"],
    items: [
      item(
        "Buyer QR code",
        "Buyer says scanning it will release money to the seller.",
        "خریدار کا QR کوڈ",
        "خریدار کہتا ہے اسے اسکین کرنے سے فروخت کنندہ کو رقم ملے گی۔",
      ),
      item(
        "Payment screenshot",
        "A screenshot claims payment succeeded, but the wallet balance is unchanged.",
        "ادائیگی کا اسکرین شاٹ",
        "اسکرین شاٹ کامیابی دکھاتا ہے مگر والٹ بیلنس نہیں بدلا۔",
      ),
      item(
        "Verification call",
        "The buyer requests an OTP to complete a payment.",
        "تصدیقی کال",
        "خریدار ادائیگی مکمل کرنے کے لیے OTP مانگتا ہے۔",
      ),
      item(
        "Official wallet",
        "The wallet app shows the actual received balance.",
        "سرکاری والٹ",
        "والٹ ایپ موصول شدہ اصل رقم دکھاتی ہے۔",
      ),
    ],
    choices: [
      choice("Check the transaction in the official wallet app", "سرکاری والٹ ایپ میں لین دین دیکھیں"),
      choice("Do not scan a buyer's QR to receive money", "رقم لینے کے لیے خریدار کا QR اسکین نہ کریں"),
      choice("Never share an OTP; report the request", "OTP کبھی نہ بتائیں؛ درخواست رپورٹ کریں"),
      choice(
        "Trust the screenshot and send the item immediately",
        "اسکرین شاٹ پر بھروسا کرکے فوراً چیز بھیج دیں",
      ),
    ],
    fixes: [1, 0, 2],
  },
  {
    id: 14,
    skillTag: "response",
    type: "incident",
    mode: "ordered",
    title: pair("Ransomware Attachment", "رینسم ویئر اٹیچمنٹ"),
    scenario: pair(
      "A simulated office device shows an unexpected attachment and file warning. Contain first, then recover safely.",
      "دفتر کے فرضی آلے پر غیر متوقع اٹیچمنٹ اور فائل تنبیہ ہے۔ پہلے روکیں، پھر محفوظ بحالی کریں۔",
    ),
    tip: pair(
      "Disconnect a suspected infected device from networks, notify support, and restore only from a known-good backup after it is safe.",
      "مشکوک متاثرہ آلہ نیٹ ورک سے الگ کریں، معاون ٹیم کو بتائیں اور محفوظ ہونے پر درست بیک اپ سے بحال کریں۔",
    ),
    context: pair(
      "Home and small-office devices holding family photos or business records.",
      "گھریلو اور چھوٹے دفتر کے آلے جن پر تصاویر یا کاروباری ریکارڈ ہوں۔",
    ),
    terms: ["ransomware", "isolation", "backup"],
    items: [
      item(
        "invoice_viewer.scr",
        "Unexpected executable attachment from an unknown sender.",
        "invoice_viewer.scr",
        "نامعلوم بھیجنے والے کی غیر متوقع چلنے والی فائل۔",
      ),
      item(
        "Network connection",
        "The device is still connected to shared office storage.",
        "نیٹ ورک کنکشن",
        "آلہ اب بھی مشترکہ دفتری ذخیرے سے منسلک ہے۔",
      ),
      item(
        "Backup copy",
        "A dated offline backup is available from before the warning.",
        "بیک اپ نقل",
        "تنبیہ سے پہلے کی تاریخ والا آف لائن بیک اپ موجود ہے۔",
      ),
      item(
        "Routine document",
        "A known text document was already open before the alert.",
        "معمول کی دستاویز",
        "تنبیہ سے پہلے ایک معلوم متنی دستاویز کھلی تھی۔",
      ),
    ],
    choices: [
      choice("Do not open the attachment; report it", "اٹیچمنٹ نہ کھولیں؛ رپورٹ کریں"),
      choice("Disconnect the device and contact support", "آلہ نیٹ ورک سے الگ کرکے معاون ٹیم سے رابطہ کریں"),
      choice("Restore from the verified offline backup", "تصدیق شدہ آف لائن بیک اپ سے بحال کریں"),
      choice("Keep using the device and reconnect backups", "آلہ استعمال کرتے رہیں اور بیک اپ دوبارہ جوڑیں"),
    ],
    fixes: [0, 1, 2],
  },
  {
    id: 15,
    skillTag: "passwords",
    type: "privacy",
    title: pair(
      "Social Media Oversharing and Account Takeover",
      "سوشل میڈیا کی زائد معلومات اور اکاؤنٹ پر قبضہ",
    ),
    scenario: pair(
      "Review a pretend social profile and improve privacy and recovery settings.",
      "فرضی سوشل پروفائل دیکھیں اور رازداری و بحالی کی ترتیبات بہتر کریں۔",
    ),
    tip: pair(
      "Limit public personal details, use a unique password, and keep recovery email and phone current.",
      "عوامی ذاتی تفصیل محدود رکھیں، منفرد پاس ورڈ رکھیں اور بحالی ای میل و فون تازہ رکھیں۔",
    ),
    context: pair(
      "Social accounts linked to school groups, family photos and mobile-wallet recovery.",
      "اسکول گروپس، خاندانی تصاویر اور موبائل والٹ بحالی سے جڑے سوشل اکاؤنٹس۔",
    ),
    terms: ["privacy-controls", "password", "recovery-method"],
    items: [
      item(
        "Public profile",
        "Birth date and family phone numbers are visible to everyone.",
        "عوامی پروفائل",
        "تاریخ پیدائش اور گھر والوں کے فون نمبر سب کو دکھائی دیتے ہیں۔",
      ),
      item(
        "Recovery email",
        "The recovery address belongs to an old, unused mailbox.",
        "بحالی ای میل",
        "بحالی پتہ پرانے اور غیر استعمال شدہ میل باکس کا ہے۔",
      ),
      item(
        "Password reuse",
        "The social account shares its password with another service.",
        "پاس ورڈ کا دوبارہ استعمال",
        "سوشل اکاؤنٹ کا پاس ورڈ دوسری سروس والا ہی ہے۔",
      ),
      item(
        "Audience controls",
        "The profile offers a friends-only audience setting.",
        "دیکھنے والوں کی ترتیب",
        "پروفائل میں صرف دوستوں کے لیے دکھانے کی ترتیب موجود ہے۔",
      ),
    ],
    choices: [
      choice(
        "Restrict sensitive details to a trusted audience",
        "حساس تفصیل قابلِ اعتماد لوگوں تک محدود کریں",
      ),
      choice(
        "Update recovery contacts and test account recovery",
        "بحالی رابطے تازہ کرکے اکاؤنٹ بحالی آزمائیں",
      ),
      choice(
        "Use a unique password and enable two-step verification",
        "منفرد پاس ورڈ اور دو مرحلوں کی تصدیق رکھیں",
      ),
      choice(
        "Leave public details and reuse the same password",
        "عوامی تفصیل رکھیں اور پاس ورڈ دوبارہ استعمال کریں",
      ),
    ],
    fixes: [0, 1, 2],
  },
  {
    id: 16,
    skillTag: "network",
    type: "log",
    title: pair("Authentication Log Analysis", "تصدیقی لاگ کا تجزیہ"),
    scenario: pair(
      "Read a harmless mock authentication log, identify repeated failures, and select a measured response.",
      "فرضی تصدیقی لاگ میں بار بار ناکام کوششیں پہچانیں اور مناسب جواب چنیں۔",
    ),
    tip: pair(
      "Use rate limits, multi-factor authentication and account-specific review; do not block broad networks without evidence.",
      "رفتار کی حد اور دو مرحلوں کی تصدیق رکھیں؛ ثبوت کے بغیر پورے نیٹ ورک کو بلاک نہ کریں۔",
    ),
    context: pair(
      "Repeated sign-in attempts against school portals and small-business email.",
      "اسکول پورٹل اور چھوٹے کاروبار کی ای میل پر بار بار سائن اِن کوششیں۔",
    ),
    terms: ["authentication-log", "rate-limit", "mfa"],
    items: [
      item(
        "02:13 / account demo",
        "Several failed sign-ins appear in a short time window.",
        "02:13 / فرضی اکاؤنٹ",
        "کم وقت میں کئی ناکام سائن اِن دکھائی دیتے ہیں۔",
      ),
      item(
        "Source 192.0.2.44",
        "Reserved documentation address repeats in the training log.",
        "ذریعہ 192.0.2.44",
        "تربیتی لاگ میں محفوظ دستاویزی پتہ بار بار آتا ہے۔",
      ),
      item(
        "Successful family login",
        "A known device signed in normally earlier that day.",
        "کامیاب خاندانی لاگ اِن",
        "اسی دن پہلے ایک معلوم آلے سے معمول کا سائن اِن ہوا۔",
      ),
      item(
        "Response policy",
        "Limit repeated attempts and review the affected account.",
        "جوابی پالیسی",
        "بار بار کوشش محدود کرکے متاثرہ اکاؤنٹ دیکھیں۔",
      ),
    ],
    choices: [
      choice(
        "Review the account and block the observed source in the simulation",
        "اکاؤنٹ دیکھیں اور فرضی ماحول میں دکھایا ذریعہ روکیں",
      ),
      choice(
        "Apply rate limits and strengthen sign-in verification",
        "رفتار محدود کریں اور سائن اِن تصدیق مضبوط کریں",
      ),
      choice(
        "Preserve the log and notify the responsible administrator",
        "لاگ محفوظ کرکے ذمہ دار منتظم کو اطلاع دیں",
      ),
      choice("Disable all accounts and delete the log", "تمام اکاؤنٹ بند کرکے لاگ حذف کریں"),
    ],
    fixes: [1, 0, 2],
  },
  {
    id: 17,
    skillTag: "network",
    type: "terminal",
    title: pair("Linux File Permissions", "لینکس فائل کی اجازتیں"),
    scenario: pair(
      "Inspect a simulated terminal listing and reduce overly broad file access.",
      "فرضی ٹرمینل فہرست دیکھیں اور ضرورت سے زیادہ فائل رسائی محدود کریں۔",
    ),
    tip: pair(
      "Give files only the owner and service access they need; review ownership before changing permissions.",
      "فائل کو صرف مالک اور ضروری سروس کی رسائی دیں؛ اجازت بدلنے سے پہلے ملکیت دیکھیں۔",
    ),
    context: pair(
      "Shared school-lab computers and small-office web servers.",
      "اسکول لیب کے مشترکہ کمپیوٹر اور چھوٹے دفتر کے ویب سرور۔",
    ),
    terms: ["file-permissions", "least-privilege", "ownership"],
    items: [
      item(
        "-rwxrwxrwx notes.conf",
        "Every user can read, change and run a configuration file.",
        "-rwxrwxrwx notes.conf",
        "ہر صارف ترتیب والی فائل پڑھ، بدل اور چلا سکتا ہے۔",
      ),
      item(
        "owner: root / service: web",
        "The service account does not own the file it must safely read.",
        "مالک: root / سروس: web",
        "سروس اکاؤنٹ اس فائل کا مالک نہیں جسے اسے محفوظ طور پر پڑھنا ہے۔",
      ),
      item(
        "shared-data/",
        "A private directory is writable by all local users.",
        "shared-data/",
        "نجی فولڈر تمام مقامی صارفین کے لیے قابلِ تحریر ہے۔",
      ),
      item(
        "-rw-r----- report.txt",
        "Only the owner and approved group can read the report.",
        "-rw-r----- report.txt",
        "صرف مالک اور منظور شدہ گروپ رپورٹ پڑھ سکتے ہیں۔",
      ),
    ],
    choices: [
      choice(
        "Use least privilege for the owner and service group",
        "مالک اور سروس گروپ کو کم سے کم ضروری اجازت دیں",
      ),
      choice("Set the correct owner and group for the service", "سروس کے لیے درست مالک اور گروپ رکھیں"),
      choice("Remove write access from unrelated users", "غیر متعلقہ صارفین کی تحریر کی اجازت ہٹائیں"),
      choice("Make every file writable by every user", "ہر فائل ہر صارف کے لیے قابلِ تحریر بنائیں"),
    ],
    fixes: [0, 1, 2],
  },
  {
    id: 18,
    skillTag: "phishing",
    type: "headers",
    title: pair("Email Header Analysis", "ای میل ہیڈر کا تجزیہ"),
    scenario: pair(
      "Compare simplified sender-authentication results and decide which message is trustworthy.",
      "بھیجنے والے کی سادہ تصدیقی رپورٹ دیکھیں اور قابلِ اعتماد پیغام چنیں۔",
    ),
    tip: pair(
      "SPF, DKIM and DMARC results are useful signals, not proof by themselves; verify unusual requests independently.",
      "SPF، DKIM اور DMARC مفید اشارے ہیں مگر اکیلے ثبوت نہیں؛ غیر معمولی درخواست الگ سے چیک کریں۔",
    ),
    context: pair(
      "School announcements, bank alerts and mobile-wallet support emails.",
      "اسکول اعلانات، بینک تنبیہ اور موبائل والٹ معاونت کی ای میل۔",
    ),
    terms: ["spf", "dkim", "dmarc"],
    items: [
      item(
        "From: bank.example / DMARC fail",
        "Displayed sender does not align with the authenticated domain.",
        "From: bank.example / DMARC ناکام",
        "دکھایا بھیجنے والا تصدیق شدہ ڈومین سے مطابقت نہیں رکھتا۔",
      ),
      item(
        "SPF: pass / DKIM: pass",
        "A known school newsletter domain passes both sample checks.",
        "SPF: کامیاب / DKIM: کامیاب",
        "اسکول کے معلوم خبرنامہ ڈومین کی دونوں فرضی جانچ کامیاب ہیں۔",
      ),
      item(
        "Reply-To: unrelated.example",
        "The reply address differs from the claimed organization.",
        "Reply-To: unrelated.example",
        "جوابی پتہ دعویٰ کرنے والے ادارے سے مختلف ہے۔",
      ),
      item(
        "Expected class update",
        "The family was expecting this message from the verified school channel.",
        "متوقع جماعتی اطلاع",
        "خاندان کو تصدیق شدہ اسکول ذریعے سے یہ پیغام متوقع تھا۔",
      ),
    ],
    choices: [
      choice(
        "Treat failed alignment as suspicious and verify separately",
        "ناکام مطابقت کو مشکوک سمجھ کر الگ تصدیق کریں",
      ),
      choice(
        "Use the known school channel for expected notices",
        "متوقع اطلاع کے لیے اسکول کا معلوم ذریعہ استعمال کریں",
      ),
      choice("Report the spoofed message and avoid replying", "جعلی پیغام رپورٹ کریں اور جواب نہ دیں"),
      choice(
        "Trust the display name even when authentication fails",
        "تصدیق ناکام ہونے پر بھی دکھائے نام پر بھروسا کریں",
      ),
    ],
    fixes: [0, 1, 2],
  },
  {
    id: 19,
    skillTag: "web",
    type: "code",
    title: pair("Encryption Basics", "انکرپشن کے بنیادی اصول"),
    scenario: pair(
      "Choose the right protection for stored passwords, private records and data in transit.",
      "محفوظ پاس ورڈ، نجی ریکارڈ اور منتقل ہونے والے ڈیٹا کے لیے درست حفاظت چنیں۔",
    ),
    tip: pair(
      "Hash passwords with a purpose-built password hashing function and unique salts; encrypt data that must later be read; use HTTPS in transit.",
      "پاس ورڈ کے لیے مخصوص ہیش اور منفرد سالٹ رکھیں؛ واپس پڑھنے والا ڈیٹا انکرپٹ اور منتقلی پر HTTPS استعمال کریں۔",
    ),
    context: pair(
      "Student records and account sign-ins for Pakistani online services.",
      "پاکستانی آن لائن سروسز کے طالب علم ریکارڈ اور اکاؤنٹ سائن اِن۔",
    ),
    terms: ["hashing", "salting", "encryption", "https"],
    items: [
      item(
        "Stored password",
        "The application needs to verify a password without storing its readable value.",
        "محفوظ پاس ورڈ",
        "ایپ کو پڑھنے کے قابل قدر رکھے بغیر پاس ورڈ کی تصدیق چاہیے۔",
      ),
      item(
        "Private report",
        "Staff need to read this file later, but outsiders must not.",
        "نجی رپورٹ",
        "عملے کو بعد میں فائل پڑھنی ہے مگر باہر والوں کو نہیں۔",
      ),
      item(
        "Password database",
        "Identical passwords should not produce identical stored hashes.",
        "پاس ورڈ ڈیٹا بیس",
        "ایک جیسے پاس ورڈ کے محفوظ ہیش ایک جیسے نہیں ہونے چاہئیں۔",
      ),
      item(
        "Web connection",
        "A browser sends account data to the official service.",
        "ویب کنکشن",
        "براؤزر اکاؤنٹ ڈیٹا سرکاری سروس کو بھیجتا ہے۔",
      ),
    ],
    choices: [
      choice(
        "Use a password-hashing function with a unique salt",
        "منفرد سالٹ کے ساتھ پاس ورڈ ہیش فنکشن استعمال کریں",
      ),
      choice("Encrypt the report with managed keys", "رپورٹ کو منظم کلیدوں سے انکرپٹ کریں"),
      choice("Use HTTPS to protect data in transit", "منتقلی کے ڈیٹا کے لیے HTTPS استعمال کریں"),
      choice("Store passwords as plain text for easy lookup", "آسان تلاش کے لیے پاس ورڈ سادہ متن میں رکھیں"),
    ],
    fixes: [0, 1, 0],
  },
  {
    id: 20,
    skillTag: "response",
    type: "backup",
    boss: true,
    title: pair("Backup and Recovery: 3-2-1", "بیک اپ اور بحالی: 3-2-1"),
    scenario: pair(
      "Build a small-office backup plan with three copies, two kinds of storage and one off-site copy.",
      "تین نقول، دو قسم کے ذخیرے اور ایک بیرونی نقل سے چھوٹے دفتر کا بیک اپ منصوبہ بنائیں۔",
    ),
    tip: pair(
      "Keep three copies on two storage types with one isolated off-site copy, and test recovery regularly.",
      "دو قسم کے ذخیرے پر تین نقول رکھیں، ایک بیرونی اور الگ نقل ہو، اور بحالی باقاعدہ آزمائیں۔",
    ),
    context: pair(
      "Small Pakistani businesses protecting payroll, invoices and customer records.",
      "پاکستانی چھوٹے کاروبار جو تنخواہ، رسید اور صارف ریکارڈ محفوظ رکھتے ہیں۔",
    ),
    terms: ["backup", "3-2-1-backup", "recovery"],
    items: [
      item(
        "Working files",
        "The live office files are the first copy, not a backup.",
        "کام کی فائلیں",
        "دفتر کی اصل فائلیں پہلی نقل ہیں، بیک اپ نہیں۔",
      ),
      item(
        "Local backup drive",
        "A second copy is kept on the same desk as the computer.",
        "مقامی بیک اپ ڈرائیو",
        "دوسری نقل کمپیوٹر کے ساتھ اسی میز پر رکھی ہے۔",
      ),
      item(
        "Off-site protected copy",
        "A separate encrypted copy is stored away from the office.",
        "بیرونی محفوظ نقل",
        "الگ انکرپٹ شدہ نقل دفتر سے دور رکھی جاتی ہے۔",
      ),
      item(
        "Recovery drill",
        "No one has tested restoring a file from the backup.",
        "بحالی کی مشق",
        "کسی نے بیک اپ سے فائل واپس لانے کی جانچ نہیں کی۔",
      ),
    ],
    choices: [
      choice("Keep three copies across two storage types", "دو قسم کے ذخیرے پر تین نقول رکھیں"),
      choice("Keep one isolated off-site copy", "ایک الگ بیرونی نقل رکھیں"),
      choice("Test restoring files on a regular schedule", "باقاعدہ وقت پر فائل بحال کرنا آزمائیں"),
      choice("Keep every copy connected to the same computer", "تمام نقول اسی کمپیوٹر سے منسلک رکھیں"),
    ],
    fixes: [0, 0, 2],
  },
  {
    id: 21,
    skillTag: "web",
    type: "log",
    title: pair("SQL Injection Recognition", "SQL انجیکشن کی پہچان"),
    scenario: pair(
      "A harmless login-log sample contains unusual input. Choose the code-level fix, not a real test.",
      "فرضی لاگ اِن لاگ میں غیر معمولی متن ہے۔ حقیقی ٹیسٹ نہیں، کوڈ کا محفوظ حل چنیں۔",
    ),
    tip: pair(
      "Use parameterized queries, validate inputs on the server and keep detailed errors out of public responses.",
      "پیرامیٹر والے سوال، سرور پر ان پٹ جانچ اور عوامی جواب سے اندرونی خرابی کی تفصیل دور رکھیں۔",
    ),
    context: pair(
      "School portals and local service websites that store account records.",
      "اکاؤنٹ ریکارڈ رکھنے والے اسکول پورٹل اور مقامی سروس ویب سائٹس۔",
    ),
    terms: ["sql-injection", "parameterized-query", "input-validation"],
    items: [
      item(
        "Login input",
        "Harmless training text: ' OR demo = demo",
        "لاگ اِن ان پٹ",
        "بے ضرر تربیتی متن: ' OR demo = demo",
      ),
      item(
        "Query builder",
        "The sample joins user text into a database command.",
        "سوال بنانے والا کوڈ",
        "نمونہ صارف متن کو ڈیٹا بیس ہدایت میں جوڑتا ہے۔",
      ),
      item(
        "Database error",
        "A public response displays detailed internal query information.",
        "ڈیٹا بیس خرابی",
        "عوامی جواب اندرونی سوال کی تفصیل دکھاتا ہے۔",
      ),
      item(
        "Normal sign-in",
        "A valid account enters through the regular form.",
        "معمول کا سائن اِن",
        "درست اکاؤنٹ عام فارم سے داخل ہوتا ہے۔",
      ),
    ],
    choices: [
      choice("Use a parameterized query", "پیرامیٹر والا ڈیٹا بیس سوال استعمال کریں"),
      choice("Validate input on the server", "سرور پر ان پٹ کی جانچ کریں"),
      choice(
        "Return a generic public error and log details privately",
        "عوامی طور پر عام خرابی دکھائیں اور تفصیل نجی لاگ کریں",
      ),
      choice("Join submitted text directly into the query", "بھیجا گیا متن براہ راست سوال میں جوڑیں"),
    ],
    fixes: [0, 0, 2],
  },
  {
    id: 22,
    skillTag: "web",
    type: "code",
    title: pair("Cross-Site Scripting: Safe Output", "کراس سائٹ اسکرپٹنگ: محفوظ آؤٹ پٹ"),
    scenario: pair(
      "Review a simulated comment preview and select the safe way to display user text.",
      "فرضی تبصرہ پیش منظر دیکھیں اور صارف متن دکھانے کا محفوظ طریقہ چنیں۔",
    ),
    tip: pair(
      "Encode untrusted text for its output context, use safe DOM APIs, and apply a restrictive content policy.",
      "غیر معتبر متن کو آؤٹ پٹ کے مطابق انکوڈ کریں، محفوظ DOM طریقے اور محدود مواد پالیسی استعمال کریں۔",
    ),
    context: pair(
      "Comments on school, community and small-business websites.",
      "اسکول، کمیونٹی اور چھوٹے کاروبار کی ویب سائٹ کے تبصرے۔",
    ),
    terms: ["xss", "output-encoding", "csp"],
    items: [
      item(
        "Comment input",
        "Harmless text marker: script-demo-text; the preview treats it as markup.",
        "تبصرے کا ان پٹ",
        "بے ضرر متنی نشان: script-demo-text؛ پیش منظر اسے مارک اپ سمجھتا ہے۔",
      ),
      item(
        "Page preview",
        "Submitted text is inserted as HTML instead of visible text.",
        "صفحے کا پیش منظر",
        "بھیجا گیا متن دکھائی دینے والے متن کے بجائے HTML کے طور پر شامل ہے۔",
      ),
      item(
        "Stored comments",
        "Other visitors see the same unsafe rendering.",
        "محفوظ تبصرے",
        "دوسرے زائرین بھی یہی غیر محفوظ دکھائی دیکھتے ہیں۔",
      ),
      item(
        "Plain note",
        "A static staff note is already displayed as text.",
        "سادہ نوٹ",
        "عملے کا جامد نوٹ پہلے ہی متن کی صورت میں دکھایا گیا ہے۔",
      ),
    ],
    choices: [
      choice("Encode output for the correct HTML context", "درست HTML سیاق کے لیے آؤٹ پٹ انکوڈ کریں"),
      choice(
        "Render user text with textContent, not HTML insertion",
        "صارف متن HTML کے بجائے textContent سے دکھائیں",
      ),
      choice("Apply a restrictive content security policy", "محدود مواد سیکیورٹی پالیسی لگائیں"),
      choice("Trust every submitted comment as safe markup", "ہر بھیجے تبصرے کو محفوظ مارک اپ سمجھیں"),
    ],
    fixes: [1, 0, 1],
  },
  {
    id: 23,
    skillTag: "cloud",
    type: "repository",
    title: pair("Secrets in a Public Repository", "عوامی ریپوزٹری میں خفیہ معلومات"),
    scenario: pair(
      "A pretend repository contains a committed API key. Contain the exposure and prevent another commit.",
      "فرضی ریپوزٹری میں API key جمع ہے۔ افشا روکیں اور دوبارہ جمع ہونے سے بچائیں۔",
    ),
    tip: pair(
      "Revoke and rotate exposed keys immediately, remove secret files from future commits, and enable secret scanning.",
      "ظاہر شدہ key فوراً منسوخ اور تبدیل کریں، آئندہ فائل روکیں اور راز کی جانچ فعال کریں۔",
    ),
    context: pair(
      "Student projects and small-business code shared on public hosting platforms.",
      "عوامی ہوسٹنگ پر شیئر کیے طالب علم پروجیکٹ اور چھوٹے کاروبار کا کوڈ۔",
    ),
    terms: ["secret", "secret-scanning", "gitignore"],
    items: [
      item(
        ".env in commit history",
        "A training-only fake key string is visible in a public commit.",
        "کمیٹ کی تاریخ میں .env",
        "عوامی کمیٹ میں صرف تربیت کے لیے جعلی key دکھائی دیتی ہے۔",
      ),
      item(
        "Active service key",
        "The simulated key may still grant account access.",
        "فعال سروس key",
        "فرضی key سے اب بھی اکاؤنٹ تک رسائی مل سکتی ہے۔",
      ),
      item(
        ".gitignore",
        "The ignore list does not exclude local secret files.",
        ".gitignore",
        "نظرانداز فہرست مقامی خفیہ فائلیں خارج نہیں کرتی۔",
      ),
      item(
        "Secret scanning",
        "No automated check warns before a secret is committed.",
        "راز کی جانچ",
        "راز جمع ہونے سے پہلے کوئی خودکار تنبیہ نہیں۔",
      ),
    ],
    choices: [
      choice("Revoke the exposed key and issue a new one", "ظاہر شدہ key منسوخ کرکے نئی بنائیں"),
      choice("Add local secret files to .gitignore", "مقامی راز والی فائلیں .gitignore میں شامل کریں"),
      choice("Enable secret scanning and review history", "راز کی خودکار جانچ فعال کرکے تاریخ دیکھیں"),
      choice(
        "Delete the visible line and keep the same key active",
        "دکھائی لائن حذف کرکے وہی key فعال رکھیں",
      ),
    ],
    fixes: [0, 0, 1],
  },
  {
    id: 24,
    skillTag: "web",
    type: "web-app",
    title: pair("Broken Access Control", "رسائی کے کنٹرول کی خرابی"),
    scenario: pair(
      "A simulated record page lets a user request a record that belongs to another account.",
      "فرضی ریکارڈ صفحہ صارف کو دوسرے اکاؤنٹ کا ریکارڈ مانگنے دیتا ہے۔",
    ),
    tip: pair(
      "Check authorization on the server for every requested record; hiding a button or changing a URL is not access control.",
      "ہر ریکارڈ کی اجازت سرور پر جانچیں؛ بٹن چھپانا یا URL بدلنا رسائی کنٹرول نہیں۔",
    ),
    context: pair(
      "Student grades, delivery records and customer details in Pakistani web services.",
      "پاکستانی ویب سروسز میں طالب علم نمبر، ترسیل اور صارف کی تفصیل۔",
    ),
    terms: ["broken-access-control", "authorization", "least-privilege"],
    items: [
      item(
        "Record 104",
        "Signed-in demo user opens their own record.",
        "ریکارڈ 104",
        "سائن اِن فرضی صارف اپنا ریکارڈ کھولتا ہے۔",
      ),
      item(
        "Record 105",
        "Changing a record number returns someone else's private data.",
        "ریکارڈ 105",
        "ریکارڈ نمبر بدلنے سے دوسرے شخص کا نجی ڈیٹا آ جاتا ہے۔",
      ),
      item(
        "Server authorization",
        "The server checks whether the current user owns the requested record.",
        "سرور کی اجازت",
        "سرور دیکھتا ہے کہ موجودہ صارف مانگے ریکارڈ کا مالک ہے یا نہیں۔",
      ),
      item(
        "Hidden menu item",
        "A hidden link does not prevent a direct request.",
        "چھپا ہوا مینو",
        "چھپا لنک براہ راست درخواست نہیں روکتا۔",
      ),
    ],
    choices: [
      choice(
        "Check record ownership and role on every server request",
        "ہر سرور درخواست پر ریکارڈ کی ملکیت اور کردار دیکھیں",
      ),
      choice(
        "Return only records authorized for the current user",
        "موجودہ صارف کے مجاز ریکارڈ ہی واپس کریں",
      ),
      choice(
        "Log and review denied cross-account requests",
        "دوسرے اکاؤنٹ کی مسترد درخواستیں لاگ کرکے دیکھیں",
      ),
      choice(
        "Hide the link but leave the server endpoint unchanged",
        "لنک چھپائیں مگر سرور راستہ ویسا ہی چھوڑیں",
      ),
    ],
    fixes: [1, 0, 0],
  },
  {
    id: 25,
    skillTag: "cloud",
    type: "cloud",
    boss: true,
    title: pair("Cloud Storage Misconfiguration", "کلاؤڈ ذخیرے کی غلط ترتیب"),
    scenario: pair(
      "Review a pretend cloud account and reduce public access and excessive permissions.",
      "فرضی کلاؤڈ اکاؤنٹ دیکھیں اور عوامی رسائی و ضرورت سے زیادہ اجازت کم کریں۔",
    ),
    tip: pair(
      "Keep storage private by default, grant narrowly scoped roles, and review access logs and sharing links.",
      "ذخیرہ پہلے سے نجی رکھیں، محدود کردار دیں اور رسائی لاگ و شیئر لنک دیکھیں۔",
    ),
    context: pair(
      "Small offices storing invoices, family documents or student information in cloud services.",
      "کلاؤڈ پر رسید، خاندانی دستاویز یا طالب علم معلومات رکھنے والے چھوٹے دفاتر۔",
    ),
    terms: ["cloud-bucket", "iam-role", "least-privilege"],
    items: [
      item(
        "Public storage bucket",
        "Anyone with the link can list and read training files.",
        "عوامی ذخیرہ",
        "لنک رکھنے والا کوئی بھی شخص تربیتی فائلیں دیکھ سکتا ہے۔",
      ),
      item(
        "Administrator role",
        "A read-only report tool has full account permissions.",
        "منتظم کردار",
        "صرف رپورٹ پڑھنے والے آلے کو پورے اکاؤنٹ کی اجازت ہے۔",
      ),
      item(
        "Sharing link",
        "An old link remains available after the project ended.",
        "شیئر لنک",
        "پروجیکٹ ختم ہونے کے بعد بھی پرانا لنک فعال ہے۔",
      ),
      item(
        "Access log",
        "The service records when objects are viewed.",
        "رسائی لاگ",
        "سروس فائل دیکھے جانے کا وقت محفوظ کرتی ہے۔",
      ),
    ],
    choices: [
      choice(
        "Set storage private and allow only named users",
        "ذخیرہ نجی کرکے صرف نامزد صارفین کو اجازت دیں",
      ),
      choice(
        "Replace broad permissions with a least-privilege role",
        "وسیع اجازت کو کم سے کم اختیار والے کردار سے بدلیں",
      ),
      choice("Expire old links and review access logs", "پرانے لنک ختم کرکے رسائی لاگ دیکھیں"),
      choice(
        "Leave data public and grant every tool administrator access",
        "ڈیٹا عوامی رکھیں اور ہر آلے کو منتظم رسائی دیں",
      ),
    ],
    fixes: [0, 1, 2],
  },
  {
    id: 26,
    skillTag: "response",
    type: "sandbox",
    title: pair("Malware Sandbox Report", "مالویئر سینڈ باکس رپورٹ"),
    scenario: pair(
      "Read a simulated sandbox report and separate suspicious behavior from ordinary activity.",
      "فرضی سینڈ باکس رپورٹ دیکھیں اور مشکوک رویے کو معمول کی سرگرمی سے الگ کریں۔",
    ),
    tip: pair(
      "Treat unexpected persistence, credential access and unexplained outbound connections as signals; isolate and escalate using approved procedures.",
      "غیر متوقع مستقل موجودگی، اسناد تک رسائی اور نامعلوم بیرونی کنکشن کو اشارہ سمجھیں؛ منظور شدہ طریقے سے الگ اور رپورٹ کریں۔",
    ),
    context: pair(
      "Suspicious attachments received by school and small-business staff.",
      "اسکول اور چھوٹے کاروبار کے عملے کو ملنے والی مشکوک اٹیچمنٹ۔",
    ),
    terms: ["sandbox", "malware", "isolation"],
    items: [
      item(
        "Startup change",
        "The sample tries to run again after a simulated restart.",
        "آغاز کی تبدیلی",
        "نمونہ فرضی دوبارہ آغاز کے بعد پھر چلنے کی کوشش کرتا ہے۔",
      ),
      item(
        "Credential access",
        "The report notes an unexpected request to read saved sign-in data.",
        "اسناد تک رسائی",
        "رپورٹ محفوظ سائن اِن معلومات پڑھنے کی غیر متوقع درخواست بتاتی ہے۔",
      ),
      item(
        "Outbound connection",
        "A simulated process contacts an unrecognized external destination.",
        "بیرونی کنکشن",
        "فرضی عمل نامعلوم بیرونی منزل سے رابطہ کرتا ہے۔",
      ),
      item(
        "Document preview",
        "A known text document opens without changing system settings.",
        "دستاویز پیش منظر",
        "معلوم متنی دستاویز نظام ترتیب بدلے بغیر کھلتی ہے۔",
      ),
    ],
    choices: [
      choice("Treat unexpected persistence as suspicious", "غیر متوقع مستقل موجودگی کو مشکوک سمجھیں"),
      choice("Escalate unexpected credential access", "غیر متوقع اسناد رسائی کی اطلاع دیں"),
      choice("Isolate the device and preserve the report", "آلہ الگ کرکے رپورٹ محفوظ کریں"),
      choice(
        "Ignore all findings because the report is simulated",
        "رپورٹ فرضی ہونے پر تمام نتائج نظرانداز کریں",
      ),
    ],
    fixes: [0, 1, 2],
  },
  {
    id: 27,
    skillTag: "response",
    type: "timeline",
    mode: "ordered",
    title: pair("Digital Forensics Timeline", "ڈیجیٹل تفتیش کی ٹائم لائن"),
    scenario: pair(
      "Order simulated evidence events to reconstruct a clear incident timeline before taking action.",
      "اقدام سے پہلے واقعے کی ترتیب سمجھنے کے لیے فرضی شواہد کو وقت کے مطابق مرتب کریں۔",
    ),
    tip: pair(
      "Preserve original evidence, note time zones and record each action so the timeline can be reviewed.",
      "اصل ثبوت محفوظ رکھیں، ٹائم زون لکھیں اور ہر اقدام درج کریں تاکہ ٹائم لائن دوبارہ دیکھی جا سکے۔",
    ),
    context: pair(
      "Investigating a compromised family email or small-office account.",
      "متاثرہ خاندانی ای میل یا چھوٹے دفتر کے اکاؤنٹ کی جانچ۔",
    ),
    terms: ["forensic-timeline", "evidence", "incident-response"],
    items: [
      item(
        "08:02 / message arrives",
        "A pretend attachment is delivered to the inbox.",
        "08:02 / پیغام موصول",
        "فرضی اٹیچمنٹ اِن باکس میں آتی ہے۔",
      ),
      item(
        "08:07 / sign-in alert",
        "An unfamiliar sign-in appears in the simulated account log.",
        "08:07 / سائن اِن تنبیہ",
        "فرضی اکاؤنٹ لاگ میں نامعلوم سائن اِن دکھائی دیتا ہے۔",
      ),
      item(
        "08:10 / support notified",
        "The account owner records the alert and contacts support.",
        "08:10 / معاونت کو اطلاع",
        "اکاؤنٹ مالک تنبیہ لکھ کر معاونت سے رابطہ کرتا ہے۔",
      ),
      item(
        "08:15 / device isolated",
        "A support-approved response disconnects the affected device.",
        "08:15 / آلہ الگ",
        "معاونت کے منظور شدہ جواب میں متاثرہ آلہ الگ کیا جاتا ہے۔",
      ),
    ],
    choices: [
      choice("Place the earliest recorded evidence first", "سب سے پہلے درج ثبوت کو پہلے رکھیں"),
      choice("Keep timestamps with their time-zone context", "وقت کے ساتھ ٹائم زون کی معلومات بھی رکھیں"),
      choice("Preserve notes before changing the device", "آلہ بدلنے سے پہلے نوٹس محفوظ رکھیں"),
      choice("Reorder events by guess and discard original times", "اندازے سے ترتیب بدل کر اصل وقت مٹا دیں"),
    ],
    fixes: [0, 1, 2],
  },
  {
    id: 28,
    skillTag: "response",
    type: "log",
    title: pair("Insider Threat: Safe Response", "اندرونی خطرہ: محفوظ ردعمل"),
    scenario: pair(
      "Review a fictional export log. Respond to unusual behavior fairly, preserve evidence and notify the right team.",
      "فرضی ڈیٹا برآمد لاگ دیکھیں۔ غیر معمولی رویے پر منصفانہ جواب، ثبوت محفوظ اور درست ٹیم کو اطلاع دیں۔",
    ),
    tip: pair(
      "Follow a documented process, limit access only as authorized, preserve logs and avoid accusations based on one signal.",
      "تحریری طریقہ اپنائیں، اجازت کے مطابق رسائی محدود، لاگ محفوظ رکھیں اور ایک اشارے پر الزام نہ لگائیں۔",
    ),
    context: pair(
      "Small-business customer lists, school records and payroll exports.",
      "چھوٹے کاروبار کی صارف فہرست، اسکول ریکارڈ اور تنخواہ کی برآمد۔",
    ),
    terms: ["insider-threat", "data-loss-prevention", "evidence"],
    items: [
      item(
        "Bulk export at unusual time",
        "A demo account exports far more records than its normal task requires.",
        "غیر معمولی وقت پر بڑی برآمد",
        "فرضی اکاؤنٹ اپنے معمول کے کام سے کہیں زیادہ ریکارڈ نکالتا ہے۔",
      ),
      item(
        "Access outside role",
        "The account requests a folder unrelated to its assigned work.",
        "کردار سے باہر رسائی",
        "اکاؤنٹ اپنے کام سے غیر متعلق فولڈر مانگتا ہے۔",
      ),
      item(
        "Audit record",
        "A signed log records the export time and account identifier.",
        "آڈٹ ریکارڈ",
        "دستخط شدہ لاگ برآمد کا وقت اور اکاؤنٹ شناخت لکھتا ہے۔",
      ),
      item(
        "Routine report",
        "A small scheduled export matches the approved daily task.",
        "معمول کی رپورٹ",
        "چھوٹی شیڈول برآمد منظور شدہ روزانہ کام سے ملتی ہے۔",
      ),
    ],
    choices: [
      choice(
        "Preserve the audit record and notify the authorized team",
        "آڈٹ ریکارڈ محفوظ کرکے مجاز ٹیم کو اطلاع دیں",
      ),
      choice(
        "Review whether access matches the person's role",
        "دیکھیں رسائی ملازم کے کردار سے مطابقت رکھتی ہے یا نہیں",
      ),
      choice("Follow policy before limiting the account", "اکاؤنٹ محدود کرنے سے پہلے پالیسی اپنائیں"),
      choice("Publicly accuse the person and erase the log", "شخص پر عوامی الزام لگا کر لاگ مٹا دیں"),
    ],
    fixes: [0, 1, 0],
  },
  {
    id: 29,
    skillTag: "response",
    type: "timeline",
    mode: "ordered",
    title: pair("Multi-Stage Attack: Break the Chain", "کئی مرحلوں والا حملہ: سلسلہ روکیں"),
    scenario: pair(
      "Map a simulated sequence from initial contact to account misuse, then choose a safe interruption at each stage.",
      "ابتدائی رابطے سے اکاؤنٹ کے غلط استعمال تک فرضی ترتیب پہچانیں اور ہر مرحلے پر محفوظ روک منتخب کریں۔",
    ),
    tip: pair(
      "Report suspicious messages early, protect sign-in factors, contain unusual sessions and notify the service through trusted channels.",
      "مشکوک پیغام جلد رپورٹ کریں، سائن اِن حفاظت کریں، غیر معمولی سیشن روکیں اور معتبر ذریعے سے سروس کو بتائیں۔",
    ),
    context: pair(
      "Phishing aimed at mobile-wallet users and family email accounts.",
      "موبائل والٹ صارف اور خاندانی ای میل پر فشنگ کی کوشش۔",
    ),
    terms: ["attack-chain", "phishing", "containment"],
    items: [
      item(
        "Unexpected message",
        "A pretend delivery notice asks the user to check an account.",
        "غیر متوقع پیغام",
        "فرضی ترسیلی اطلاع صارف سے اکاؤنٹ دیکھنے کو کہتی ہے۔",
      ),
      item(
        "Look-alike sign-in page",
        "A mock page imitates a familiar service and asks for a password.",
        "مشابہ سائن اِن صفحہ",
        "فرضی صفحہ مانوس سروس کی نقل کرکے پاس ورڈ مانگتا ہے۔",
      ),
      item(
        "New session alert",
        "The simulated account reports a sign-in from an unknown device.",
        "نئے سیشن کی تنبیہ",
        "فرضی اکاؤنٹ نامعلوم آلے سے سائن اِن بتاتا ہے۔",
      ),
      item(
        "Transfer request",
        "An unexpected payment request appears after the account alert.",
        "رقم منتقلی کی درخواست",
        "اکاؤنٹ تنبیہ کے بعد غیر متوقع ادائیگی کی درخواست آتی ہے۔",
      ),
    ],
    choices: [
      choice(
        "Report the unexpected message without opening its link",
        "لنک کھولے بغیر غیر متوقع پیغام رپورٹ کریں",
      ),
      choice(
        "Use the official app and do not enter credentials on the imitation",
        "سرکاری ایپ استعمال کریں اور نقل میں اسناد نہ دیں",
      ),
      choice("Contain the session and secure the account", "سیشن روک کر اکاؤنٹ محفوظ کریں"),
      choice(
        "Approve the transfer before checking the account",
        "اکاؤنٹ دیکھنے سے پہلے رقم منتقلی منظور کریں",
      ),
    ],
    fixes: [0, 1, 2],
  },
  {
    id: 30,
    skillTag: "response",
    type: "alerts",
    mode: "ordered",
    boss: true,
    timedByDefault: true,
    timerSeconds: 240,
    title: pair("Final Lab: Security Operations Shift", "آخری لیب: سیکیورٹی آپریشنز کی شفٹ"),
    scenario: pair(
      "Triage three simulated alerts under a timer. Prioritize, contain, eradicate, recover and document in order.",
      "وقت کے اندر تین فرضی تنبیہات دیکھیں۔ ترجیح، روک تھام، صفائی، بحالی اور رپورٹ درست ترتیب سے کریں۔",
    ),
    tip: pair(
      "Prioritize evidence-based impact, contain first, preserve evidence, recover from trusted sources and document decisions.",
      "ثبوت پر مبنی اثر کو ترجیح دیں، پہلے روکیں، ثبوت محفوظ، معتبر ذریعے سے بحال اور فیصلے درج کریں۔",
    ),
    context: pair(
      "A simulated SOC protecting school services, family email and a mobile-wallet helpdesk.",
      "اسکول سروس، خاندانی ای میل اور موبائل والٹ ہیلپ ڈیسک کی فرضی SOC حفاظت۔",
    ),
    terms: ["triage", "containment", "eradication", "recovery", "incident-response"],
    items: [
      item(
        "Alert queue / three simulated signals",
        "Unknown account login, ransomware-like file activity and an unusual bulk export are reported.",
        "تنبیہات کی قطار / تین فرضی اشارے",
        "نامعلوم اکاؤنٹ لاگ اِن، رینسم ویئر جیسی فائل سرگرمی اور غیر معمولی بڑی برآمد رپورٹ ہوئی ہے۔",
      ),
      item(
        "Prioritize / identify immediate impact",
        "Shared office files are actively being renamed by a simulated ransomware process.",
        "ترجیح / فوری اثر پہچانیں",
        "فرضی رینسم ویئر مشترکہ دفتری فائلوں کے نام بدل رہا ہے۔",
      ),
      item(
        "Contain / limit further harm",
        "A shared workstation is affected; evidence should remain available for review.",
        "روک تھام / مزید نقصان محدود کریں",
        "مشترکہ کمپیوٹر متاثر ہے؛ جائزے کے لیے ثبوت محفوظ رہنا چاہیے۔",
      ),
      item(
        "Eradicate / remove the cause",
        "Remove the simulated malware and revoke affected account sessions.",
        "صفائی / وجہ ختم کریں",
        "فرضی مالویئر ہٹائیں اور متاثرہ اکاؤنٹ سیشن منسوخ کریں۔",
      ),
      item(
        "Recover / restore trusted service",
        "The device is checked and a known-good backup is available.",
        "بحالی / معتبر سروس واپس لائیں",
        "آلے کی جانچ ہو چکی ہے اور درست بیک اپ دستیاب ہے۔",
      ),
      item(
        "Report / document the shift",
        "The response timeline and actions must be recorded without copying secrets.",
        "رپورٹ / شفٹ درج کریں",
        "خفیہ معلومات نقل کیے بغیر ردعمل کا وقت اور اقدامات درج کریں۔",
      ),
    ],
    choices: [
      choice(
        "Triage all alerts and preserve the available evidence",
        "تمام تنبیہات دیکھیں اور دستیاب ثبوت محفوظ کریں",
      ),
      choice(
        "Prioritize the active ransomware affecting shared files",
        "مشترکہ فائلوں کو متاثر کرنے والے فعال رینسم ویئر کو ترجیح دیں",
      ),
      choice(
        "Isolate the affected workstation and contain account sessions",
        "متاثرہ کمپیوٹر الگ کریں اور اکاؤنٹ سیشن روکیں",
      ),
      choice(
        "Remove the cause, revoke access and rotate affected credentials",
        "وجہ ہٹائیں، رسائی منسوخ اور متاثرہ اسناد تبدیل کریں",
      ),
      choice("Recover only from a verified clean backup", "صرف تصدیق شدہ صاف بیک اپ سے بحال کریں"),
      choice("Write a factual incident report and follow-up", "حقائق پر مبنی واقعہ رپورٹ اور پیروی لکھیں"),
      choice("Ignore the alerts and delete the evidence", "تنبیہات نظرانداز کر کے ثبوت حذف کریں"),
    ],
    fixes: [0, 1, 2, 3, 4, 5],
  },
];

const glossaryPairs = {
  passkey: pair("Passkey", "پاس کی"),
  "sim-swap": pair("SIM swap", "سم سواپ"),
  "evil-twin": pair("Evil twin network", "جعلی وائی فائی نیٹ ورک"),
  https: pair("HTTPS", "HTTPS"),
  vpn: pair("Virtual private network", "ورچوئل پرائیویٹ نیٹ ورک"),
  "qr-payment": pair("QR payment scam", "کیو آر ادائیگی کا دھوکا"),
  ransomware: pair("Ransomware", "رینسم ویئر"),
  isolation: pair("Isolation", "الگ کرنا"),
  backup: pair("Backup", "بیک اپ"),
  "privacy-controls": pair("Privacy controls", "رازداری کے کنٹرول"),
  "recovery-method": pair("Recovery method", "بحالی کا طریقہ"),
  "authentication-log": pair("Authentication log", "تصدیقی لاگ"),
  "rate-limit": pair("Rate limit", "رفتار کی حد"),
  mfa: pair("Multi-factor authentication", "کئی مرحلوں کی تصدیق"),
  "file-permissions": pair("File permissions", "فائل کی اجازتیں"),
  "least-privilege": pair("Least privilege", "کم سے کم اختیار"),
  ownership: pair("File ownership", "فائل کی ملکیت"),
  spf: pair("SPF", "SPF"),
  dkim: pair("DKIM", "DKIM"),
  dmarc: pair("DMARC", "DMARC"),
  hashing: pair("Hashing", "ہیشنگ"),
  salting: pair("Salting", "سالٹنگ"),
  encryption: pair("Encryption", "انکرپشن"),
  "sql-injection": pair("SQL injection", "SQL انجیکشن"),
  "input-validation": pair("Input validation", "ان پٹ کی جانچ"),
  xss: pair("Cross-site scripting", "کراس سائٹ اسکرپٹنگ"),
  "output-encoding": pair("Output encoding", "آؤٹ پٹ انکوڈنگ"),
  csp: pair("Content security policy", "مواد سیکیورٹی پالیسی"),
  secret: pair("Secret", "خفیہ قدر"),
  "secret-scanning": pair("Secret scanning", "خفیہ معلومات کی جانچ"),
  gitignore: pair(".gitignore", ".gitignore"),
  "broken-access-control": pair("Broken access control", "رسائی کنٹرول کی خرابی"),
  authorization: pair("Authorization", "اجازت"),
  "cloud-bucket": pair("Cloud storage bucket", "کلاؤڈ ذخیرہ"),
  "iam-role": pair("Identity and access role", "شناخت اور رسائی کا کردار"),
  sandbox: pair("Sandbox", "سینڈ باکس"),
  malware: pair("Malware", "مالویئر"),
  "forensic-timeline": pair("Forensic timeline", "تفتیشی ٹائم لائن"),
  evidence: pair("Evidence", "ثبوت"),
  "insider-threat": pair("Insider threat", "اندرونی خطرہ"),
  "data-loss-prevention": pair("Data loss prevention", "ڈیٹا کے ضیاع کی روک تھام"),
  "attack-chain": pair("Attack chain", "حملے کا سلسلہ"),
  containment: pair("Containment", "روک تھام"),
  triage: pair("Alert triage", "تنبیہ کی ترجیح"),
  eradication: pair("Eradication", "خطرے کا خاتمہ"),
  recovery: pair("Recovery", "بحالی"),
  "3-2-1-backup": pair("3-2-1 backup rule", "3-2-1 بیک اپ اصول"),
};

const glossaryDefinitions = {
  en: {
    passkey: "A sign-in credential tied to a device or account that resists common password phishing.",
    "sim-swap": "An attempt to move a phone number to a different SIM without the owner's permission.",
    "evil-twin": "A fake Wi-Fi access point that imitates a trusted network name.",
    https: "A web connection protected with TLS; check the domain as well as the lock indicator.",
    vpn: "A protected tunnel to a trusted network service; it does not make every website trustworthy.",
    "qr-payment": "A payment trick that uses a QR code to send a victim to an unsafe action or page.",
    ransomware: "Malware that can block access to files and demand payment.",
    isolation: "Separating a suspected device or account to limit further impact.",
    backup: "A separate copy of information that can be used to recover it.",
    "privacy-controls": "Settings that limit who can see personal information.",
    "recovery-method": "A verified alternate way to regain access to an account.",
    "authentication-log": "A record of sign-in events and their outcomes.",
    "rate-limit": "A control that limits how often an action can be repeated.",
    mfa: "Sign-in protection that requires more than one type of proof.",
    "file-permissions": "Rules that define who can read, change or run a file.",
    "least-privilege": "Giving an account only the access needed for its task.",
    ownership: "The user or group that controls a file or resource.",
    spf: "An email-domain policy that lists permitted sending systems.",
    dkim: "A signature that helps verify an email was authorized by its sending domain.",
    dmarc: "A policy that uses SPF and DKIM alignment to guide email handling.",
    hashing: "A one-way transformation used to verify data without storing its original value.",
    salting: "Adding a unique random value before hashing to protect stored password hashes.",
    encryption: "Transforming data so it can be read only with the appropriate key.",
    "sql-injection": "A risk caused when untrusted input is treated as part of a database command.",
    "input-validation": "Checking that data matches expected types and limits before use.",
    xss: "A risk where untrusted web content is interpreted as active page content.",
    "output-encoding": "Converting characters so untrusted text displays as data, not markup.",
    csp: "A browser policy that restricts which sources may provide page content.",
    secret: "A private key, token or credential that must not be exposed.",
    "secret-scanning": "Automated checks that look for credentials accidentally added to code.",
    gitignore: "A project file that tells Git which local files not to include in new commits.",
    "broken-access-control": "A flaw where a user can access data or actions beyond their authorization.",
    authorization: "A check that decides what an identified user is allowed to access.",
    "cloud-bucket": "A cloud storage container whose access should be explicitly controlled.",
    "iam-role": "A cloud identity role that grants a defined set of permissions.",
    sandbox: "An isolated environment used to observe a file without using real systems.",
    malware: "Software designed to perform unwanted or harmful actions.",
    "forensic-timeline": "An ordered account of evidence and events during an investigation.",
    evidence: "Information preserved to help understand and review an incident.",
    "insider-threat": "A risk involving misuse of legitimate access by someone inside an organization.",
    "data-loss-prevention": "Controls that help prevent sensitive information leaving approved locations.",
    "attack-chain": "A sequence of actions an attacker may take to reach a goal.",
    containment: "Actions that limit an incident's further spread or impact.",
    triage: "Sorting alerts by urgency, evidence and potential impact.",
    eradication: "Removing the cause of an incident after it has been contained.",
    recovery: "Restoring normal service safely after an incident.",
    "3-2-1-backup": "Keep three copies on two storage types, with one copy off-site.",
  },
  ur: {
    passkey: "آلے یا اکاؤنٹ سے جڑی سائن اِن سند جو عام پاس ورڈ فشنگ سے بچاتی ہے۔",
    "sim-swap": "مالک کی اجازت کے بغیر فون نمبر کو دوسری سم پر منتقل کرنے کی کوشش۔",
    "evil-twin": "جعلی وائی فائی رسائی نقطہ جو معتبر نیٹ ورک کے نام کی نقل کرتا ہے۔",
    https: "TLS سے محفوظ ویب رابطہ؛ تالے کے نشان کے ساتھ ڈومین بھی دیکھیں۔",
    vpn: "معتبر نیٹ ورک سروس تک محفوظ سرنگ؛ یہ ہر ویب سائٹ کو معتبر نہیں بناتا۔",
    "qr-payment": "QR کوڈ کے ذریعے غیر محفوظ اقدام یا صفحے تک لے جانے کا ادائیگی دھوکا۔",
    ransomware: "ایسا مالویئر جو فائلوں تک رسائی روک کر رقم مانگ سکتا ہے۔",
    isolation: "مزید اثر کم کرنے کے لیے مشکوک آلے یا اکاؤنٹ کو الگ کرنا۔",
    backup: "معلومات کی الگ نقل جس سے انہیں واپس لایا جا سکے۔",
    "privacy-controls": "وہ ترتیبات جو ذاتی معلومات دیکھنے والوں کو محدود کرتی ہیں۔",
    "recovery-method": "اکاؤنٹ دوبارہ کھولنے کا تصدیق شدہ متبادل طریقہ۔",
    "authentication-log": "سائن اِن واقعات اور ان کے نتائج کا ریکارڈ۔",
    "rate-limit": "کسی عمل کی تکرار محدود کرنے والا کنٹرول۔",
    mfa: "سائن اِن حفاظت جس میں ایک سے زیادہ قسم کا ثبوت درکار ہو۔",
    "file-permissions": "فائل پڑھنے، بدلنے یا چلانے والوں کے اصول۔",
    "least-privilege": "اکاؤنٹ کو صرف اس کے کام کے لیے درکار رسائی دینا۔",
    ownership: "فائل یا ذریعے پر اختیار رکھنے والا صارف یا گروپ۔",
    spf: "ای میل ڈومین کی پالیسی جو مجاز بھیجنے والے نظام بتاتی ہے۔",
    dkim: "دستخط جو بھیجنے والے ڈومین کی اجازت کی جانچ میں مدد دیتا ہے۔",
    dmarc: "ای میل کے لیے SPF اور DKIM کی مطابقت پر مبنی پالیسی۔",
    hashing: "اصل قدر محفوظ کیے بغیر ڈیٹا کی جانچ کا یک طرفہ طریقہ۔",
    salting: "محفوظ پاس ورڈ ہیش سے پہلے منفرد بے ترتیب قدر شامل کرنا۔",
    encryption: "ڈیٹا کو اس طرح بدلنا کہ مناسب کلید کے بغیر نہ پڑھا جا سکے۔",
    "sql-injection": "غیر معتبر ان پٹ کو ڈیٹا بیس ہدایت سمجھنے سے پیدا ہونے والا خطرہ۔",
    "input-validation": "استعمال سے پہلے ڈیٹا کی قسم اور حدود کی جانچ۔",
    xss: "غیر معتبر ویب مواد کو فعال صفحہ مواد سمجھنے کا خطرہ۔",
    "output-encoding": "غیر معتبر متن کو اس طرح بدلنا کہ وہ مارک اپ نہیں بلکہ متن دکھے۔",
    csp: "براؤزر پالیسی جو صفحے کے مواد کے مجاز ذرائع محدود کرتی ہے۔",
    secret: "نجی کلید، ٹوکن یا سند جسے ظاہر نہیں کرنا چاہیے۔",
    "secret-scanning": "کوڈ میں غلطی سے شامل اسناد تلاش کرنے والی خودکار جانچ۔",
    gitignore: "پروجیکٹ فائل جو Git کو مقامی فائلیں نئی کمیٹ سے خارج کرنے کو کہتی ہے۔",
    "broken-access-control": "خرابی جس میں صارف اپنی اجازت سے باہر ڈیٹا یا عمل تک پہنچتا ہے۔",
    authorization: "یہ طے کرنے کی جانچ کہ شناخت شدہ صارف کس چیز تک رسائی لے سکتا ہے۔",
    "cloud-bucket": "کلاؤڈ ذخیرے کا حصہ جس کی رسائی واضح طور پر محدود ہونی چاہیے۔",
    "iam-role": "کلاؤڈ شناختی کردار جو مقررہ اجازتیں دیتا ہے۔",
    sandbox: "اصل نظام استعمال کیے بغیر فائل کا رویہ دیکھنے کا الگ ماحول۔",
    malware: "ناپسندیدہ یا نقصان دہ عمل کے لیے بنایا گیا سافٹ ویئر۔",
    "forensic-timeline": "تحقیق کے دوران ثبوت اور واقعات کی ترتیب وار تفصیل۔",
    evidence: "واقعہ سمجھنے اور دوبارہ جانچنے کے لیے محفوظ معلومات۔",
    "insider-threat": "ادارے کے اندر کسی شخص کی جائز رسائی کے غلط استعمال کا خطرہ۔",
    "data-loss-prevention": "حساس معلومات کو منظور شدہ جگہ سے باہر جانے سے روکنے کے کنٹرول۔",
    "attack-chain": "مقصد تک پہنچنے کے لیے حملہ آور کے ممکنہ اقدامات کی ترتیب۔",
    containment: "واقعے کے مزید پھیلاؤ یا اثر کو محدود کرنے کے اقدامات۔",
    triage: "فوری ضرورت، ثبوت اور ممکنہ اثر کے مطابق تنبیہات کی ترتیب۔",
    eradication: "روک تھام کے بعد واقعے کی وجہ کو ختم کرنا۔",
    recovery: "واقعے کے بعد سروس کو محفوظ طریقے سے معمول پر لانا۔",
    "3-2-1-backup": "تین نقول، دو قسم کے ذخیرے اور ایک نقل بیرونی جگہ پر رکھیں۔",
  },
};

function makeChoices(definition, language) {
  return Object.fromEntries(definition.choices.map((label, index) => [`c${index}`, label[language]]));
}

function makeLevel(definition) {
  const choiceIds = definition.choices.map((_, index) => `c${index}`);
  const issueCount = definition.fixes.length;
  const issues = definition.fixes.map((choiceIndex, issueIndex) => {
    const wrongFixes = choiceIds.filter((_, index) => index !== choiceIndex).slice(0, 2);
    return {
      item: issueIndex,
      fix: choiceIds[choiceIndex],
      wrongFixes,
      terms: definition.terms,
      difficulty:
        definition.issueDifficulties?.[issueIndex] ?? Math.min(5, 1 + ((definition.id + issueIndex) % 4)),
    };
  });
  return {
    id: definition.id,
    chapter: Math.ceil(definition.id / 5),
    title: definition.title,
    difficulty: definition.boss ? "expert" : definition.id % 2 ? "learner" : "defender",
    skillTag: definition.skillTag,
    type: definition.type,
    ...(definition.mode ? { mode: definition.mode } : {}),
    ...(definition.boss ? { boss: true } : {}),
    ...(definition.timedByDefault ? { timedByDefault: true } : {}),
    ...(definition.timerSeconds ? { timerSeconds: definition.timerSeconds } : {}),
    items: definition.items.map((_, index) => index),
    choices: choiceIds,
    issues,
    hints: [{ issue: 0 }, { issue: Math.min(1, issueCount - 1) }],
    glossaryTerms: definition.terms,
    learningCard: true,
  };
}

function makeCopy(definition, language) {
  const labels = definition.items.map((entry) => ({
    title: entry.title[language],
    detail: entry.detail[language],
  }));
  const choices = makeChoices(definition, language);
  const hints = [
    language === "en"
      ? `Compare the first item with the objective: ${labels[0].title}.`
      : `پہلی چیز کو مقصد سے ملائیں: ${labels[0].title}۔`,
    language === "en"
      ? `Review the next record: ${labels[1].title}.`
      : `اگلا ریکارڈ دیکھیں: ${labels[1].title}۔`,
  ];
  const issues = definition.fixes.map((_, index) => {
    const title = labels[index].title;
    const fix = choices[`c${definition.fixes[index]}`];
    return {
      title,
      detail: labels[index].detail,
      why:
        language === "en"
          ? `${fix} directly addresses the evidence shown for ${title}.`
          : `${fix}، ${title} کے دکھائے مسئلے کا براہ راست محفوظ حل ہے۔`,
      mistake:
        language === "en"
          ? `This does not resolve ${title}; verify the evidence before choosing another action.`
          : `اس سے ${title} کا مسئلہ حل نہیں ہوتا؛ دوسرا اقدام چننے سے پہلے ثبوت دیکھیں۔`,
      tip: definition.tip[language],
      hint: hints[Math.min(index, 1)],
      wrongExplanations:
        definition.fixes[index] === 0
          ? [
              language === "en"
                ? "This option does not address the main evidence."
                : "یہ انتخاب بنیادی ثبوت کا حل نہیں ہے۔",
              language === "en"
                ? "It leaves the indicated risk unresolved."
                : "اس سے دکھایا گیا خطرہ برقرار رہتا ہے۔",
            ]
          : [
              language === "en"
                ? "This option does not address the main evidence."
                : "یہ انتخاب بنیادی ثبوت کا حل نہیں ہے۔",
              language === "en"
                ? "It leaves the indicated risk unresolved."
                : "اس سے دکھایا گیا خطرہ برقرار رہتا ہے۔",
            ],
    };
  });
  return {
    title: definition.title[language],
    scenario: definition.scenario[language],
    choices,
    items: labels,
    issues,
    hints,
    learning: {
      whatHappened: definition.scenario[language],
      attacker:
        language === "en"
          ? "An attacker may exploit the unsafe behavior or weak control represented in this simulation."
          : "حملہ آور اس فرضی منظرنامے میں دکھائے غیر محفوظ رویے یا کمزور کنٹرول سے فائدہ اٹھا سکتا ہے۔",
      defend:
        language === "en"
          ? "Apply the recommended control, verify unusual requests independently and preserve recovery options."
          : "تجویز کردہ کنٹرول اپنائیں، غیر معمولی درخواست کی الگ تصدیق کریں اور بحالی کا طریقہ محفوظ رکھیں۔",
      pakistan: definition.context[language],
    },
  };
}

for (const definition of definitions) {
  const level = makeLevel(definition);
  await writeFile(
    new URL(`../levels/level${String(definition.id).padStart(2, "0")}.json`, import.meta.url),
    `${JSON.stringify(level, null, 2)}\n`,
  );
}

const catalog = [];
for (let id = 1; id <= 10; id += 1) {
  const levelUrl = new URL(`../levels/level${String(id).padStart(2, "0")}.json`, import.meta.url);
  const level = JSON.parse(await readFile(levelUrl, "utf8"));
  catalog.push({
    id: level.id,
    chapter: level.chapter,
    title: level.title,
    difficulty: level.difficulty,
    skillTag: level.skillTag,
    type: level.type,
    boss: level.boss ?? id % 5 === 0,
    mode: level.mode,
  });
}
for (const definition of definitions) {
  const level = makeLevel(definition);
  catalog.push({
    id: level.id,
    chapter: level.chapter,
    title: level.title,
    difficulty: level.difficulty,
    skillTag: level.skillTag,
    type: level.type,
    boss: level.boss ?? level.id % 5 === 0,
    mode: level.mode,
  });
}
await writeFile(new URL("../level-catalog.json", import.meta.url), `${JSON.stringify(catalog, null, 2)}\n`);

for (const language of ["en", "ur"]) {
  const localeUrl = new URL(`../lang/${language}.json`, import.meta.url);
  const locale = JSON.parse(await readFile(localeUrl, "utf8"));
  for (const definition of definitions) locale.levels[definition.id - 1] = makeCopy(definition, language);
  for (const [id, title] of Object.entries(glossaryPairs)) {
    locale.glossary[id] = {
      title: title[language],
      definition: glossaryDefinitions[language][id],
    };
  }
  await writeFile(localeUrl, `${JSON.stringify(locale, null, 2)}\n`);
}
