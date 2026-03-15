# Contributing to VoiceKeeper

Thanks for your interest in contributing to VoiceKeeper! Whether it's a bug report, feature suggestion, documentation improvement, or code contribution — all help is welcome.

## Getting started

1. Fork the repository and clone your fork
2. Follow the [setup instructions](README.md#self-hosting--development-setup) to get a local environment running
3. Create a new branch for your changes: `git checkout -b my-feature`
4. Make your changes and test them
5. Commit and push to your fork
6. Open a pull request against `main`

## Development environment

You'll need your own Supabase project and OpenAI API key. See the README for full setup details — VoiceKeeper follows a BYOK (Bring Your Own Keys) model.

## What to work on

Check the [open issues](https://github.com/End2EndAI/voicekeeper/issues) for bugs and feature requests. Issues labeled `good first issue` are a great starting point.

If you want to work on something not yet filed as an issue, please open one first to discuss the approach. This avoids duplicated effort and ensures alignment with the project direction.

## Code style

- TypeScript for all source files
- Follow the existing code patterns and project structure
- Keep components focused and small
- Use the existing context/service architecture for new features

## Pull request guidelines

- Keep PRs focused on a single change
- Write a clear description of what the PR does and why
- Make sure the app builds and runs on web (`npx expo start --web`) before submitting
- If your change affects the database, include a new migration file in `supabase/migrations/`

## Reporting bugs

Open a [bug report issue](https://github.com/End2EndAI/voicekeeper/issues/new?template=bug_report.md) with:

- Steps to reproduce
- Expected vs. actual behavior
- Platform (iOS / Android / Web) and device info
- Screenshots or recordings if applicable

## Suggesting features

Open a [feature request issue](https://github.com/End2EndAI/voicekeeper/issues/new?template=feature_request.md) and describe the use case, not just the solution. Explain what problem you're trying to solve.

## License

By contributing, you agree that your contributions will be licensed under the [AGPL-3.0 License](LICENSE).
