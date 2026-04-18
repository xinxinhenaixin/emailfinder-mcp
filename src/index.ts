#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const API_BASE = "https://www.emailfinder.dev";
const API_KEY = process.env.EMAILFINDER_API_KEY;

if (!API_KEY) {
  console.error("Error: EMAILFINDER_API_KEY environment variable is required.");
  console.error("Get your API key at https://emailfinder.dev/dashboard/settings");
  process.exit(1);
}

async function callApi(path: string, params: Record<string, string | string[]>): Promise<{ status: number; data: unknown }> {
  const url = new URL(`${API_BASE}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (Array.isArray(value)) {
      value.forEach(v => url.searchParams.append(key, v));
    } else if (value) {
      url.searchParams.set(key, value);
    }
  }
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${API_KEY}` },
  });
  const data = await res.json();
  return { status: res.status, data };
}

const server = new McpServer(
  { name: "emailfinder", version: "1.0.0" },
  {
    instructions: "Use emailfinder tools to find verified professional email addresses. Credits are only charged when an email is found. Always use the most specific tool available.",
  }
);

// Tool: find email by person
server.tool(
  "find_email_by_person",
  "Find a verified email address for a person by their full name and company domain. Costs 1 credit if found.",
  {
    full_name: z.string().describe("Full name of the person (e.g. 'John Smith')"),
    domain: z.string().describe("Company domain (e.g. 'stripe.com')"),
  },
  async ({ full_name, domain }) => {
    const { status, data } = await callApi("/api/find-email/person", { full_name, domain });
    const d = data as Record<string, unknown>;
    if (status === 200 && d.valid_email) {
      return {
        content: [{ type: "text", text: `Found: ${d.valid_email}${d.person_full_name ? ` (${d.person_full_name}${d.person_job_title ? ", " + d.person_job_title : ""})` : ""}. Credits charged: ${d.credits_charged}` }],
      };
    }
    if (status === 404) return { content: [{ type: "text", text: "No verified email found for this person." }] };
    if (status === 401) return { content: [{ type: "text", text: "Invalid API key. Check your EMAILFINDER_API_KEY." }], isError: true };
    if (status === 402) return { content: [{ type: "text", text: "Insufficient credits. Top up at https://emailfinder.dev/dashboard/credits" }], isError: true };
    return { content: [{ type: "text", text: `Error ${status}: ${JSON.stringify(data)}` }], isError: true };
  }
);

// Tool: find email by LinkedIn URL
server.tool(
  "find_email_by_linkedin",
  "Find a verified email address from a LinkedIn profile URL. Costs 1 credit if found.",
  {
    linkedin_url: z.string().url().describe("LinkedIn profile URL (e.g. 'https://www.linkedin.com/in/johnsmith')"),
  },
  async ({ linkedin_url }) => {
    const { status, data } = await callApi("/api/find-email/linkedin", { linkedin_url });
    const d = data as Record<string, unknown>;
    if (status === 200 && d.valid_email) {
      return {
        content: [{ type: "text", text: `Found: ${d.valid_email}${d.person_full_name ? ` (${d.person_full_name}${d.person_job_title ? ", " + d.person_job_title : ""})` : ""}. Credits charged: ${d.credits_charged}` }],
      };
    }
    if (status === 404) return { content: [{ type: "text", text: "No verified email found for this LinkedIn profile." }] };
    if (status === 401) return { content: [{ type: "text", text: "Invalid API key. Check your EMAILFINDER_API_KEY." }], isError: true };
    if (status === 402) return { content: [{ type: "text", text: "Insufficient credits. Top up at https://emailfinder.dev/dashboard/credits" }], isError: true };
    return { content: [{ type: "text", text: `Error ${status}: ${JSON.stringify(data)}` }], isError: true };
  }
);

