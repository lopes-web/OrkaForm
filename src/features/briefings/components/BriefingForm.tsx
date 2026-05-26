import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/shared/lib/supabase';
import { Briefing, BriefingQuestion, EndScreen } from '@/shared/types';
import LoadingScreen from '@/shared/components/LoadingScreen';
import { ChevronDown, ChevronUp, Check, Clipboard } from 'lucide-react';
import CountryCodePicker, { DEFAULT_COUNTRY, Country } from '@/components/CountryCodePicker';
import { isUuid } from '../lib/formUrls';

// ─── Utilities ─────────────────────────────────────────────────────────────────
function isColorDark(hex: string): boolean {
    const c = hex.replace('#', '');
    if (c.length < 6) return false;
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.55;
}

function getTextMode(tc: string | undefined, bg: string, hasImg: boolean): 'light' | 'dark' {
    if (tc === 'light') return 'light';
    if (tc === 'dark') return 'dark';
    // auto
    if (hasImg) return 'light';
    return isColorDark(bg) ? 'light' : 'dark';
}

const DEFAULT_END_SCREEN: EndScreen = {
    title: 'Tudo certo!',
    message: 'Suas respostas foram enviadas com sucesso.',
    showConfetti: false,
    buttonText: '',
    buttonUrl: '',
};

// ────────────────────────────────────────────────────────────────────────────────
interface BriefingFormProps {
    formId?: string;
}

const fromDbType = (type?: string): BriefingQuestion['type'] => {
    if (type === 'single') return 'single_choice';
    if (type === 'multiple') return 'multiple_choice';
    return (type || 'short_text') as BriefingQuestion['type'];
};

