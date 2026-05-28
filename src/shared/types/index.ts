export type BriefingStatus = 'draft' | 'active' | 'archived';
export type QuestionType = 'short_text' | 'long_text' | 'single_choice' | 'multiple_choice' | 'email' | 'phone' | 'date';
export type ResponseStatus = 'pending' | 'reviewed' | 'completed' | 'new' | 'disqualified';

export interface BriefingQuestion {
  id: string;
  briefingId: string;
  type: QuestionType;
  questionText: string;
  description?: string;
  options: string[];
  isRequired: boolean;
  orderIndex: number;
  settings?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface EndScreen {
  title: string;
  message: string;
  showConfetti: boolean;
  buttonText?: string;
  buttonUrl?: string;
  redirectUrl?: string;
}

export interface Briefing {
  id: string;
  slug?: string;
  teamId: string;
  userId: string;
  title: string;
  description?: string;
  themeColor?: string;
  bgColor?: string;
  textColor?: 'auto' | 'light' | 'dark';
  coverImage?: string;
  bgPosition?: string;
  endScreen?: EndScreen;
  isTemplate: boolean;
  status: BriefingStatus;
  createdAt?: string;
  updatedAt?: string;
  questions?: BriefingQuestion[];
}

export interface BriefingResponse {
  id: string;
  briefingId: string;
  leadId?: string;
  clientId?: string;
  answers: Record<string, unknown>;
  contact?: Record<string, unknown>;
  status: ResponseStatus;
  submittedAt: string;
}
