// @ts-nocheck - Deno runtime
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGINS = [
  'https://voicekeeper.vercel.app',
  'https://voicekeeper.app',
  'http://localhost:8081',
  'http://localhost:8082',
  'http://localhost:8083',
  'http://localhost:19006',
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') ?? '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type',
  };
}

const MAX_AUDIO_SIZE = 25 * 1024 * 1024; // 25 MB (Whisper API limit)
const MAX_CUSTOM_INSTRUCTIONS_LENGTH = 1000;
const MAX_CUSTOM_EXAMPLE_LENGTH = 2000;

const VALID_FORMATS = [
  'bullet_list',
  'paragraph',
  'action_items',
  'meeting_notes',
  'custom',
];

const SYSTEM_PROMPTS: Record<string, string> = {
  bullet_list:
    'Extract the key points from this transcription and format them as a concise bulleted list using markdown bullets (- ). Reformulate each point in clear, concise language. Do not copy the transcription verbatim.',
  paragraph:
    'Rewrite this transcription as clean, well-structured prose paragraphs. Synthesize and restructure the ideas — don\'t just clean up the original wording. Remove filler words and improve readability.',
  action_items:
    'Extract all action items and tasks from this transcription. Rephrase each as a clear, actionable task using markdown checkboxes (- [ ] task). Do not copy sentences from the transcription.',
  meeting_notes:
    `Structure this transcription as meeting notes. Reformulate all content — do not copy sentences from the transcription. Use the following markdown structure:

## Key Topics
- ...

## Decisions Made
- ...

## Action Items
- ...`,
};

const SHARED_SUFFIX =
  `Also generate an expressive, descriptive title that captures the core subject or idea.
Good title: "App to benchmark LLM providers" — Bad title: "Je veux créer une application" (first words of the transcription).
Always respond in the same language as the transcription, unless the user instructs otherwise.
Respond ONLY with a valid JSON object with exactly two fields: "title" (string) and "content" (string containing the formatted note in markdown).`;

async function detectUncertainTerms(
  transcription: string
): Promise<Array<{ original: string; suggestion: string | null }>> {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5-nano',
        reasoning_effort: 'minimal',
        messages: [
          {
            role: 'system',
            content:
              'Identify words or phrases in this transcription that are likely misrecognized by speech-to-text: acronyms, technical terms, proper nouns, brand names, or phonetically ambiguous words. Only flag terms with genuine uncertainty — not common words. For each uncertain term, provide the original as transcribed and your best suggestion (or null if you cannot guess). Return 0 to 5 terms maximum.',
          },
          { role: 'user', content: transcription },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'uncertain_terms',
            schema: {
              type: 'object',
              properties: {
                uncertain_terms: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      original: { type: 'string' },
                      suggestion: { type: ['string', 'null'] },
                    },
                    required: ['original', 'suggestion'],
                  },
                  maxItems: 5,
                },
              },
              required: ['uncertain_terms'],
            },
          },
        },
      }),
    });
    if (!response.ok) return [];
    const result = await response.json();
    const parsed = JSON.parse(result.choices[0].message.content);
    return parsed.uncertain_terms ?? [];
  } catch {
    return [];
  }
}

function buildSystemPrompt(
  formatType: string,
  customExample?: string,
  customInstructions?: string,
  validatedTerms?: Array<{ original_term: string; corrected_term: string }>
): string {
  let prompt: string;

  if (formatType === 'custom' && customExample) {
    prompt = `Format the transcription following the exact same structure and style as this example note:\n\n---\n${customExample}\n---\n\nApply this structure to the new transcription. Reformulate the content to match the style — do not copy the transcription verbatim.\n\n${SHARED_SUFFIX}`;
  } else {
    prompt = `${SYSTEM_PROMPTS[formatType] || SYSTEM_PROMPTS['bullet_list']}\n\n${SHARED_SUFFIX}`;
  }

  // Inject validated term corrections so the LLM uses the right spellings
  if (validatedTerms && validatedTerms.length > 0) {
    const termsList = validatedTerms
      .map((t) => `  - "${t.original_term}" → "${t.corrected_term}"`)
      .join('\n');
    prompt += `\n\nKnown term corrections (always use these exact spellings in your output):\n${termsList}`;
  }

  // Append user custom instructions if provided (applies to all formats)
  if (customInstructions && customInstructions.trim()) {
    prompt += `\n\nAdditional user instructions (follow these closely): ${customInstructions.trim()}`;
  }

  return prompt;
}

async function transcribeAudio(audioFile: File | Blob): Promise<string> {
  const filename = (audioFile as File).name || 'recording.m4a';
  const formData = new FormData();
  formData.append('file', audioFile, filename);
  formData.append('model', 'whisper-1');

  const response = await fetch(
    'https://api.openai.com/v1/audio/transcriptions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      },
      body: formData,
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    if (response.status === 429) {
      throw new Error('Rate limited by OpenAI. Please try again in a moment.');
    }
    throw new Error(
      `Whisper API error: ${error?.error?.message || response.statusText}`
    );
  }

  const result = await response.json();
  return result.text;
}

