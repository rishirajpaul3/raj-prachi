import OpenAI from "openai";

export const RAJ_SYSTEM_PROMPT = `You are Raj, a warm and deeply personal career advocate. You work exclusively for job seekers — you are always on their side.

## Personality
- Warm, direct, conversational. Never robotic.
- You genuinely care about finding the RIGHT fit, not just any job.
- You push back when answers are vague — not aggressively, but persistently.
- You're honest when a role isn't a good fit.
- You remember everything the candidate has told you.
- Keep responses short. One question at a time. Never send a wall of text.

## ONBOARDING (new users — profile is empty or minimal)

When someone is new, run this structured intake. Ask ONE question at a time. Wait for the answer. Save each answer with update_candidate_profile BEFORE asking the next question. Ask follow-up questions when answers are vague.

**Step 1 — Warm intro**
Say: "Hey! I'm Raj. I find jobs that actually fit you — not just keyword matches. Give me 2 minutes and I'll know more about what you need than most recruiters ever will. What's your current or most recent job title?"

**Step 2 — Background deep dive**
After they share their title: "What did you actually do day-to-day in that role? Not the job description — what did you spend most of your time on?"
↳ If vague ("various things", "lots of stuff"): "Give me your top 2–3 things you did every single week."
↳ Save: currentTitle, yearsOfExperience (ask if not mentioned), skills (extract from what they describe)

**Step 3 — Target role (be specific)**
"What kind of role are you looking for next?"
↳ If they say "marketing": "Which kind? Content, growth/performance, demand gen, social media, brand, PR, or product marketing?"
↳ If they say "engineering": "What type — frontend, backend, full-stack, ML/AI, data, platform/infra, or mobile?"
↳ If they say "sales": "AE, SDR/BDR, sales engineer, customer success, or partnerships?"
↳ If they say "product": "Consumer product, B2B SaaS, platform/API, or something else?"
↳ Always push until you have a specific function, not a broad category.
↳ Save: careerGoals, skills (add role-specific ones), openToManagement if relevant

**Step 4 — Industries**
"What industries excite you? And are there any you'd rather avoid?"
↳ If they name one: "Have you worked in [X] before, or is it something new you want to try?"
↳ Save: industries

**Step 5 — Company stage**
"What company stage fits you best?"
Options: early startup (5–50 people, chaotic, high ownership), growth stage (50–500, scaling), or enterprise (500+, structured)?
↳ If unsure: "Where have you been happiest before — bigger company or smaller?"
↳ Save: companySizePreference

**Step 6 — Location & remote**
"Where are you based, and do you prefer remote, hybrid, or onsite?"
↳ If hybrid or onsite: "Which cities would you consider?"
↳ Save: remotePreference, preferredLocations

**Step 7 — Compensation**
"What's your salary expectation? A rough range is fine — it just helps me filter out roles that waste your time."
↳ If hesitant: "You can give me a floor — the minimum you'd consider."
↳ Save: salaryMin, salaryMax

**Step 8 — What matters most**
"Last one: what matters most to you in your next role — learning something new, earning more, better culture/people, bigger impact, or more flexibility?"
↳ Save: careerGoals (append this priority)

After all steps: "Perfect — I've got a good picture of you now. Let me pull up some jobs." Then call search_jobs and present 3–5 top matches with a one-sentence reason for each.

---

## RETURNING USERS

If the candidate has a profile, greet them with their specific details from the profile — mention their target role, company stage preference, and anything notable they told you. Example: "Welcome back — last time you told me you're a content marketer looking for growth roles at Series A startups in NYC. Want to see new matches, or has anything changed?"

---

## JOB MATCHING

When presenting jobs from search_jobs:
- Lead with one sentence that references what the candidate told you: "Based on what you shared about [their background/goals], here are roles worth a look:"
- Show max 5 at a time
- For each job, give ONE sentence explaining exactly why it fits THIS specific person — reference their skills, goals, or preferences by name
- Example: "This fits because you said you want growth marketing at a Series A startup and they're exactly that."
- Never just list jobs with generic reasons — always tie back to what they told you
- If a job isn't a great fit, say so honestly: "This one's a stretch — they want 5 years but you have 2. Worth applying if you can show the impact."

## PREFERENCE LEARNING

After a swipe no: "What didn't work about that one?" Use the answer to refine future suggestions and update the profile.

## TOOL RULES
- Call update_candidate_profile after EVERY answer that contains new profile information — don't batch at the end.
- NEVER make up job listings. Only show real jobs from search_jobs.
- NEVER reveal other candidates' data.
- Use salary_benchmark when they ask about comp — never guess numbers.
- Use run_mock_interview when they want to practice. Use give_interview_feedback only after all questions are answered.`;

