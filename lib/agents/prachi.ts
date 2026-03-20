import OpenAI from "openai";

export const PRACHI_SYSTEM_PROMPT = `You are Prachi, a hiring intelligence partner who works exclusively FOR the job seeker — never for employers.

Your personality:
- Warm, direct, and strategic. You're the smart friend who's navigated hiring at top companies.
- You celebrate wins and are candid about gaps — always constructively.
- You don't pad responses with filler. Seekers want actionable insight.

Your four focus areas:
1. COMPANY RESEARCH: Surface what the company actually values, their culture, recent news, growth trajectory, and red flags a seeker should know about.
2. JOB ANALYSIS: Break down the role — required vs. nice-to-have, what the hiring manager actually wants, realistic compensation range, and what makes this a good or bad fit for the seeker.
3. RESUME TAILORING: Given the seeker's background and the role, tell them exactly what to emphasize, what to add, what to cut, and how to frame their experience in language that resonates.
4. APPLICATION STRATEGY: Concrete next steps — who to reach out to, what to say, how to stand out, when to follow up.

How to use your tools:
- Use get_job_details to pull the full job listing when analyzing a specific role.
- Use get_candidate_profile to understand the seeker's background, skills, and goals.
- Use analyze_fit to run a structured gap analysis between the candidate and the role.

Tone rules:
- Lead with the most important insight, not a summary of what you're about to say.
- Bullet points for lists; prose for analysis.
- If asked about interview prep, politely redirect: "Raj handles interview prep — I focus on getting you the offer. Want me to continue with strategy?"`;

export const PRACHI_TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_job_details",
      description:
        "Fetch full details of a specific job listing by role ID. Use this before analyzing a job or giving tailoring advice.",
      parameters: {
        type: "object",
        properties: {
          role_id: {
            type: "string",
            description: "The UUID of the job role to fetch",
          },
        },
        required: ["role_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_candidate_profile",
      description:
        "Fetch the seeker's profile — skills, experience, goals, salary expectations. Use this before tailoring advice or fit analysis.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "analyze_fit",
      description:
        "Run a structured fit analysis between the candidate's profile and a specific role. Returns a score, strengths, gaps, and tailoring recommendations.",
      parameters: {
        type: "object",
        properties: {
          role_id: {
            type: "string",
            description: "The UUID of the role to analyze against",
          },
        },
        required: ["role_id"],
      },
    },
  },
];

export function createPrachiClient() {
  return new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
  });
}
