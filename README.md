# emailfinder-mcp

MCP server for [emailfinder.dev](https://emailfinder.dev) — find verified professional email addresses directly from AI assistants like Claude, Cursor, and Kiro.

## Tools

| Tool | Description | Credits |
|------|-------------|---------|
| `find_email_by_person` | Name + domain → email | 1 |
| `find_email_by_linkedin` | LinkedIn URL → email | 1 |
| `find_company_emails` | Domain → list of emails | 5 |
| `find_decision_maker` | Role + domain → email | 5 |
| `validate_email` | Verify email deliverability | Free |

Credits are only charged when an email is found.

## Setup

Get your API key at [emailfinder.dev/dashboard/settings](https://emailfinder.dev/dashboard/settings).

### Claude Desktop / Cursor / Kiro

Add to your MCP config:

```json
{
  "mcpServers": {
    "emailfinder": {
      "command": "npx",
      "args": ["-y", "emailfinder-mcp"],
      "env": {
        "EMAILFINDER_API_KEY": "ef_live_your_key_here"
      }
    }
  }
}
```

### Example usage

> "Find the email for the CEO of stripe.com"

> "Find emails at openai.com"

> "What's the email for https://www.linkedin.com/in/johnsmith?"
