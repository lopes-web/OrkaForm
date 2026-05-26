export type FormStatus = 'draft' | 'published' | 'archived';

export type QuestionType =
  | 'short_text'
  | 'long_text'
  | 'single'
  | 'multiple'
  | 'email'
  | 'phone'
  | 'date';

export interface FormTheme {
  backgroundColor: string;
  backgroundImage: string;
  buttonColor: string;
  textMode: 'auto' | 'light' | 'dark';
}

export interface OrkaForm {
  id: string;
  name: string;
  slug: string;
  status: FormStatus;
  welcomeTitle: string;
  welcomeDescription: string;
  successTitle: string;
  successDescription: string;
  theme: FormTheme;
  createdAt: string;
  updatedAt: string;
}

export interface QuestionOption {
  key: string;
  label: string;
  score?: number;
}

export interface FormQuestion {
  id: string;
  formId: string;
  position: number;
  type: QuestionType;
  title: string;
  description: string;
  required: boolean;
  options: QuestionOption[];
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface FormResponse {
  id: string;
  formId: string;
  answers: Record<string, unknown>;
  contact: Record<string, unknown>;
  score: number;
  status: string;
  userAgent: string | null;
  createdAt: string;
}

interface OrkaFormRow {
  id: string;
  name: string;
  slug: string;
  status: FormStatus;
  welcome_title: string;
  welcome_description: string;
  success_title: string;
  success_description: string;
  theme: FormTheme;
  created_at: string;
  updated_at: string;
}

interface FormQuestionRow {
  id: string;
  form_id: string;
  position: number;
  type: QuestionType;
  title: string;
  description: string;
  required: boolean;
  options: QuestionOption[];
  settings: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface FormResponseRow {
  id: string;
  form_id: string;
  answers: Record<string, unknown>;
  contact: Record<string, unknown>;
  score: number;
  status: string;
  user_agent: string | null;
  created_at: string;
}

export const defaultTheme: FormTheme = {
  backgroundColor: '#0a0a0a',
  backgroundImage: '',
  buttonColor: '#e95138',
  textMode: 'auto',
};

export function adaptForm(row: OrkaFormRow): OrkaForm {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    welcomeTitle: row.welcome_title,
    welcomeDescription: row.welcome_description,
    successTitle: row.success_title,
    successDescription: row.success_description,
    theme: { ...defaultTheme, ...(row.theme || {}) },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function adaptQuestion(row: FormQuestionRow): FormQuestion {
  return {
    id: row.id,
    formId: row.form_id,
    position: row.position,
    type: row.type,
    title: row.title,
    description: row.description,
    required: row.required,
    options: row.options || [],
    settings: row.settings || {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function adaptResponse(row: FormResponseRow): FormResponse {
  return {
    id: row.id,
    formId: row.form_id,
    answers: row.answers || {},
    contact: row.contact || {},
    score: row.score || 0,
    status: row.status,
    userAgent: row.user_agent,
    createdAt: row.created_at,
  };
}

export function formToRow(form: OrkaForm) {
  return {
    name: form.name,
    slug: form.slug,
    status: form.status,
    welcome_title: form.welcomeTitle,
    welcome_description: form.welcomeDescription,
    success_title: form.successTitle,
    success_description: form.successDescription,
    theme: form.theme,
  };
}

export function questionToRow(question: FormQuestion, position: number) {
  return {
    id: question.id,
    form_id: question.formId,
    position,
    type: question.type,
    title: question.title,
    description: question.description,
    required: question.required,
    options: question.options,
    settings: question.settings,
  };
}

