/**
 * SOAR Hub's own learning resources: sample documents with a written explanation of each.
 * Loaded with `npm run db:import-resources` (idempotent, keyed by slug).
 * Files live in /public/downloads; previews in /public/downloads/previews.
 */
export interface SeedResource {
  slug: string;
  title: string;
  type: "guide" | "essay_guide" | "cv_guide" | "download";
  category: "application-guides" | "essay-writing" | "cv-documents" | "reference-letters";
  description: string;
  file: { url: string; preview: string; label: string; format: "PDF" | "PNG image"; pages?: number };
  tags: string[];
  body: string;
}

export const LEARNING_RESOURCES: SeedResource[] = [
  {
    slug: "statement-of-purpose-sample-explained",
    title: "Statement of purpose (SOP): a sample, explained",
    type: "essay_guide",
    category: "essay-writing",
    description: "Download a real scholarship SOP sample, see what works and what to avoid, and learn a structure for writing your own.",
    file: { url: "/downloads/statement-of-purpose-sample.pdf", preview: "/downloads/previews/statement-of-purpose-sample.png", label: "Scholarship SOP sample", format: "PDF", pages: 3 },
    tags: ["SOP", "master's", "essays", "samples"],
    body: `## What is a statement of purpose?

A statement of purpose (SOP) is a personal essay that explains **who you are, what you have done, what you want to study, and why this programme and this scholarship are the logical next step**. Master's programmes almost always ask for one. Many undergraduate scholarships ask for something similar under another name: a personal statement, a motivation letter or a scholarship essay.

Readers use it to answer one question: *is this person a good investment?* A scholarship is an investment, not a reward for hardship.

## How to use the sample

1. Download the sample and read it once from start to finish.
2. Read it again with the notes below beside you.
3. Do **not** copy any sentence. Selection panels read thousands of essays and recognise text taken from the internet. Use the sample only to understand structure and tone.

## What the sample does well

- **It is personal.** It describes a real moment (an accident, the family giving up the bed, siblings sleeping on the floor). A specific memory is far stronger than a general statement.
- **It names leadership roles.** Vice chairperson, class representative, club leader, social media manager.
- **It shows service.** Street plays for public awareness and volunteering in meal distribution during COVID.
- **It mentions academic results.** A first-class undergraduate degree.

## What to avoid (and how to fix it)

- **A generic opening.** "I firmly believe that desire itself constitutes the basis for all accomplishment" could open anyone's essay. *Fix:* open with your own moment, then the barrier that shaped you.
- **Framing money as everything.** "Without it, nothing in this world really has any meaning" makes the scholarship sound like a rescue rather than an investment. *Fix:* be honest about financial need in one or two sentences, then move to what you did despite it.
- **Pleading.** "I truly request that you consider my grant application" asks for sympathy. *Fix:* close with confidence: what you will do with the opportunity and who will benefit.
- **Listing titles without results.** "Leader of the clubs" tells the reader nothing. *Fix:* add evidence: "As club president I grew membership from 12 to 40 and organised three community health talks."
- **Unnatural phrasing.** Phrases like "fundamental contemplations in my sub-conscience" and "the adoration and support" read like a paraphrasing tool. *Fix:* write in plain words, the way you would explain it to a teacher you respect. Read it aloud.
- **No clear goal.** The sample never names the course, the university, the problem the writer wants to solve or how the degree helps. *Fix:* give one paragraph to your vision: the course, the place, the problem and who benefits.

## A structure you can follow

1. **Hook and background**: a real moment, then the barrier that shaped you.
2. **What you did despite it**: action and evidence: work, projects, leadership, service, results.
3. **Academic and professional preparation**: grades and improvement, research or final-year project, work experience, certifications (very important for a master's).
4. **Your vision and why this programme**: the course, the university, the problem you want to solve and for whom.
5. **Conclusion**: return to your opening and show why you are worth investing in.

## Before you submit

- [ ] It answers the exact prompt and stays within the word limit.
- [ ] Every claim has evidence (a number, a result or an example).
- [ ] It names the programme and explains why it is the logical next step.
- [ ] It sounds like you. AI can check grammar, but it must never invent your story.
- [ ] A teacher, mentor or SOAR Hub reviewer has read it.

Draft yours in the **Essays** workspace in your SOAR Hub portal, and see the [complete application guide](/guide#essay) for word budgets per section.`,
  },
  {
    slug: "alu-cv-template-explained",
    title: "CV template (ALU format), explained section by section",
    type: "cv_guide",
    category: "cv-documents",
    description: "A one-page CV template with a filled-in example. Learn what goes in each section and how to write strong bullet points, even with little work experience.",
    file: { url: "/downloads/alu-cv-template.pdf", preview: "/downloads/previews/alu-cv-template.png", label: "ALU CV template with example", format: "PDF", pages: 2 },
    tags: ["CV", "master's", "templates"],
    body: `## What is in the download?

The PDF has **two pages**:

- **Page 1:** a completed example CV for a fictional ALU student, so you can see the finished result.
- **Page 2:** the blank template with placeholders (Full name, Role or title, Month, Year and so on). Recreate it in Google Docs or Word, or open the PDF and type over the structure in your own document.

A CV is required for master's applications and is useful for almost every undergraduate scholarship too.

## Section by section

### 1. Header
Full name, nationality, city and country, phone number with country code, a professional email address and your LinkedIn link. Use an email made from your name (for example *firstname.lastname@gmail.com*), not a nickname.

### 2. Summary
Two or three lines: who you are, your strongest experience and what you are pursuing. *Example from the template:* "Motivated self-starter with experience in customer relations and marketing… Currently pursuing an honours degree in Global Challenges."

### 3. Educational background
School or university, city and country, start and end dates, the qualification and relevant coursework or subjects. **School leavers:** list your secondary school, your WAEC/WASSCE year and your strongest subjects.

### 4. Professional work experience
Role, organisation, place and dates, then two or three bullet points. Each bullet should follow this pattern:

> **Action verb + what you did + result (with a number)**
>
> "Coordinated with a team of 15 to organise a forum that brought together about 300 African women."

### 5. Extracurricular activities
Clubs, volunteering, community projects, competitions. Give your role and one line on what you achieved.

### 6. Skills, interests and languages
Be specific (for example "Python: intermediate", "Microsoft Excel", "Graphic design with Canva"). List languages with your level: native, fluent, conversational, beginner.

## No work experience? You still have a CV

Count what you have really done:

- helping in the family shop or business
- teaching younger children or tutoring classmates
- school prefect, class captain or club roles
- church, mosque or community volunteering
- a project you built, a competition you entered, a skill you learned online

## Rules that make a CV look professional

- One page for school leavers; up to two pages for master's applicants.
- Most recent experience first, with dates aligned on the right.
- One font, consistent date format, no spelling mistakes.
- No photo, date of birth or marital status unless the application asks for them.
- Save and upload as **PDF**, named like *Firstname-Lastname-CV.pdf*.
- **Master's applicants:** add your undergraduate result, final-year project or research, any publications, professional experience and certifications.

Upload your finished CV to the **Documents** workspace so it is ready for every application.`,
  },
  {
    slug: "recommendation-letter-sample-explained",
    title: "Recommendation letter: a sample, and how to guide your referees",
    type: "download",
    category: "reference-letters",
    description: "See the parts of a scholarship recommendation letter, what makes one strong, and how to brief the teacher or mentor who writes yours.",
    file: { url: "/downloads/recommendation-letter-sample.png", preview: "/downloads/previews/recommendation-letter-sample.png", label: "Sample scholarship recommendation letter", format: "PNG image" },
    tags: ["recommendation letters", "referees", "samples"],
    body: `## What is a recommendation letter?

A letter written by someone who knows you well (a teacher, principal, mentor, supervisor or community leader) that tells the selection panel **what you are like and what you have achieved**, from their point of view. Most Mastercard Foundation partner applications ask for **two** letters. ALU and ALCHE ask for letters of **at least 250 words** each.

> You do not write your own letter. You choose the right referee and give them what they need to write a strong, specific one.

## The parts of the letter (from the sample)

1. **Recipient and date.** Name, title and institution of the person it is addressed to, and the date.
2. **Subject line.** For example, "Scholarship application letter of recommendation".
3. **Who the referee is and how they know you.** "Being the senior teacher at St. Andrews Universal School…"
4. **Specific evidence.** "…has won 4 interschool Physics project displays and repeatedly scores top marks in the subject." This is the strongest part of the sample.
5. **Why you deserve the scholarship.** Character, potential and fit with the programme.
6. **Closing and contact.** An offer to answer questions, then the referee's name, title, phone number and email.

## How a stronger letter would differ

The sample is a useful outline, but a strong letter for a Mastercard Foundation partner would:

- be **at least 250 words** (the sample's body is shorter);
- give **two or three specific stories** about the student, not only grades;
- mention **leadership, service and character**, not only academic ability;
- compare the student to others ("one of the top three students I have taught in 12 years");
- **include the referee's real contact details** (the sample mentions a phone number but does not give one);
- be **proofread** ("make your proud" should be "make you proud"), printed on school or organisation letterhead where possible, signed and dated.

## How to ask your referees

1. Ask **at least four weeks** before the deadline, in person or by a polite message.
2. Choose people who know your work well. A well-known title matters less than real knowledge of you.
3. Send them a short brief:
   - the scholarship and university, and the deadline;
   - your CV;
   - three things you would like them to mention, with examples;
   - the word count (for example, at least 250 words) and how to submit.
4. Send a polite reminder one week before the deadline, and thank them afterwards.

On SOAR Hub, add referees on the **Referees** page. Each referee gets a secure, time-limited upload link (no account needed), and you can track whether their letter has arrived.`,
  },
];
