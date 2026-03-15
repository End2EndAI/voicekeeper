# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in VoiceKeeper, please report it responsibly. **Do not open a public GitHub issue.**

**Email:** security@end2endai.com

Please include:
- A description of the vulnerability
- Steps to reproduce the issue
- The potential impact
- Any suggested fixes (optional)

We will acknowledge your report within 48 hours and aim to provide a fix within 7 days for critical issues.

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x     | Yes       |

## Security Practices

- **API keys are never exposed to the client.** All OpenAI API calls go through a server-side Supabase Edge Function.
- **Row-Level Security (RLS)** is enabled on all database tables and storage buckets.
- **Authentication tokens** are stored in platform-native secure storage (Keychain on iOS, Keystore on Android).
- **Audio recordings** are stored in a private Supabase Storage bucket with per-user isolation.
- **Data is hosted in the EU** (Supabase Frankfurt region).

## Self-Hosting Security

If you self-host VoiceKeeper:
- Never commit your `.env` file or API keys to version control
- Enable RLS on all tables (the migrations do this by default)
- Use a strong Supabase database password
- Set up Supabase's built-in rate limiting
- Consider enabling Supabase's audit logging for your project
