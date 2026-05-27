import { supabaseAnonKey, supabaseUrl } from '@/lib/supabase';

interface SubmitFormResponsePayload {
  form_id: string;
  answers: Record<string, unknown>;
  contact: Record<string, unknown>;
  status: 'completed' | 'disqualified';
}

export async function submitFormResponse(payload: SubmitFormResponsePayload): Promise<void> {
  const response = await fetch(`${supabaseUrl}/rest/v1/orka_form_responses`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || 'Não foi possível salvar a resposta.');
  }
}