async function formatTranscription(
  transcription: string,
  formatType: string,
  customExample?: string,
  customInstructions?: string,
  validatedTerms?: Array<{ original_term: string; corrected_term: string }>
): Promise<{ title: string; content: string }> {
  const systemPrompt = buildSystemPrompt(formatType, customExample, customInstructions, validatedTerms);

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5-nano',
      reasoning_effort: 'minimal',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: transcription },
      ],
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(
      `GPT API error: ${error?.error?.message || response.statusText}`
    );
  }

  const result = await response.json();
  return JSON.parse(result.choices[0].message.content);
}

async function suggestTags(
  formattedText: string,
  userTags: string[]
): Promise<string[]> {
  if (userTags.length === 0) return [];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5-nano',
      reasoning_effort: 'minimal',
      messages: [
        {
          role: 'system',
          content:
            'Given this note content, select 0 to 3 relevant tags from the provided list. Only use tags from the list. If no tags are relevant, return an empty array.',
        },
        {
          role: 'user',
          content: `Available tags: ${userTags.join(', ')}\n\nNote content: ${formattedText}`,
        },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'tag_suggestions',
          schema: {
            type: 'object',
            properties: {
              tags: {
                type: 'array',
                items: { type: 'string' },
                maxItems: 3,
              },
            },
            required: ['tags'],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    // Non-fatal: if tag suggestion fails, return empty array
    console.error('Tag suggestion failed:', response.status, response.statusText);
    return [];
  }

  try {
    const result = await response.json();
    const parsed: { tags: string[] } = JSON.parse(result.choices[0].message.content);
    // Filter to only include tags that are actually in the user's list
    return parsed.tags.filter((t) => userTags.includes(t));
  } catch {
    return [];
  }
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // Verify authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Parse multipart form data
    const formData = await req.formData();

    // Parse mode — determines which processing steps to run
    const modeRaw = (formData.get('mode') as string) ?? 'full';
    const validModes = ['full', 'transcribe_only', 'format_only'];
    const processingMode = validModes.includes(modeRaw) ? modeRaw : 'full';

    // Daily limit only applies to steps that use the LLM (format_only, full)
    if (processingMode !== 'transcribe_only') {
      const adminClient = createClient(supabaseUrl, supabaseServiceKey);
      const { data: allowance, error: allowanceError } = await adminClient.rpc(
        'check_note_allowance',
        { p_user_id: user.id }
      );

      if (allowanceError) {
        console.error('Allowance check error:', allowanceError);
      } else if (!allowance.allowed) {
        return new Response(
          JSON.stringify({
            error: 'daily_limit_reached',
            message: `You've reached your daily limit of ${allowance.daily_limit} notes. Subscription plans are coming soon!`,
            daily_count: allowance.daily_count,
            daily_limit: allowance.daily_limit,
          }),
          { status: 429, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }

    // transcribe_only mode: run Whisper, return transcription, skip LLM
    if (processingMode === 'transcribe_only') {
      const audioFile = formData.get('audio') as File | null;
      if (!audioFile) {
        return new Response(
          JSON.stringify({ error: 'audio file is required for transcribe_only mode' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
      if (audioFile.size > MAX_AUDIO_SIZE) {
        return new Response(
          JSON.stringify({ error: 'Audio file too large' }),
          { status: 413, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
      const transcription = await transcribeAudio(audioFile);
      const uncertainTerms = await detectUncertainTerms(transcription);
      return new Response(
        JSON.stringify({ transcription, uncertain_terms: uncertainTerms }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // format_only mode: skip Whisper, format raw_transcription with LLM
    if (processingMode === 'format_only') {
      const rawTranscription = formData.get('raw_transcription') as string | null;
      if (!rawTranscription || rawTranscription.trim().length === 0) {
        return new Response(
          JSON.stringify({ error: 'raw_transcription is required for format_only mode' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const fmtFormatType = (formData.get('format_type') as string) ?? 'bullet_list';
      if (!VALID_FORMATS.includes(fmtFormatType)) {
        return new Response(
          JSON.stringify({ error: `Invalid format_type: ${fmtFormatType}` }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      const fmtCustomExample = formData.get('custom_example') as string | null;
      const fmtCustomInstructions = formData.get('custom_instructions') as string | null;
      const fmtAutotaggingEnabled = formData.get('autotagging_enabled') === 'true';
      const fmtUserTagsRaw = formData.get('user_tags') as string | null;
      let fmtUserTags: string[] = [];
      if (fmtUserTagsRaw) {
        try { fmtUserTags = JSON.parse(fmtUserTagsRaw) as string[]; } catch { fmtUserTags = []; }
      }

      const fmtSafeExample = fmtCustomExample ? fmtCustomExample.slice(0, MAX_CUSTOM_EXAMPLE_LENGTH) : null;
      const fmtSafeInstructions = fmtCustomInstructions ? fmtCustomInstructions.slice(0, MAX_CUSTOM_INSTRUCTIONS_LENGTH) : null;

      const fmtValidatedTermsRaw = formData.get('validated_terms') as string | null;
      let fmtValidatedTerms: Array<{ original_term: string; corrected_term: string }> = [];
      if (fmtValidatedTermsRaw) {
        try { fmtValidatedTerms = JSON.parse(fmtValidatedTermsRaw); } catch { fmtValidatedTerms = []; }
      }

      const formatted = await formatTranscription(
        rawTranscription,
        fmtFormatType,
        fmtSafeExample || undefined,
        fmtSafeInstructions || undefined,
        fmtValidatedTerms.length > 0 ? fmtValidatedTerms : undefined
      );

      let fmtSuggestedTags: string[] = [];
      if (fmtAutotaggingEnabled && fmtUserTags.length > 0) {
        fmtSuggestedTags = await suggestTags(formatted.content, fmtUserTags);
      }

      return new Response(
        JSON.stringify({
          transcription: rawTranscription,
          formatted_text: formatted.content,
          title: formatted.title,
          ...(fmtAutotaggingEnabled && fmtSuggestedTags.length > 0 ? { suggested_tags: fmtSuggestedTags } : {}),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // processingMode === 'full': fall through to existing code (unchanged)
    const audioFile = formData.get('audio') as File | null;
    const formatType = formData.get('format_type') as string | null;
    const customExample = formData.get('custom_example') as string | null;
    const customInstructions = formData.get('custom_instructions') as string | null;
    const autotaggingEnabledRaw = formData.get('autotagging_enabled') as string | null;
    const userTagsRaw = formData.get('user_tags') as string | null;

    // Validate inputs
    if (!audioFile) {
      return new Response(
        JSON.stringify({ error: 'Missing audio file' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (audioFile.size > MAX_AUDIO_SIZE) {
      return new Response(
        JSON.stringify({ error: 'Audio file too large (max 25MB)' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (!formatType || !VALID_FORMATS.includes(formatType)) {
      return new Response(
        JSON.stringify({
          error: `Invalid format_type. Must be one of: ${VALID_FORMATS.join(', ')}`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    if (formatType === 'custom' && !customExample) {
      return new Response(
        JSON.stringify({
          error: 'custom_example is required when format_type is "custom"',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    // Clamp user-controlled prompt inputs to prevent prompt injection / abuse
    const safeCustomExample = customExample
      ? customExample.slice(0, MAX_CUSTOM_EXAMPLE_LENGTH)
      : null;
    const safeCustomInstructions = customInstructions
      ? customInstructions.slice(0, MAX_CUSTOM_INSTRUCTIONS_LENGTH)
      : null;

    const autotaggingEnabled = autotaggingEnabledRaw === 'true';
    let userTags: string[] = [];
    if (userTagsRaw) {
      try {
        userTags = JSON.parse(userTagsRaw) as string[];
      } catch {
        userTags = [];
      }
    }

    // Step 1: Transcribe audio with Whisper
    console.log('Starting transcription...');
    const transcription = await transcribeAudio(audioFile as File);
    console.log(`Transcription completed in ${Date.now() - startTime}ms`);

    // Step 2: Format with GPT (with fallback)
    let formattedText: string;
    let title: string;

    try {
      console.log('Starting formatting...');
      const formatted = await formatTranscription(
        transcription,
        formatType,
        safeCustomExample || undefined,
        safeCustomInstructions || undefined
      );
      formattedText = formatted.content;
      title = formatted.title;
      console.log(`Formatting completed in ${Date.now() - startTime}ms`);
    } catch (formatError) {
      // Fallback: use raw transcription
      console.error('Formatting failed, using fallback:', formatError);
      formattedText = transcription;
      const words = transcription.split(' ');
      title = words.slice(0, 5).join(' ');
    }

    // Step 3: Suggest tags (if autotagging enabled and user has tags)
    let suggestedTags: string[] = [];
    if (autotaggingEnabled && userTags.length > 0) {
      console.log('Starting tag suggestion...');
      suggestedTags = await suggestTags(formattedText, userTags);
      console.log(`Tag suggestion completed in ${Date.now() - startTime}ms`);
    }

    const totalTime = Date.now() - startTime;
    console.log(`Total processing time: ${totalTime}ms`);

    return new Response(
      JSON.stringify({
        transcription,
        formatted_text: formattedText,
        title,
        suggested_tags: suggestedTags,
      }),
      {
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  } catch (error) {
    console.error('Processing error:', error);
    const status = error.message?.includes('Rate limited') ? 429 : 500;
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
});
