/** Frequently asked questions shown on /faq (and a selection on the home page). Answers may contain internal links as [text](/path). */
export interface FaqItem {
  id: string;
  q: string;
  a: string;
  home?: boolean;
}
export interface FaqSection {
  id: string;
  title: string;
  items: FaqItem[];
}

export const FAQ_SECTIONS: FaqSection[] = [
  {
    id: "about-soar-hub",
    title: "About SOAR Hub",
    items: [
      { id: "what-is-soar-hub", q: "What is SOAR Hub?", a: "SOAR (Scholarship · Opportunity · Access · Resources) Hub helps young Africans, starting with Nigeria, find fully funded scholarships, check their eligibility, and prepare complete, strong applications on time." },
      { id: "is-it-free", q: "Is SOAR Hub free?", a: "The home page, About, Contact and these FAQs are free for everyone, and creating an account is free. Everything else (the full scholarship directory, eligibility checks, the application planner, documents, essays and feedback, referee requests, the learning library and the application guide) is for members. See [Membership](/membership) for the current price.", home: true },
      { id: "how-to-pay", q: "How do I pay for membership?", a: "Create an account and verify your email, then open [Membership](/membership) and click **Pay and join**. You pay securely through Flutterwave by card, bank transfer or USSD, and your membership starts as soon as the payment is confirmed. Your receipts are listed on the Membership page." },
      { id: "guarantee", q: "Does SOAR Hub guarantee a scholarship?", a: "No. Universities make all admission and award decisions. SOAR Hub helps you understand the requirements, prepare strong materials and submit a complete application on time.", home: true },
      { id: "apply-through", q: "Do I submit my application through SOAR Hub?", a: "No. You always submit your final application on the official university or scholarship portal. SOAR Hub helps you get ready and keeps you organised. Each scholarship page links to its official page.", home: true },
      { id: "info-source", q: "Where does the scholarship information come from?", a: "From official partner university and Mastercard Foundation pages. Each opportunity shows its official source link and the date it was last verified. Details change between rounds, so always confirm on the official page before you apply.", home: true },
    ],
  },
  {
    id: "scholars-program",
    title: "The Mastercard Foundation Scholars Program",
    items: [
      { id: "what-is-mcf", q: "What is the Mastercard Foundation Scholars Program?", a: "A program of the Mastercard Foundation, an independent foundation separate from the Mastercard company, that funds talented, service-oriented young Africans facing barriers to education, at secondary, undergraduate and master's level. It has supported more than 58,000 Scholars, 71% of them women." },
      { id: "apply-to-foundation", q: "Do I apply to the Mastercard Foundation directly?", a: "No. You apply to a partner university or institution. Each partner runs its own scholarship program and sets its own courses, eligibility, age limits, documents, deadlines, benefits and selection process. See [how the program works](/guide#how-it-works)." },
      { id: "what-covered", q: "What does a fully funded scholarship cover?", a: "Usually much more than tuition: books and materials, a laptop, accommodation, a living stipend, meals, health insurance, travel and visa support where it applies, plus mentorship, leadership development and career support. The exact package depends on the university and programme, so read the official information." },
      { id: "admission-vs-scholarship", q: "If I'm admitted to the university, do I automatically get the scholarship?", a: "No. Admission does not guarantee a scholarship. Many partners assess admission and the scholarship separately, which is why there are two sets of documents." },
      { id: "fees", q: "Do I have to pay to apply?", a: "The Mastercard Foundation never asks you for money. Some partners charge an application fee; if they do, it is refunded if you are selected. Never pay an agent for a scholarship form." },
    ],
  },
  {
    id: "eligibility",
    title: "Eligibility",
    items: [
      { id: "age-limit", q: "Is there an age limit?", a: "The Foundation's general guidance is 29 or under when you apply for an undergraduate degree, and 35 or under for a master's. Partners can be stricter or different (for example, ASU's 2026 graduate certificate call asked for ages 18–33), and some allow more for refugees or people with disabilities. Always check the exact call.", home: true },
      { id: "who-eligible", q: "Who is eligible?", a: "Generally, young Africans with strong academic potential, a commitment to giving back to their community, and financial need. Many partners give priority to young women, refugees and displaced young people, and people with disabilities. Each partner's call lists its exact criteria, and every scholarship page on SOAR Hub shows its key eligibility." },
      { id: "interrupted-education", q: "My education was delayed or interrupted. Can I still apply?", a: "Yes. A delayed, paused or interrupted journey does not disqualify you on its own. Check the age limit and academic requirements of the specific call, then explain your story honestly in your essay." },
      { id: "check-eligibility", q: "How do I check my eligibility on SOAR Hub?", a: "Create an account and become a member, complete your profile, then open any scholarship and choose **Check my eligibility**. SOAR Hub compares your profile with the scholarship's criteria and tells you which ones you meet, which you don't, and what information is missing." },
    ],
  },
  {
    id: "documents",
    title: "Documents",
    items: [
      { id: "which-documents", q: "Which documents do I need for an undergraduate application?", a: "For ALU, ALCHE and similar partners, the admission application usually needs Grade 10–12 results, a WAEC result notarised by a lawyer, NIN, birth certificate, international passport, an equivalence certificate (for Rwanda), a police character certificate and two recommendation letters of at least 250 words. The scholarship application usually needs your sponsor's bank statement, high school fees receipts, your sponsor's job declaration, recommendation letters, a 500-word essay and a 5-minute video. Each scholarship page lists its own documents." },
      { id: "masters-documents", q: "What extra documents do master's applications need?", a: "Typically a leadership essay, a statement of purpose (SOP), a CV and your first-degree transcript, plus anything the specific university asks for. See the [SOP sample](/resources/statement-of-purpose-sample-explained) and [CV template](/resources/alu-cv-template-explained)." },
      { id: "english-test", q: "Do I need IELTS, Duolingo or SAT?", a: "It depends on the school. Many African partners teaching in English accept WAEC English; some universities outside Africa ask for a test or offer a waiver. Check the official page of each school." },
      { id: "when-start-documents", q: "When should I start gathering documents?", a: "Now, before the call opens. Notarised results, a police character certificate, a passport and sponsor documents can take weeks. Create a scholarship folder with seven sub-folders: academic documents, identification, financial documents, recommendations, essays and statements, videos, and applications and emails." },
      { id: "upload-video", q: "How do I store my video on SOAR Hub?", a: "Video files can't be uploaded directly. Upload your video to a private link (for example Google Drive or unlisted YouTube), then upload a PDF or Word file containing that link to the video slot in your application checklist." },
    ],
  },
  {
    id: "essays-video-referees",
    title: "Essays, video and recommendation letters",
    items: [
      { id: "essay-structure", q: "How should I structure my scholarship essay?", a: "Four parts: (1) a hook and your background, a real moment, then the barrier that shaped you; (2) what you did despite it, with evidence; (3) your vision and why this scholarship; (4) a conclusion that returns to your opening. For a 500-word essay, aim for about 60–100, 90–150, 105–175 and 45–75 words. See [the essay section of the guide](/guide#essay)." },
      { id: "no-ngo", q: "I haven't founded an organisation. Do I have enough impact?", a: "Yes. Impact is not always loud, but it should be real: teaching someone, helping your family, organising a school activity, volunteering or building a small project all count. Replace claims with evidence: “For a year, I taught six children on my street to read every Saturday. Four now read on their own.”" },
      { id: "ai-essay", q: "Can AI write my essay?", a: "No. Your essay and video must use your own voice, words and experiences. On SOAR Hub, AI can only suggest questions and improvements to your own draft, and a human reviewer checks every AI suggestion before you see it.", home: true },
      { id: "video-tips", q: "How do I prepare a good video?", a: "Read the prompt and follow the exact time limit. Record in a quiet room facing a window, with a simple background, and look at the camera. Speak naturally, and don't just read your essay." },
      { id: "referees", q: "Who should write my recommendation letters, and when should I ask?", a: "Teachers, principals, mentors or supervisors who know your work well. Ask at least four weeks before the deadline and give them your CV, the deadline, the word count and three things you'd like them to mention. See the [recommendation letter sample](/resources/recommendation-letter-sample-explained)." },
    ],
  },
  {
    id: "using-soar-hub",
    title: "Using SOAR Hub",
    items: [
      { id: "get-started", q: "How do I get started?", a: "[Create an account](/register), verify your email, become a [member](/membership), complete your profile (about ten minutes), browse the [scholarships](/scholarships), check your eligibility and save the ones that fit. SOAR Hub then builds a plan backward from each deadline." },
      { id: "reminders", q: "Will SOAR Hub remind me about deadlines?", a: "Yes. When you start an application, SOAR Hub schedules milestones backward from the deadline and sends reminders by email and in the app, so nothing slips." },
      { id: "referee-links", q: "How do my referees send their letters?", a: "Add them on the Referees page. Each referee receives a secure, time-limited upload link (no account needed), and you can see whether their letter has arrived." },
      { id: "privacy", q: "How is my personal information protected?", a: "Your data is stored securely, documents are private, and sensitive questions are optional unless a scholarship requires them. We follow Nigeria's data protection rules, and you can export or delete your data at any time. See the [privacy policy](/privacy).", home: true },
      { id: "contact", q: "I still have a question. How do I reach you?", a: "Use the [contact form](/contact), and we'll reply by email." },
    ],
  },
];

export const HOME_FAQ = FAQ_SECTIONS.flatMap((s) => s.items).filter((i) => i.home);
