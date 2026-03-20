import OpenAI from "openai";

export const PRACHI_SYSTEM_PROMPT = `You are Prachi, a sharp and efficient talent partner. You work exclusively for employers — you are always on the hiring team's side.

Your personality:
- Professional, efficient, and direct. You respect the employer's time.
- You ask focused questions to understand exactly what they need.
- You're candid about what's realistic — you don't overpromise candidate quality.
- You help employers articulate what they actually need, not just what they think they want.

Your responsibilities:
1. ROLE CREATION: Help employers define roles clearly through conversation. Ask about must-have skills, nice-to-have skills, experience level, location, compensation, and team context.
2. CANDIDATE SEARCH: Surface the strongest matching candidates from the pool. Explain specifically why each candidate is a good fit.
3. MATCHING: When you mark a candidate as interested, you trigger the mutual match check. If both sides are interested, you'll handle the introduction.

How to use your tools:
- Use create_role when you have enough information to save a role (at minimum: title and some requirements).
- Use update_role to refine a role as you learn more.
- Use get_employer_roles to see what roles the employer has already created.
- Use find_candidates after a role is created to surface matches.
- Use record_employer_interest when the employer wants to connect with a candidate.

Important rules:
- NEVER reveal specific details about a candidate's identity unless record_employer_interest has been called and a match exists.
- Before showing candidates, confirm which role they're hiring for.
- Keep responses crisp. Employers don't want to read paragraphs.
- If no strong candidates exist yet, be honest: "The pool is thin for this role right now. Let's make sure the requirements are attracting the right people."`;

export const PRACHI_TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "create_role",
      description:
        "Create a new job role for the employer. Call this once you have at minimum a title and some requirements from the conversation.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Job title" },
          description: {
            type: "string",
            description: "Role description and context",
          },
          requirements: {
            type: "object",
            properties: {
              skills: {
                type: "array",
                items: { type: "string" },
                description: "Desired skills",
              },
              mustHave: {
                type: "array",
                items: { type: "string" },
                description: "Non-negotiable requirements",
              },
              niceToHave: {
                type: "array",
                items: { type: "string" },
                description: "Preferred but not required",
              },
              minYearsExperience: { type: "number" },
              maxYearsExperience: { type: "number" },
              location: { type: "string" },
              remote: { type: "boolean" },
              salaryMin: { type: "number" },
              salaryMax: { type: "number" },
              level: {
                type: "string",
                description: "Seniority level (junior/mid/senior/lead/principal)",
              },
              teamSize: { type: "number", description: "Current team size" },
              industry: { type: "string" },
            },
          },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_role",
      description:
        "Update an existing role's details or requirements. Use this to refine a role after creation.",
      parameters: {
        type: "object",
        properties: {
          role_id: { type: "string", description: "Role UUID to update" },
          title: { type: "string" },
          description: { type: "string" },
          requirements: { type: "object" },
        },
        required: ["role_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_employer_roles",
      description:
        "Get all active roles the employer has created. Use this to show the employer what roles they have open.",
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
      name: "find_candidates",
      description:
        "Search the candidate pool for people who match a specific role. Returns scored candidates with match reasons.",
      parameters: {
        type: "object",
        properties: {
          role_id: {
            type: "string",
            description: "The UUID of the role to find candidates for",
          },
          limit: {
            type: "number",
            description: "Number of candidates to return (default 10)",
          },
        },
        required: ["role_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "record_employer_interest",
      description:
        "Mark that the employer is interested in connecting with a specific candidate for a role. This triggers mutual match detection — if the candidate has also swiped yes, Prachi sends a warm introduction.",
      parameters: {
        type: "object",
        properties: {
          role_id: {
            type: "string",
            description: "The UUID of the role",
          },
          candidate_id: {
            type: "string",
            description: "The UUID of the candidate",
          },
        },
        required: ["role_id", "candidate_id"],
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
