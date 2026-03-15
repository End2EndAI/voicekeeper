# Privacy Policy — VoiceKeeper

**Last updated:** March 15, 2026
**Data Controller:** [Louis FONTAINE / End2EndAI], micro-entreprise registered in France (SIRET: 953 238 821 00011)
**Contact:** valentinedaywebsite@proton.me

---

## 1. What Data We Collect

VoiceKeeper collects the minimum data necessary to provide the voice note-taking service:

| Data | Purpose | Legal Basis |
|------|---------|-------------|
| **Email address** | Account creation and authentication | Contractual necessity (GDPR Art. 6(1)(b)) |
| **Password** | Authentication (stored as a hash, never in plain text) | Contractual necessity |
| **Voice recordings** | Transcription into text notes | Consent (GDPR Art. 6(1)(a)) |
| **Transcribed text** | Core note-taking functionality | Contractual necessity |
| **Formatted notes** | Displaying organized notes | Contractual necessity |
| **User preferences** | Personalizing the note format and AI instructions | Contractual necessity |

We do **not** collect: location data, device identifiers, browsing history, contacts, or any data beyond what is listed above. We do not use analytics, advertising SDKs, or third-party tracking.

## 2. How Your Data Is Processed

When you record a voice note:

1. **Audio is captured** on your device
2. **Audio is sent** to our server (Supabase Edge Function hosted in the EU)
3. **Transcription:** The audio is forwarded to **OpenAI's Whisper API** for speech-to-text conversion
4. **Formatting:** The transcribed text is sent to **OpenAI's GPT API** to structure it into your chosen format
5. **Storage:** The resulting note is saved to our database (Supabase PostgreSQL, hosted in EU — Frankfurt)
6. **Audio file** is optionally stored in private cloud storage (Supabase Storage, EU)

OpenAI processes your audio and text data solely to provide the transcription and formatting service. Per OpenAI's API Data Processing Addendum, **your data is not used to train their models**.

## 3. Where Your Data Is Stored

All data is stored in the **European Union (Frankfurt, Germany)** on Supabase infrastructure. Data transfer to OpenAI's API servers (which may be located outside the EU) is protected by Standard Contractual Clauses (SCCs) as specified in OpenAI's Data Processing Addendum.

## 4. Who Has Access to Your Data

- **You:** Full access to all your data through the app
- **Supabase:** Infrastructure provider (data processor). Governed by their DPA with Standard Contractual Clauses.
- **OpenAI:** Sub-processor for audio transcription and text formatting. Governed by their API DPA.
- **VoiceKeeper / End2EndAI:** We do not access your notes or recordings unless required for technical support at your explicit request, or as required by law.

No data is shared with advertisers, data brokers, or any other third parties.

## 5. Your Rights (GDPR)

As a user, you have the following rights under the General Data Protection Regulation:

- **Right of Access (Art. 15):** You can request a copy of all data we hold about you.
- **Right to Rectification (Art. 16):** You can edit your notes and preferences directly in the app.
- **Right to Erasure (Art. 17):** You can delete individual notes, or delete your entire account and all data from Settings → Privacy & Data → "Delete My Account."
- **Right to Data Portability (Art. 20):** You can export all your data in JSON format from Settings → Privacy & Data → "Export My Data."
- **Right to Restriction (Art. 18):** You can request we restrict processing by contacting us.
- **Right to Object (Art. 21):** You can object to processing by contacting us.
- **Right to Withdraw Consent:** You can withdraw consent for audio processing at any time by deleting your account.

To exercise any of these rights, use the in-app features or email: **privacy@end2endai.com**

## 6. Data Retention

- **Notes and recordings:** Stored until you delete them or delete your account.
- **Account data:** Stored until you delete your account.
- **Audit logs:** Retained for up to 2 years for legal compliance, then automatically purged.
- **Deletion:** When you delete your account, all data (notes, recordings, preferences) is permanently and irreversibly erased. We do not maintain backup copies of deleted data beyond Supabase's standard backup retention window (typically 7 days).

## 7. Data Security

- All data in transit is encrypted with TLS
- Database access is protected by Row-Level Security (users can only access their own data)
- API keys are stored server-side and never exposed to client applications
- Authentication tokens are stored in platform-native secure storage (iOS Keychain / Android Keystore)
- Audio recordings are stored in a private, access-controlled storage bucket

## 8. Children's Privacy

VoiceKeeper is not directed at children under 16 years of age. We do not knowingly collect personal data from children. If we become aware that a child under 16 has provided us with personal data, we will take steps to delete that data.

## 9. Changes to This Policy

We may update this Privacy Policy from time to time. We will notify you of material changes through the app or by email. The "Last updated" date at the top reflects the most recent revision.

## 10. Contact & Complaints

For any privacy-related questions or to exercise your rights:

**Email:** privacy@end2endai.com

If you believe your data protection rights have been violated, you have the right to lodge a complaint with:

**CNIL (Commission Nationale de l'Informatique et des Libertés)**
3 Place de Fontenoy, TSA 80715, 75334 Paris Cedex 07, France
https://www.cnil.fr

---

## For Self-Hosters

If you self-host VoiceKeeper using your own API keys, **you** are the data controller for your instance. This privacy policy does not apply to self-hosted instances. You are responsible for your own GDPR compliance, including signing your own DPAs with Supabase and OpenAI.
