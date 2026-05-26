import React, { useState, useEffect } from 'react';
import { supabase } from '@/shared/lib/supabase';
import { Briefing, BriefingQuestion, BriefingResponse } from '@/shared/types';
import {
    ArrowLeft, Inbox, Clock, CheckCircle2, ChevronRight,
    Type, AlignLeft, CheckSquare, List, FileText, Calendar,
    Hash, User, Mail, Phone, CalendarDays
} from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────────────────────
const QUESTION_ICONS: Record<string, React.ReactNode> = {
    short_text: <Type className="w-4 h-4" />,
    long_text: <AlignLeft className="w-4 h-4" />,
    single_choice: <CheckSquare className="w-4 h-4" />,
    multiple_choice: <List className="w-4 h-4" />,
    email: <Mail className="w-4 h-4" />,
    phone: <Phone className="w-4 h-4" />,
    date: <CalendarDays className="w-4 h-4" />,
};

function formatDate(d: string): string {
    return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTime(d: string): string {
    return new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function timeAgo(d: string): string {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'agora';
    if (mins < 60) return `${mins}min atrás`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h atrás`;
    const days = Math.floor(hours / 24);
    return `${days}d atrás`;
}

// ─── Component ──────────────────────────────────────────────────────────────────
interface BriefingResponsesProps {
    briefing: Briefing;
    onBack: () => void;
}

const BriefingResponses: React.FC<BriefingResponsesProps> = ({ briefing, onBack }) => {
    const [responses, setResponses] = useState<BriefingResponse[]>([]);
    const [questions, setQuestions] = useState<BriefingQuestion[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);

    const fromDbType = (type?: string): BriefingQuestion['type'] => {
        if (type === 'single') return 'single_choice';
        if (type === 'multiple') return 'multiple_choice';
        return (type || 'short_text') as BriefingQuestion['type'];
    };

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);

            // Fetch responses
            const { data: rData } = await supabase
                .from('orka_form_responses')
                .select('*')
                .eq('form_id', briefing.id)
                .order('created_at', { ascending: false });

            // Fetch questions to map IDs → texts
            const { data: qData } = await supabase
                .from('orka_form_questions')
                .select('*')
                .eq('form_id', briefing.id)
                .order('position', { ascending: true });

            const mapped: BriefingResponse[] = (rData || []).map(r => ({
                id: r.id,
                briefingId: r.form_id,
                answers: r.answers || {},
                status: r.status,
                submittedAt: r.created_at,
            }));

            const mappedQ: BriefingQuestion[] = (qData || []).map(q => ({
                id: q.id,
                briefingId: q.form_id,
                type: fromDbType(q.type),
                questionText: q.title,
                description: q.description,
                options: (q.options || []).map((option: any) => typeof option === 'string' ? option : option.label).filter(Boolean),
                isRequired: q.required,
                orderIndex: q.position,
                settings: q.settings || {},
            }));

            setResponses(mapped);
            setQuestions(mappedQ);
            if (mapped.length > 0) setSelectedId(mapped[0].id);
            setLoading(false);
        };

        fetchData();
    }, [briefing.id]);

    const selectedResponse = responses.find(r => r.id === selectedId);
    const themeColor = briefing.themeColor || '#DFA653';
    const answeredCount = (r: BriefingResponse) => Object.keys(r.answers || {}).length;

    // ── Render ──
    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-[#0a0a0a] absolute inset-0 z-40">

            {/* ── Header ── */}
            <div className="h-14 px-4 border-b border-gray-200 dark:border-white/5 flex items-center justify-between bg-white dark:bg-[#111] shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={onBack} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500 transition-colors">
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                    <div>
                        <h1 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">{briefing.title}</h1>
                        <p className="text-[11px] text-gray-400">Respostas recebidas</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-white/5 rounded-lg">
                        <FileText className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-xs font-bold text-gray-600 dark:text-gray-300">{responses.length}</span>
                        <span className="text-xs text-gray-400">respostas</span>
                    </div>
                </div>
            </div>

            {/* ── Body ── */}
            <div className="flex-1 flex overflow-hidden">

                {/* ═══ Left: Responses List ═══ */}
                <div className="w-[330px] bg-white dark:bg-[#111] border-r border-gray-200 dark:border-white/5 flex flex-col shrink-0">
                    <div className="p-3 border-b border-gray-100 dark:border-white/5">
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                            {loading ? 'Carregando...' : `${responses.length} respostas`}
                        </p>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {loading ? (
                            <div className="p-6 flex flex-col items-center justify-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/5 animate-pulse" />
                                <p className="text-xs text-gray-400">Carregando respostas...</p>
                            </div>
                        ) : responses.length === 0 ? (
                            <div className="p-8 flex flex-col items-center justify-center gap-3 text-center">
                                <div className="w-14 h-14 bg-gray-50 dark:bg-white/5 rounded-2xl flex items-center justify-center">
                                    <Inbox className="w-7 h-7 text-gray-300 dark:text-gray-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Nenhuma resposta</p>
                                    <p className="text-xs text-gray-400 mt-1">Compartilhe o link do formulário para receber respostas.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="p-2 space-y-0.5">
                                {responses.map((r, idx) => {
                                    const isSel = r.id === selectedId;
                                    const answered = answeredCount(r);
                                    return (
                                        <button key={r.id} onClick={() => setSelectedId(r.id)}
                                            className={`w-full text-left p-3 rounded-xl transition-all group
                                                ${isSel
                                                    ? 'bg-gray-900 dark:bg-white text-white dark:text-black shadow-sm'
                                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'}`}>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0
                                                        ${isSel ? 'bg-white/20 dark:bg-black/20' : 'bg-gray-100 dark:bg-white/10'}`}>
                                                        <Hash className="w-3 h-3" />
                                                    </div>
                                                    <span className="text-xs font-bold">Resposta {responses.length - idx}</span>
                                                </div>
                                                <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isSel ? 'rotate-0' : 'opacity-0 group-hover:opacity-50'}`} />
                                            </div>
                                            <div className="flex items-center gap-3 ml-8">
                                                <span className={`text-[11px] flex items-center gap-1 ${isSel ? 'text-white/60 dark:text-black/50' : 'text-gray-400'}`}>
                                                    <Clock className="w-3 h-3" />
                                                    {timeAgo(r.submittedAt)}
                                                </span>
                                                <span className={`text-[11px] flex items-center gap-1 ${isSel ? 'text-white/60 dark:text-black/50' : 'text-gray-400'}`}>
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    {answered}/{questions.length}
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* ═══ Right: Response Detail ═══ */}
                <div className="flex-1 overflow-y-auto">
                    {!selectedResponse ? (
                        <div className="h-full flex flex-col items-center justify-center gap-3 text-center p-8">
                            <div className="w-16 h-16 bg-gray-100 dark:bg-white/5 rounded-2xl flex items-center justify-center">
                                <FileText className="w-8 h-8 text-gray-300 dark:text-gray-600" />
                            </div>
                            <p className="text-sm font-semibold text-gray-400">Selecione uma resposta</p>
                        </div>
                    ) : (
                        <div className="max-w-3xl mx-auto p-8 space-y-4">
                            {/* Response header */}
                            <div className="flex items-center justify-between mb-6">
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                                        Resposta #{responses.length - responses.findIndex(r => r.id === selectedId)}
                                    </h2>
                                    <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-1">
                                        <Calendar className="w-3.5 h-3.5" />
                                        {formatDate(selectedResponse.submittedAt)} às {formatTime(selectedResponse.submittedAt)}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span className="text-xs font-bold">
                                        {String(selectedResponse.status) === 'disqualified' ? 'Não qualificada' : String(selectedResponse.status) === 'completed' ? 'Concluída' : 'Pendente'}
                                    </span>
                                </div>
                            </div>

                            {/* Answer cards */}
                            {questions.map((q, idx) => {
                                const answer = selectedResponse.answers[q.id];
                                const hasAnswer = answer !== undefined && answer !== null && answer !== '';
                                const answerText = typeof answer === 'string' || typeof answer === 'number' || typeof answer === 'boolean'
                                    ? String(answer)
                                    : '';
                                const icon = QUESTION_ICONS[q.type] || <Type className="w-4 h-4" />;

                                return (
                                    <div key={q.id}
                                        className="bg-white dark:bg-[#111] border border-gray-100 dark:border-white/5 rounded-2xl p-5 transition-all hover:shadow-sm">
                                        {/* Question */}
                                        <div className="flex items-start gap-3 mb-3">
                                            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                                                style={{ backgroundColor: themeColor + '15', color: themeColor }}>
                                                {icon}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-bold text-gray-300 dark:text-gray-600">{idx + 1}.</span>
                                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{q.questionText}</p>
                                                    {q.isRequired && <span className="text-red-400 text-xs">*</span>}
                                                </div>
                                                {q.description && (
                                                    <p className="text-xs text-gray-400 mt-0.5 ml-5">{q.description}</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Answer */}
                                        <div className="ml-11">
                                            {!hasAnswer ? (
                                                <p className="text-sm text-gray-300 dark:text-gray-600 italic">Sem resposta</p>
                                            ) : Array.isArray(answer) ? (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {answer.map((a: unknown, ai: number) => (
                                                        <span key={ai}
                                                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium"
                                                            style={{ backgroundColor: themeColor + '12', color: themeColor }}>
                                                            <CheckCircle2 className="w-3 h-3" />
                                                            {String(a)}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (q.type === 'single_choice') ? (
                                                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium"
                                                    style={{ backgroundColor: themeColor + '12', color: themeColor }}>
                                                    <CheckCircle2 className="w-3 h-3" />
                                                    {answerText}
                                                </span>
                                            ) : (
                                                <p className="text-sm text-gray-700 dark:text-gray-200 bg-gray-50 dark:bg-white/5 rounded-xl px-4 py-3 leading-relaxed">
                                                    {answerText}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Summary bar */}
                            <div className="flex items-center justify-between pt-4 mt-2">
                                <p className="text-xs text-gray-400">
                                    {answeredCount(selectedResponse)} de {questions.length} perguntas respondidas
                                </p>
                                <div className="w-32 h-1.5 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all duration-500"
                                        style={{ width: `${questions.length > 0 ? (answeredCount(selectedResponse) / questions.length) * 100 : 0}%`, backgroundColor: themeColor }} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BriefingResponses;
