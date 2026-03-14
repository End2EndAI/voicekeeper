// @ts-nocheck - Deno runtime
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const VALID_FORMATS = [
  'bullet_list',
  'paragraph',
  'action_items',
  'meeting_notes',
];

const SYSTEM_PROMPTS: Record<string, string> = {
  bullet_list:
    'Extract the key points from this transcription and format them as a concise bulleted list using markdown bullets (- ).',
  paragraph:
    'Rewrite this transcription as clean, well-structured prose paragraphs. Fix grammar, remove filler words, and improve readability.',
  action_items:
    'Extract all action items and tasks from this transcription. Format each as a checkbox item using markdown (- [ ] task description).',
  meeting_notes:
    'Structure this transcription as meeting notes with the following markdown sections: ## Key Topics, ## Decisions Made, ## Action Items. Use bullet points within each section.',
};

async function transcribeAudio(audioBlob: Blob): Promise<string> {
  const formData = new FormData();
  formData.append('file', audioBlob, 'recording.m4a');
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
  formatType: string
): Promise<{ title: string; content: string }> {
  const systemPrompt = SYSTEM_PROMPTS[formatType];

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5-nano',
      messages: [
        {
          role: 'system',
          content: `${systemPrompt}\n\nAlso generate a short title (5 words maximum) summarizing the content.\n\nRespond with valid JSON only: {"title": "...", "content": "..."}`,
        },
        { role: 'user', content: transcription },
      ],
      temperature: 0.3,
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

serve(async (req: Request) => {
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

    // Parse multipart form data
    const formData = await req.formData();
    const audioFile = formData.get('audio') as File | null;
    const formatType = formData.get('format_type') as string | null;

    // Validate inputs
    if (!audioFile) {
      return new Response(
        JSON.stringify({ error: 'Missing audio file' }),
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

    // Step 1: Transcribe audio with Whisper
    console.log('Starting transcription...');
    const transcription = await transcribeAudio(audioFile);
    console.log(`Transcription completed in ${Date.now() - startTime}ms`);

    // Step 2: Format with GPT (with fallback)
    let formattedText: string;
    let title: string;

    try {
      console.log('Starting formatting...');
      const formatted = await formatTranscription(transcription, formatType);
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

    const totalTime = Date.now() - startTime;
    console.log(`Total processing time: ${totalTime}ms`);

    return new Response(
      JSON.stringify({
        transcription,
        formatted_text: formattedText,
        title,
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
