import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/shared/lib/supabase';
import { Briefing, BriefingQuestion, BriefingStatus, QuestionType } from '@/shared/types';

const THEME_COLOR = '#DFA653';

const toDbStatus = (status?: BriefingStatus) => {
  if (status === 'active') return 'published';
  return status || 'draft';
};

const fromDbStatus = (status?: string): BriefingStatus => {
  if (status === 'published') return 'active';
  if (status === 'archived') return 'archived';
  return 'draft';
};

const toDbType = (type?: QuestionType) => {
  if (type === 'single_choice') return 'single';
  if (type === 'multiple_choice') return 'multiple';
  return type || 'short_text';
};

const fromDbType = (type?: string): QuestionType => {
  if (type === 'single') return 'single_choice';
  if (type === 'multiple') return 'multiple_choice';
  return (type || 'short_text') as QuestionType;
};

const mapQuestionRow = (row: any): BriefingQuestion => ({
  id: row.id,
  briefingId: row.form_id,
  type: fromDbType(row.type),
  questionText: row.title,
  description: row.description || '',
  options: (row.options || []).map((option: any) => (typeof option === 'string' ? option : option.label)).filter(Boolean),
  isRequired: Boolean(row.required),
  orderIndex: row.position,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapBriefingRow = (row: any, questions: BriefingQuestion[] = []): Briefing => {
  const theme = row.theme || {};
  return {
    id: row.id,
    teamId: 'orka',
    userId: 'admin',
    title: row.name,
    description: row.welcome_description || '',
    themeColor: theme.buttonColor || THEME_COLOR,
    bgColor: theme.backgroundColor || '#f0f0f5',
    textColor: theme.textMode || 'auto',
    coverImage: theme.backgroundImage || '',
    bgPosition: theme.bgPosition || 'center center',
    endScreen: {
      title: row.success_title || 'Tudo certo!',
      message: row.success_description || 'Suas respostas foram enviadas com sucesso.',
      showConfetti: Boolean(theme.showConfetti),
      buttonText: theme.buttonText || '',
      buttonUrl: theme.buttonUrl || '',
      redirectUrl: theme.redirectUrl || '',
    },
    isTemplate: false,
    status: fromDbStatus(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    questions,
  };
};

const questionRows = (formId: string, questions: Omit<BriefingQuestion, 'id' | 'briefingId' | 'createdAt' | 'updatedAt'>[]) =>
  questions.map((q, idx) => ({
    form_id: formId,
    type: toDbType(q.type),
    title: q.questionText || `Pergunta ${idx + 1}`,
    description: q.description || '',
    required: Boolean(q.isRequired),
    options: (q.options || []).map((label, optionIndex) => ({ key: String.fromCharCode(65 + optionIndex), label, score: 0 })),
    settings: {},
    position: q.orderIndex || idx + 1,
  }));

const formPayload = (briefing: Partial<Briefing>) => {
  const endScreen = briefing.endScreen || {};
  return {
    name: briefing.title || 'Novo Formulário',
    slug: `${(briefing.title || 'novo-formulario')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '')
      .slice(0, 64)}-${Date.now().toString(36)}`,
    status: toDbStatus(briefing.status),
    welcome_title: briefing.title || 'Novo Formulário',
    welcome_description: briefing.description || '',
    success_title: endScreen.title || 'Tudo certo!',
    success_description: endScreen.message || 'Suas respostas foram enviadas com sucesso.',
    theme: {
      buttonColor: briefing.themeColor || THEME_COLOR,
      backgroundColor: briefing.bgColor || '#f0f0f5',
      backgroundImage: briefing.coverImage || '',
      bgPosition: briefing.bgPosition || 'center center',
      textMode: briefing.textColor || 'auto',
      showConfetti: Boolean(endScreen.showConfetti),
      buttonText: endScreen.buttonText || '',
      buttonUrl: endScreen.buttonUrl || '',
      redirectUrl: endScreen.redirectUrl || '',
    },
  };
};

const formUpdatePayload = (updates: Partial<Briefing>) => {
  const payload: Record<string, any> = {};
  if (updates.title !== undefined) {
    payload.name = updates.title;
    payload.welcome_title = updates.title;
  }
  if (updates.description !== undefined) payload.welcome_description = updates.description;
  if (updates.status !== undefined) payload.status = toDbStatus(updates.status);
  if (
    updates.themeColor !== undefined ||
    updates.bgColor !== undefined ||
    updates.textColor !== undefined ||
    updates.coverImage !== undefined ||
    updates.bgPosition !== undefined ||
    updates.endScreen !== undefined
  ) {
    const endScreen = updates.endScreen || {};
    payload.success_title = endScreen.title || 'Tudo certo!';
    payload.success_description = endScreen.message || 'Suas respostas foram enviadas com sucesso.';
    payload.theme = {
      buttonColor: updates.themeColor || THEME_COLOR,
      backgroundColor: updates.bgColor || '#f0f0f5',
      backgroundImage: updates.coverImage || '',
      bgPosition: updates.bgPosition || 'center center',
      textMode: updates.textColor || 'auto',
      showConfetti: Boolean(endScreen.showConfetti),
      buttonText: endScreen.buttonText || '',
      buttonUrl: endScreen.buttonUrl || '',
      redirectUrl: endScreen.redirectUrl || '',
    };
  }
  return payload;
};

export const useBriefingsCRUD = (currentTeamId?: string, currentUserId?: string) => {
  const [briefings, setBriefings] = useState<Briefing[]>([]);
  const [loading, setLoading] = useState(true);
  const activeFetchRef = useRef(0);
  const isMountedRef = useRef(true);

  useEffect(() => () => {
    isMountedRef.current = false;
  }, []);

  const fetchBriefings = useCallback(async () => {
    const requestId = ++activeFetchRef.current;
    if (!currentTeamId || !currentUserId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data: forms, error } = await supabase
        .from('orka_forms')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching forms:', error);
        return;
      }

      const ids = (forms || []).map((form) => form.id);
      const questionsMap: Record<string, BriefingQuestion[]> = {};

      if (ids.length > 0) {
        const { data: questions } = await supabase
          .from('orka_form_questions')
          .select('*')
          .in('form_id', ids)
          .order('position', { ascending: true });

        (questions || []).forEach((row) => {
          const question = mapQuestionRow(row);
          if (!questionsMap[question.briefingId]) questionsMap[question.briefingId] = [];
          questionsMap[question.briefingId].push(question);
        });
      }

      if (!isMountedRef.current || requestId !== activeFetchRef.current) return;
      setBriefings((forms || []).map((form) => mapBriefingRow(form, questionsMap[form.id] || [])));
    } finally {
      if (isMountedRef.current && requestId === activeFetchRef.current) setLoading(false);
    }
  }, [currentTeamId, currentUserId]);

  useEffect(() => {
    void fetchBriefings();
  }, [fetchBriefings]);

  const createBriefing = async (
    briefing: Omit<Briefing, 'id' | 'createdAt' | 'updatedAt' | 'questions'>,
    questions: Omit<BriefingQuestion, 'id' | 'briefingId' | 'createdAt' | 'updatedAt'>[]
  ) => {
    const { data: form, error } = await supabase
      .from('orka_forms')
      .insert(formPayload(briefing))
      .select('*')
      .single();

    if (error || !form) {
      console.error('Error creating form:', error);
      return null;
    }

    let createdQuestions: BriefingQuestion[] = [];
    if (questions.length > 0) {
      const { data, error: questionError } = await supabase
        .from('orka_form_questions')
        .insert(questionRows(form.id, questions))
        .select('*');

      if (questionError) console.error('Error creating form questions:', questionError);
      createdQuestions = (data || []).map(mapQuestionRow);
    }

    const mapped = mapBriefingRow(form, createdQuestions);
    setBriefings((current) => [mapped, ...current.filter((item) => item.id !== mapped.id)]);
    return form.id;
  };

  const updateBriefing = async (
    id: string,
    updates: Partial<Briefing>,
    newQuestions?: Omit<BriefingQuestion, 'id' | 'briefingId' | 'createdAt' | 'updatedAt'>[]
  ) => {
    const payload = formUpdatePayload(updates);
    if (Object.keys(payload).length > 0) {
      const { error } = await supabase.from('orka_forms').update(payload).eq('id', id);
      if (error) {
        console.error('Error updating form:', error);
        return;
      }
    }

    let nextQuestions: BriefingQuestion[] | undefined;
    if (newQuestions) {
      await supabase.from('orka_form_questions').delete().eq('form_id', id);
      if (newQuestions.length > 0) {
        const { data, error } = await supabase
          .from('orka_form_questions')
          .insert(questionRows(id, newQuestions))
          .select('*');
        if (error) console.error('Error updating form questions:', error);
        nextQuestions = (data || []).map(mapQuestionRow);
      } else {
        nextQuestions = [];
      }
    }

    setBriefings((current) => current.map((item) => (item.id === id ? { ...item, ...updates, questions: nextQuestions ?? item.questions } : item)));
    await fetchBriefings();
  };

  const deleteBriefing = async (id: string) => {
    const { error } = await supabase.from('orka_forms').delete().eq('id', id);
    if (error) {
      console.error('Error deleting form:', error);
      return;
    }
    setBriefings((current) => current.filter((briefing) => briefing.id !== id));
  };

  return {
    briefings,
    loading,
    createBriefing,
    updateBriefing,
    deleteBriefing,
    refetch: fetchBriefings,
  };
};