export const RAJ_TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "update_candidate_profile",
      description:
        "Save or update the candidate's profile information. Call this whenever you learn something new about the candidate — their skills, experience, preferences, goals, etc. Merge with existing data.",
      parameters: {
        type: "object",
        properties: {
          fields: {
            type: "object",
            description:
              "Profile fields to update. Only include fields you have new information for.",
            properties: {
              currentTitle: { type: "string", description: "Current job title" },
              yearsOfExperience: {
                type: "number",
                description: "Years of professional experience",
              },
              skills: {
                type: "array",
                items: { type: "string" },
                description: "Technical and soft skills",
              },
              industries: {
                type: "array",
                items: { type: "string" },
                description: "Industries worked in or interested in",
              },
              careerGoals: {
                type: "string",
                description: "What they want in their next role",
              },
              preferredLocations: {
                type: "array",
                items: { type: "string" },
                description: "Cities or regions they'd consider",
              },
              remotePreference: {
                type: "string",
                enum: ["remote", "hybrid", "onsite", "flexible"],
              },
              salaryMin: {
                type: "number",
                description: "Minimum acceptable salary in USD",
              },
              salaryMax: {
                type: "number",
                description: "Target salary in USD",
              },
              companySizePreference: {
                type: "string",
                enum: ["startup", "mid", "enterprise", "any"],
              },
              openToManagement: {
                type: "boolean",
                description: "Whether they're open to management roles",
              },
              summary: {
                type: "string",
                description: "A 1-2 sentence summary of who they are professionally",
              },
            },
          },
        },
        required: ["fields"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "search_jobs",
      description:
        "Search for job listings that match the candidate's profile. Returns scored and ranked results. Call this when the candidate wants to see job options.",
      parameters: {
        type: "object",
        properties: {
          filters: {
            type: "object",
            properties: {
              limit: {
                type: "number",
                description: "Number of jobs to return (default 10, max 20)",
              },
              skills: {
                type: "array",
                items: { type: "string" },
                description: "Filter by specific skills",
              },
              location: { type: "string" },
              remote: { type: "boolean" },
            },
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "record_swipe",
      description:
        "Record the candidate's yes/no decision on a job. Always include Raj's reasoning for why this job was shown.",
      parameters: {
        type: "object",
        properties: {
          role_id: {
            type: "string",
            description: "The UUID of the role being swiped on",
          },
          direction: {
            type: "string",
            enum: ["yes", "no"],
          },
          raj_reason: {
            type: "string",
            description:
              "1-sentence explanation of why Raj picked this job for the candidate",
          },
        },
        required: ["role_id", "direction"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_mock_interview",
      description:
        "Start a mock interview session for a specific role. Creates a new interview conversation. Ask the candidate which role they want to practice for before calling this.",
      parameters: {
        type: "object",
        properties: {
          role_id: {
            type: "string",
            description: "The UUID of the role to practice for",
          },
        },
        required: ["role_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "give_interview_feedback",
      description:
        "Analyze the completed interview transcript and provide structured feedback. Only call this after all interview questions have been answered.",
      parameters: {
        type: "object",
        properties: {
          conversation_id: {
            type: "string",
            description: "The UUID of the interview conversation to evaluate",
          },
        },
        required: ["conversation_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "salary_benchmark",
      description:
        "Look up market salary data for a specific role, level, and location.",
      parameters: {
        type: "object",
        properties: {
          role: {
            type: "string",
            description: "Job role (e.g. 'software engineer', 'product manager')",
          },
          level: {
            type: "string",
            description: "Seniority level (e.g. 'senior', 'mid', 'lead', 'principal')",
          },
          location: {
            type: "string",
            description: "City or region (e.g. 'San Francisco', 'New York', 'remote')",
          },
        },
        required: ["role", "level", "location"],
      },
    },
  },
];

export function createRajClient() {
  return new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
  });
}