// Tool: find company emails
server.tool(
  "find_company_emails",
  "Find verified email addresses at a company by domain. Returns up to 20 emails. Costs 5 credits if found.",
  {
    domain: z.string().describe("Company domain (e.g. 'stripe.com')"),
  },
  async ({ domain }) => {
    const { status, data } = await callApi("/api/find-email/company", { domain });
    const d = data as Record<string, unknown>;
    if (status === 200 && Array.isArray(d.valid_emails) && d.valid_emails.length > 0) {
      return {
        content: [{ type: "text", text: `Found ${d.valid_emails.length} email(s) at ${domain}:\n${(d.valid_emails as string[]).join("\n")}\nCredits charged: ${d.credits_charged}` }],
      };
    }
    if (status === 404) return { content: [{ type: "text", text: `No verified emails found at ${domain}.` }] };
    if (status === 401) return { content: [{ type: "text", text: "Invalid API key. Check your EMAILFINDER_API_KEY." }], isError: true };
    if (status === 402) return { content: [{ type: "text", text: "Insufficient credits. Top up at https://emailfinder.dev/dashboard/credits" }], isError: true };
    return { content: [{ type: "text", text: `Error ${status}: ${JSON.stringify(data)}` }], isError: true };
  }
);

// Tool: find decision maker
server.tool(
  "find_decision_maker",
  "Find a verified email for a decision maker at a company by role/category. Costs 5 credits if found.",
  {
    domain: z.string().describe("Company domain (e.g. 'stripe.com')"),
    decision_maker_category: z.array(
      z.enum(["ceo", "engineering", "finance", "hr", "it", "logistics", "marketing", "operations", "buyer", "sales"])
    ).min(1).max(5).describe("Role categories to search for (e.g. ['ceo', 'marketing'])"),
    company_name: z.string().optional().describe("Company name (optional, improves accuracy)"),
  },
  async ({ domain, decision_maker_category, company_name }) => {
    const params: Record<string, string | string[]> = {
      domain,
      decision_maker_category,
    };
    if (company_name) params.company_name = company_name;
    const { status, data } = await callApi("/api/find-email/decision-maker", params);
    const d = data as Record<string, unknown>;
    if (status === 200 && d.valid_email) {
      const parts = [`Found: ${d.valid_email}`];
      if (d.person_full_name) parts.push(`Name: ${d.person_full_name}`);
      if (d.person_job_title) parts.push(`Title: ${d.person_job_title}`);
      parts.push(`Credits charged: ${d.credits_charged}`);
      return { content: [{ type: "text", text: parts.join("\n") }] };
    }
    if (status === 404) return { content: [{ type: "text", text: "No decision maker found for the specified roles." }] };
    if (status === 401) return { content: [{ type: "text", text: "Invalid API key. Check your EMAILFINDER_API_KEY." }], isError: true };
    if (status === 402) return { content: [{ type: "text", text: "Insufficient credits. Top up at https://emailfinder.dev/dashboard/credits" }], isError: true };
    return { content: [{ type: "text", text: `Error ${status}: ${JSON.stringify(data)}` }], isError: true };
  }
);

// Tool: validate email
server.tool(
  "validate_email",
  "Validate whether an email address is deliverable via real-time SMTP verification. Free to use.",
  {
    email: z.string().email().describe("Email address to validate"),
  },
  async ({ email }) => {
    const { status, data } = await callApi("/api/validate-email", { email });
    const d = data as Record<string, unknown>;
    if (status === 200) {
      return { content: [{ type: "text", text: `Email ${email} is valid and deliverable.` }] };
    }
    if (status === 404) return { content: [{ type: "text", text: `Email ${email} is invalid or undeliverable.` }] };
    if (status === 401) return { content: [{ type: "text", text: "Invalid API key. Check your EMAILFINDER_API_KEY." }], isError: true };
    return { content: [{ type: "text", text: `Error ${status}: ${JSON.stringify(data)}` }], isError: true };
  }
);

// Start
const transport = new StdioServerTransport();
await server.connect(transport);