const BriefingForm: React.FC<BriefingFormProps> = ({ formId }) => {
    const id = formId || window.location.pathname.split('/').filter(Boolean).pop();

    const [briefing, setBriefing] = useState<Briefing | null>(null);
    const [questions, setQuestions] = useState<BriefingQuestion[]>([]);
    const [loading, setLoading] = useState(true);

    const [currentStep, setCurrentStep] = useState<number>(-1);
    const [answers, setAnswers] = useState<Record<string, any>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [isDisqualified, setIsDisqualified] = useState(false);
    const [phoneCountry, setPhoneCountry] = useState<Country>(DEFAULT_COUNTRY);

    useEffect(() => {
        const fetchBriefing = async () => {
            if (!id) return;
            try {
                setLoading(true);
                const formQuery = supabase.from('orka_forms').select('*');
                const { data: briefingData, error: bError } = await (isUuid(id)
                    ? formQuery.eq('id', id).single()
                    : formQuery.eq('slug', id).single());

                if (bError) throw bError;
                const theme = briefingData.theme || {};
                setBriefing({
                    id: briefingData.id,
                    slug: briefingData.slug,
                    teamId: 'orka',
                    userId: '',
                    title: briefingData.welcome_title || briefingData.name,
                    description: briefingData.welcome_description,
                    themeColor: theme.buttonColor,
                    bgColor: theme.backgroundColor,
                    textColor: theme.textMode,
                    coverImage: theme.backgroundImage,
                    bgPosition: theme.bgPosition,
                    endScreen: {
                        title: briefingData.success_title || DEFAULT_END_SCREEN.title,
                        message: briefingData.success_description || DEFAULT_END_SCREEN.message,
                        showConfetti: Boolean(theme.showConfetti),
                        buttonText: theme.buttonText || '',
                        buttonUrl: theme.buttonUrl || '',
                        redirectUrl: theme.redirectUrl || '',
                    },
                    status: briefingData.status === 'published' ? 'active' : briefingData.status,
                    isTemplate: false,
                    createdAt: briefingData.created_at,
                });

                const { data: qData, error: qError } = await supabase
                    .from('orka_form_questions').select('*').eq('form_id', briefingData.id).order('position', { ascending: true });

                if (qError) throw qError;
                if (qData) {
                    setQuestions(qData.map(q => ({
                        id: q.id, briefingId: q.form_id, type: fromDbType(q.type),
                        questionText: q.title, description: q.description,
                        options: (q.options || []).map((option: any) => typeof option === 'string' ? option : option.label).filter(Boolean),
                        isRequired: q.required, orderIndex: q.position, settings: q.settings || {},
                    })));
                }
            } catch (err) {
                console.error('Error fetching public briefing:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchBriefing();
    }, [id]);

    const handleSubmit = useCallback(async () => {
        if (!briefing) return;
        setIsSubmitting(true);
        try {
            const disqualifiedQuestion = questions.find((question) => {
                const disqualifyAnswers = question.settings?.disqualifyAnswers;
                return Array.isArray(disqualifyAnswers) && disqualifyAnswers.includes(answers[question.id]);
            });
            const contact = questions.reduce<Record<string, unknown>>((acc, question) => {
                const field = question.settings?.contactField;
                if (typeof field === 'string' && answers[question.id]) acc[field] = answers[question.id];
                return acc;
            }, {});
            const nextIsDisqualified = Boolean(disqualifiedQuestion);
            const { error } = await supabase.from('orka_form_responses').insert({ form_id: briefing.id, answers, contact, status: nextIsDisqualified ? 'disqualified' : 'completed' } as any);
            if (error) throw error;
            setIsDisqualified(nextIsDisqualified);
            setIsSuccess(true);

            // Auto-redirect if configured
            const redirectUrl = briefing.endScreen?.redirectUrl;
            if (redirectUrl) {
                setTimeout(() => {
                    window.location.href = redirectUrl.startsWith('http') ? redirectUrl : `https://${redirectUrl}`;
                }, 2000);
            }
        } catch (err) {
            console.error('Error submitting briefing:', err);
            alert('Ocorreu um erro ao enviar suas respostas. Tente novamente.');
        } finally {
            setIsSubmitting(false);
        }
    }, [answers, briefing, questions]);

    const handleNext = useCallback(() => {
        if (questions.length === 0 || currentStep >= questions.length - 1) {
            void handleSubmit();
            return;
        }
        setCurrentStep(prev => prev + 1);
    }, [currentStep, handleSubmit, questions.length]);

    const handlePrev = useCallback(() => {
        if (currentStep > -1) setCurrentStep(prev => prev - 1);
    }, [currentStep]);

    // Keyboard navigation — must be before any conditional returns
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                const tag = (e.target as HTMLElement).tagName.toLowerCase();
                if (tag !== 'textarea') {
                    e.preventDefault();
                    handleNext();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleNext]);

    const q = useMemo(() => (
        currentStep >= 0 && currentStep < questions.length ? questions[currentStep] : null
    ), [currentStep, questions]);

    const bgStyle = useMemo<React.CSSProperties>(() => (
        briefing?.coverImage
            ? { backgroundImage: `url(${briefing.coverImage})`, backgroundSize: 'cover', backgroundPosition: briefing.bgPosition || 'center center' }
            : { backgroundColor: briefing?.bgColor || '#f0f0f5' }
    ), [briefing?.bgColor, briefing?.coverImage, briefing?.bgPosition]);

    if (loading) return <LoadingScreen />;

    if (!briefing) {
        return (
            <div className="h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Formulário não encontrado</h1>
                    <p className="text-gray-500">O briefing que você está procurando não existe ou foi removido.</p>
                </div>
            </div>

    if (!briefing) {
        return (
            <div className="h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-gray-900 mb-2">Formulário não encontrado</h1>
                    <p className="text-gray-500">O briefing que você está procurando não existe ou foi removido.</p>
                </div>
            </div>
        );
    }

    // ── Resolved design values ──
    const themeColor = briefing.themeColor || '#DFA653';
    const bgColor = briefing.bgColor || '#f0f0f5';
    const hasCoverImage = !!briefing.coverImage;
    const textMode = getTextMode(briefing.textColor, bgColor, hasCoverImage);
    const endScreen: EndScreen = briefing.endScreen || DEFAULT_END_SCREEN;
    const disqualificationSettings = questions.find((question) => Array.isArray(question.settings?.disqualifyAnswers))?.settings || {};
    const successTitle = isDisqualified ? String(disqualificationSettings.disqualificationTitle || 'Obrigado pelas respostas!') : endScreen.title;
    const successMessage = isDisqualified
        ? String(disqualificationSettings.disqualificationMessage || 'Neste momento, sua empresa ainda não está no perfil ideal para este diagnóstico. Mesmo assim, suas respostas foram registradas com carinho.')
        : endScreen.message;
    const isLight = textMode === 'light';

    // CSS classes based on text mode
    const textPrimary = isLight ? 'text-white' : 'text-gray-900';
    const textSecondary = isLight ? 'text-white/70' : 'text-gray-500';
    const inputBorder = isLight ? 'border-white/40 text-white placeholder-white/50 focus:border-white' : 'border-gray-400 text-gray-900 placeholder-gray-400 focus:border-gray-900';
    const optNormal = isLight ? 'bg-white/10 text-white border-white/20 hover:bg-white/20' : 'bg-white text-gray-800 border-gray-300 hover:border-gray-400';
    const letterNormal = isLight ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600';
    const navHint = isLight ? 'text-white/50' : 'text-gray-400';

    // ── Success screen ──
    if (isSuccess) {
        return (
            <div className="h-screen w-full flex flex-col relative overflow-hidden" style={bgStyle}>
                {hasCoverImage && <div className="absolute inset-0 bg-black/40" />}
                <div className="flex-1 flex items-center justify-center p-6 relative z-10">
                    <div className="max-w-xl w-full text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
                        <div className="w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center mx-auto shadow-lg" style={{ backgroundColor: themeColor }}>
                            <Check className="w-10 h-10 md:w-12 md:h-12 text-white" />
                        </div>
                        <h1 className={`text-3xl md:text-5xl font-bold ${textPrimary}`}>{successTitle}</h1>
                        <p className={`text-lg md:text-xl ${textSecondary}`}>{successMessage}</p>
                        {endScreen.buttonText && (
                            <a href={endScreen.buttonUrl || '#'}
                                className="inline-block px-6 py-3.5 md:px-8 md:py-4 rounded-xl text-white font-bold text-base md:text-lg transition-all hover:scale-105 mt-4 shadow-lg"
                                style={{ backgroundColor: themeColor }}>
                                {endScreen.buttonText}
                            </a>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // ── Main form ──
    return (
        <div className="h-screen w-full flex flex-col font-sans relative overflow-hidden" style={bgStyle}>
            {hasCoverImage && <div className="absolute inset-0 bg-black/40 z-0" />}

            {/* Progress bar */}
            <div className="absolute top-0 left-0 w-full h-1.5 bg-black/10 z-50">
                <div className="h-full transition-all duration-500 ease-out" style={{ width: `${Math.max(0, ((currentStep + 1) / (questions.length + 1)) * 100)}%`, backgroundColor: themeColor }} />
            </div>

            <div className="flex-1 w-full max-w-4xl mx-auto flex flex-col justify-start p-4 sm:p-6 overflow-y-auto relative z-10 pb-32 pt-8 custom-scrollbar">
                <div className="my-auto w-full py-4">
                    {currentStep === -1 ? (
                        /* Welcome */
                        <div className="w-full">
                            <h1 className={`text-3xl md:text-5xl font-bold mb-4 md:mb-6 ${textPrimary}`} style={{ color: isLight ? undefined : themeColor }}>{briefing.title}</h1>
                            {briefing.description && <p className={`text-lg md:text-2xl mb-8 md:mb-12 leading-relaxed max-w-2xl ${textSecondary}`}>{briefing.description}</p>}
                            <button onClick={handleNext}
                                className="px-6 py-3.5 md:px-8 md:py-4 rounded-xl text-white font-bold text-base md:text-xl transition-all hover:scale-105 active:scale-95 shadow-lg flex items-center gap-2"
                                style={{ backgroundColor: themeColor, boxShadow: `0 10px 25px -5px ${themeColor}60` }}>
                                Começar <span className="text-sm font-normal opacity-80 ml-2 hidden sm:inline">Pressione Enter ↵</span>
                            </button>
                            <div className={`mt-6 md:mt-8 flex items-center gap-2 text-sm font-medium ${navHint}`}><Clipboard className="w-4 h-4" /> {questions.length} perguntas</div>
                        </div>
                    ) : q && (
                        /* Question */
                        <div key={currentStep} className="w-full animate-in fade-in slide-in-from-bottom-4 duration-300">
                            <div className="flex items-start gap-3 md:gap-4 mb-4">
                                <span className="text-xl md:text-2xl font-bold opacity-50 pt-0.5" style={{ color: themeColor }}>{currentStep + 1} &rarr;</span>
                                <h2 className={`text-xl sm:text-2xl md:text-4xl font-bold leading-tight ${textPrimary}`}>
                                    {q.questionText}{q.isRequired && <span className="text-red-500 ml-2">*</span>}
                                </h2>
                            </div>
                            {q.description && <p className={`text-base md:text-lg mb-6 ml-0 md:ml-12 leading-relaxed ${textSecondary}`}>{q.description}</p>}

                            <div className="ml-0 md:ml-12 mt-6 md:mt-8 w-full max-w-2xl">
                                {(q.type === 'short_text') && (
                                    <input type="text" placeholder="Digite sua resposta aqui..." value={answers[q.id] || ''}
                                        onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}
                                        className={`w-full text-xl md:text-3xl bg-transparent border-b-2 ${inputBorder} p-2 pb-3 outline-none transition-colors`} autoFocus />
                                )}
                                {q.type === 'email' && (
                                    <input type="email" placeholder="name@example.com" value={answers[q.id] || ''}
                                        onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}
                                        className={`w-full text-xl md:text-3xl bg-transparent border-b-2 ${inputBorder} p-2 pb-3 outline-none transition-colors`} autoFocus />
                                )}
                                {q.type === 'phone' && (() => {
                                    const raw = answers[q.id] || '';
                                    const formatPhone = (val: string) => {
                                        const digits = val.replace(/\D/g, '').slice(0, 11);
                                        if (digits.length <= 2) return digits;
                                        if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
                                        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
                                    };
                                    return (
                                        <div className="flex items-end gap-3">
                                            <CountryCodePicker
                                                selected={phoneCountry}
                                                onChange={setPhoneCountry}
                                                textClass={textPrimary}
                                                borderClass={inputBorder}
                                                theme={isLight ? 'dark' : 'light'}
                                            />
                                            <input type="tel" inputMode="numeric" placeholder="(00) 00000-0000" value={raw}
                                                onChange={e => setAnswers({ ...answers, [q.id]: formatPhone(e.target.value) })}
                                                className={`flex-1 text-xl md:text-3xl bg-transparent border-b-2 ${inputBorder} p-2 pb-3 outline-none transition-colors`} autoFocus />
                                        </div>
                                    );
                                })()}
                                {q.type === 'date' && (() => {
                                    const parts = (answers[q.id] || '//').split('/');
                                    const day = parts[0] || '';
                                    const month = parts[1] || '';
                                    const year = parts[2] || '';
                                    const update = (d: string, m: string, y: string) => setAnswers({ ...answers, [q.id]: `${d}/${m}/${y}` });
                                    return (
                                        <div className="flex items-end gap-2 md:gap-3">
                                            <div className="flex flex-col">
                                                <span className={`text-xs md:text-sm font-medium mb-1 md:mb-2 ${textSecondary}`}>Dia</span>
                                                <input type="text" inputMode="numeric" maxLength={2} placeholder="DD" value={day}
                                                    onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 2); update(v, month, year); if (v.length === 2) (e.target.nextElementSibling?.nextElementSibling?.nextElementSibling as HTMLInputElement)?.focus?.(); }}
                                                    className={`w-16 md:w-20 text-xl md:text-3xl bg-transparent border-b-2 ${inputBorder} p-2 pb-3 outline-none text-center transition-colors`} autoFocus />
                                            </div>
                                            <span className={`text-2xl md:text-3xl font-light pb-3 ${textSecondary}`}>/</span>
                                            <div className="flex flex-col">
                                                <span className={`text-xs md:text-sm font-medium mb-1 md:mb-2 ${textSecondary}`}>Mês</span>
                                                <input type="text" inputMode="numeric" maxLength={2} placeholder="MM" value={month}
                                                    onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 2); update(day, v, year); if (v.length === 2) (e.target.nextElementSibling?.nextElementSibling?.nextElementSibling as HTMLInputElement)?.focus?.(); }}
                                                    className={`w-16 md:w-20 text-xl md:text-3xl bg-transparent border-b-2 ${inputBorder} p-2 pb-3 outline-none text-center transition-colors`} />
                                            </div>
                                            <span className={`text-2xl md:text-3xl font-light pb-3 ${textSecondary}`}>/</span>
                                            <div className="flex flex-col">
                                                <span className={`text-xs md:text-sm font-medium mb-1 md:mb-2 ${textSecondary}`}>Ano</span>
                                                <input type="text" inputMode="numeric" maxLength={4} placeholder="AAAA" value={year}
                                                    onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 4); update(day, month, v); }}
                                                    className={`w-24 md:w-28 text-xl md:text-3xl bg-transparent border-b-2 ${inputBorder} p-2 pb-3 outline-none text-center transition-colors`} />
                                            </div>
                                        </div>
                                    );
                                })()}
                                {q.type === 'long_text' && (
                                    <textarea placeholder="Digite sua resposta detalhada aqui..." value={answers[q.id] || ''}
                                        onChange={e => setAnswers({ ...answers, [q.id]: e.target.value })}
                                        className={`w-full text-lg md:text-2xl bg-transparent border-b-2 ${inputBorder} p-2 outline-none transition-colors min-h-[120px] md:min-h-[150px] resize-none`} autoFocus />
                                )}
                                {q.type === 'single_choice' && (
                                    <div className="space-y-2.5">
                                        {q.options?.map((opt, idx) => {
                                            const sel = answers[q.id] === opt;
                                            return (
                                                <button key={idx}
                                                    onClick={() => { setAnswers({ ...answers, [q.id]: opt }); setTimeout(handleNext, 400); }}
                                                    className={`w-full text-left px-4 py-3 md:px-6 md:py-4 rounded-xl border-2 transition-all text-base md:text-lg font-medium flex items-center justify-between
                                                        ${sel ? 'border-transparent shadow-md ring-2 ring-offset-2' : optNormal}`}
                                                    style={sel ? { backgroundColor: themeColor + '15', color: themeColor, borderColor: themeColor } : {}}>
                                                    <div className="flex items-start gap-3 md:gap-4 flex-1 min-w-0">
                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${sel ? 'bg-white shadow-sm' : letterNormal}`}
                                                            style={sel ? { color: themeColor } : {}}>{String.fromCharCode(65 + idx)}</div>
                                                        <span className="break-words flex-1 min-w-0 pt-0.5">{opt}</span>
                                                    </div>
                                                    {sel && <Check className="w-5 h-5 flex-shrink-0 ml-2" style={{ color: themeColor }} />}
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                                {q.type === 'multiple_choice' && (
                                    <div className="space-y-2.5">
                                        {q.options?.map((opt, idx) => {
                                            const cur: string[] = answers[q.id] || [];
                                            const sel = cur.includes(opt);
                                            return (
                                                <button key={idx}
                                                    onClick={() => { const n = sel ? cur.filter(a => a !== opt) : [...cur, opt]; setAnswers({ ...answers, [q.id]: n }); }}
                                                    className={`w-full text-left px-4 py-3 md:px-6 md:py-4 rounded-xl border-2 transition-all text-base md:text-lg font-medium flex items-center justify-between
                                                        ${sel ? 'border-transparent shadow-md ring-2 ring-offset-2' : optNormal}`}
                                                    style={sel ? { backgroundColor: themeColor + '15', color: themeColor, borderColor: themeColor } : {}}>
                                                    <div className="flex items-start gap-3 md:gap-4 flex-1 min-w-0">
                                                        <div className={`w-8 h-8 rounded-md flex items-center justify-center font-bold text-sm flex-shrink-0 ${sel ? 'bg-white shadow-sm' : letterNormal}`}
                                                            style={sel ? { color: themeColor } : {}}>
                                                            {sel ? <Check className="w-5 h-5" /> : String.fromCharCode(65 + idx)}
                                                        </div>
                                                        <span className="break-words flex-1 min-w-0 pt-0.5">{opt}</span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>

                            <div className="ml-0 md:ml-12 mt-6 md:mt-8 flex items-center gap-4">
                                <button onClick={handleNext} disabled={isSubmitting}
                                    className="px-5 py-3 md:px-6 md:py-3 rounded-xl text-white font-bold text-base md:text-lg transition-all hover:opacity-90 active:scale-95 shadow-md flex items-center gap-2"
                                    style={{ backgroundColor: themeColor }}>
                                    {currentStep === questions.length - 1 ? (isSubmitting ? 'Enviando...' : 'Enviar Respostas') : <><span>OK</span> <Check className="w-5 h-5" /></>}
                                </button>
                                <span className={`text-sm hidden sm:inline ${navHint}`}>pressione <strong>Enter ↵</strong></span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Nav buttons */}
            {currentStep > -1 && (
                <div className="absolute bottom-6 right-6 flex items-center gap-2 z-20">
                    <button onClick={handlePrev} disabled={currentStep === 0} className="w-12 h-12 rounded-xl bg-gray-900 text-white flex items-center justify-center disabled:opacity-20 hover:bg-gray-800 transition-colors"><ChevronUp className="w-6 h-6" /></button>
                    <button onClick={handleNext} className="w-12 h-12 rounded-xl bg-gray-900 text-white flex items-center justify-center hover:bg-gray-800 transition-colors"><ChevronDown className="w-6 h-6" /></button>
                </div>
            )}

            {/* Powered by */}
            <div className="absolute bottom-6 left-6 opacity-40 hover:opacity-100 transition-opacity flex items-center gap-2 z-20">
                <span className={`text-xs font-bold ${isLight ? 'text-white' : 'text-gray-900'}`}>Powered by</span>
                <span className="text-xs font-bold" style={{ color: themeColor }}>OrkaForm</span>
            </div>
        </div>
    );
};

export default BriefingForm;
