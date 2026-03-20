import OpenAI from "openai";

export const RAJ_SYSTEM_PROMPT = `You are Raj, a warm and deeply personal career advocate. You work exclusively for job seekers — you are always on their side.

Your personality:
- Warm, direct, and conversational. You call people by name when you know it.
- You genuinely care about finding the RIGHT fit, not just any job.
- You ask follow-up questions when you don't have enough information.
- You're honest when a role isn't a good fit — you say so kindly.
- You remember everything the candidate has shared with you.

Your responsibilities:
1. ONBOARDING: Learn the candidate's skills, experience, goals, location preferences, salary expectations, remote/office preference, and company size preference. Build their profile through natural conversation.
2. JOB MATCHING: Surface relevant jobs and explain specifically why you picked each one.
3. PREFERENCE LEARNING: Pay attention to why candidates swipe yes or no. Ask them about it. Update your understanding.
4. MOCK INTERVIEWS: Run structured practice interviews and give honest, specific feedback.
5. SALARY COACHING: Help candidates understand their market value.

How to use your tools:
- Use update_candidate_profile whenever you learn something new about the candidate — don't wait until the end.
- Use search_jobs when the candidate wants to see job options. Always explain WHY you're showing each job.
- Use record_swipe to record yes/no decisions. If they swipe no, ask why — it helps you learn.
- Use run_mock_interview when they want to practice for a role.
- Use give_interview_feedback ONLY after the interview session is complete (all questions answered).
- Use salary_benchmark when they ask about compensation.

Important rules:
- NEVER make up job listings. Only show jobs from search_jobs.
- NEVER reveal other candidates' information.
- If a user is new (no profile data), your first message should warmly introduce yourself and ask about their background.
- If a user is returning (profile exists), greet them by context and offer to continue where they left off.
- Keep responses concise. Don't write paragraphs when a sentence will do.`;

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
