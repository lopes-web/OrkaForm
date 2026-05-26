import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Briefing, BriefingQuestion, QuestionType, EndScreen } from '@/shared/types';
import { supabase } from '@/shared/lib/supabase';
import {
    ArrowLeft, Plus, Type, AlignLeft, CheckSquare, List,
    Settings2, Trash2, Eye, Check, ChevronUp, ChevronDown,
    Clipboard, Palette, Image, X, Upload, Sun, Moon, Sparkles,
    Home, Flag, ExternalLink, ToggleLeft, Link2, MessageSquareText,
    Mail, Phone, CalendarDays
} from 'lucide-react';
import BriefingResponses from './BriefingResponses';
import CountryCodePicker, { DEFAULT_COUNTRY, Country } from '@/components/CountryCodePicker';
import { normalizeSlug, publicFormUrl } from '../lib/formUrls';

// ─── Utilities ─────────────────────────────────────────────────────────────────
function isColorDark(hex: string): boolean {
    const c = hex.replace('#', '');
    if (c.length < 6) return false;
    const r = parseInt(c.substring(0, 2), 16);
    const g = parseInt(c.substring(2, 4), 16);
    const b = parseInt(c.substring(4, 6), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.55;
}

function getResolvedTextMode(tc: 'auto' | 'light' | 'dark', bg: string, hasImg: boolean): 'light' | 'dark' {
    if (tc !== 'auto') return tc;
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

const QUESTION_TYPES: { type: QuestionType; label: string; icon: React.ReactNode }[] = [
    { type: 'short_text', label: 'Texto Curto', icon: <Type className="w-4 h-4" /> },
    { type: 'long_text', label: 'Texto Longo', icon: <AlignLeft className="w-4 h-4" /> },
    { type: 'single_choice', label: 'Escolha Única', icon: <CheckSquare className="w-4 h-4" /> },
    { type: 'multiple_choice', label: 'Múltipla', icon: <List className="w-4 h-4" /> },
    { type: 'email', label: 'Email', icon: <Mail className="w-4 h-4" /> },
    { type: 'phone', label: 'Telefone', icon: <Phone className="w-4 h-4" /> },
    { type: 'date', label: 'Data', icon: <CalendarDays className="w-4 h-4" /> },
];

const BG_POSITIONS = [
    { label: '↖', value: 'left top' }, { label: '↑', value: 'center top' }, { label: '↗', value: 'right top' },
    { label: '←', value: 'left center' }, { label: '⊕', value: 'center center' }, { label: '→', value: 'right center' },
    { label: '↙', value: 'left bottom' }, { label: '↓', value: 'center bottom' }, { label: '↘', value: 'right bottom' },
];

// ─── Preview Simulation ────────────────────────────────────────────────────────
interface PreviewSimulationProps {
    title: string; description: string; themeColor: string; bgColor: string;
    textMode: 'light' | 'dark'; coverImage?: string; bgPosition?: string;
    questions: Partial<BriefingQuestion>[]; endScreen: EndScreen; onClose: () => void;
}

const PreviewSimulation: React.FC<PreviewSimulationProps> = ({
    title, description, themeColor, bgColor, textMode, coverImage, bgPosition, questions, endScreen, onClose
}) => {
    const [step, setStep] = useState(-1);
    const [answers, setAnswers] = useState<Record<number, any>>({});
    const [done, setDone] = useState(false);
    const [phoneCountry, setPhoneCountry] = useState<Country>(DEFAULT_COUNTRY);

    const handleNext = useCallback(() => {
        if (questions.length === 0 || step >= questions.length - 1) {
            setDone(true);
            return;
        }
        setStep(prev => prev + 1);
    }, [questions.length, step]);

    const handlePrev = useCallback(() => {
        if (step > -1) setStep(prev => prev - 1);
    }, [step]);

    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                const tag = (e.target as HTMLElement).tagName.toLowerCase();
                if (tag !== 'textarea') { e.preventDefault(); handleNext(); }
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [handleNext, step, questions.length]);

    const q = step >= 0 && step < questions.length ? questions[step] : null;
    const isLight = textMode === 'light';
    const textPrimary = isLight ? 'text-white' : 'text-gray-900';
    const textSecondary = isLight ? 'text-white/70' : 'text-gray-500';
    const inputBorder = isLight ? 'border-white/30 text-white placeholder-white/40 focus:border-white' : 'border-gray-300 text-gray-900 placeholder-gray-400 focus:border-black';
    const optNormal = isLight ? 'bg-white/10 text-white border-white/20 hover:bg-white/20' : 'bg-white/60 text-gray-700 hover:bg-white border-gray-200 hover:border-gray-300';
    const letterNormal = isLight ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500';

    const bgStyle: React.CSSProperties = coverImage
        ? { backgroundImage: `url(${coverImage})`, backgroundSize: 'cover', backgroundPosition: bgPosition || 'center center' }
        : { backgroundColor: bgColor };

    const renderContent = () => {
        if (done) {
            return (
                <div className="text-center space-y-6 relative z-10 max-w-lg mx-auto">
                    <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto" style={{ backgroundColor: themeColor }}>
                        <Check className="w-12 h-12 text-white" />
                    </div>
                    <h1 className={`text-4xl font-bold ${textPrimary}`}>{endScreen.title}</h1>
                    <p className={`text-xl ${textSecondary}`}>{endScreen.message}</p>
                    {endScreen.buttonText && (
                        <button className="px-8 py-4 rounded-xl text-white font-bold text-lg transition-all hover:scale-105 mt-4 shadow-lg" style={{ backgroundColor: themeColor }}>
                            {endScreen.buttonText}
                        </button>
                    )}
                </div>
            );
        }
        if (step === -1) {
            return (
                <div className="w-full max-w-2xl">
                    <h1 className={`text-4xl md:text-5xl font-bold mb-6 ${textPrimary}`} style={{ color: isLight ? undefined : themeColor }}>{title}</h1>
                    {description && <p className={`text-xl md:text-2xl mb-12 leading-relaxed ${textSecondary}`}>{description}</p>}
                    <button onClick={handleNext} className="px-8 py-4 rounded-xl text-white font-bold text-lg transition-all hover:scale-105 active:scale-95 shadow-lg flex items-center gap-2"
                        style={{ backgroundColor: themeColor, boxShadow: `0 10px 25px -5px ${themeColor}60` }}>
                        Começar <span className="text-sm font-normal opacity-80 ml-2 hidden sm:inline">Pressione Enter ↵</span>
                    </button>
                    <div className={`mt-8 flex items-center gap-2 text-sm font-medium ${textSecondary}`}><Clipboard className="w-4 h-4" /> {questions.length} perguntas</div>
                </div>
            );
        }
        if (!q) return null;
        return (
            <div className="w-full max-w-2xl">
                <div className="flex items-center gap-4 mb-4">
                    <span className="text-xl md:text-2xl font-bold opacity-50" style={{ color: themeColor }}>{step + 1} &rarr;</span>
                    <h2 className={`text-2xl md:text-4xl font-bold leading-tight ${textPrimary}`}>{q.questionText}{q.isRequired && <span className="text-red-500 ml-2">*</span>}</h2>
                </div>
                {q.description && <p className={`text-lg mb-8 ml-10 leading-relaxed ${textSecondary}`}>{q.description}</p>}
                <div className="ml-10 mt-8 w-full max-w-2xl">
                    {q.type === 'short_text' && <input type="text" placeholder="Digite sua resposta aqui..." value={answers[step] || ''} onChange={e => setAnswers({ ...answers, [step]: e.target.value })} className={`w-full text-2xl bg-transparent border-b-2 ${inputBorder} p-2 pb-4 outline-none transition-colors`} autoFocus />}
                    {q.type === 'email' && <input type="email" placeholder="name@example.com" value={answers[step] || ''} onChange={e => setAnswers({ ...answers, [step]: e.target.value })} className={`w-full text-2xl bg-transparent border-b-2 ${inputBorder} p-2 pb-4 outline-none transition-colors`} autoFocus />}
                    {q.type === 'phone' && (() => {
                        const raw = answers[step] || '';
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
                                    onChange={e => setAnswers({ ...answers, [step]: formatPhone(e.target.value) })}
                                    className={`flex-1 text-2xl bg-transparent border-b-2 ${inputBorder} p-2 pb-4 outline-none transition-colors`} autoFocus />
                            </div>
                        );
                    })()}
                    {q.type === 'date' && (() => {
                        const parts = (answers[step] || '//').split('/');
                        const day = parts[0] || '';
                        const month = parts[1] || '';
                        const year = parts[2] || '';
                        const update = (d: string, m: string, y: string) => setAnswers({ ...answers, [step]: `${d}/${m}/${y}` });
                        return (
                            <div className="flex items-end gap-3">
                                <div className="flex flex-col">
                                    <span className={`text-sm font-medium mb-2 ${textSecondary}`}>Dia</span>
                                    <input type="text" inputMode="numeric" maxLength={2} placeholder="DD" value={day}
                                        onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 2); update(v, month, year); if (v.length === 2) (e.target.nextElementSibling?.nextElementSibling?.nextElementSibling as HTMLInputElement)?.focus?.(); }}
                                        className={`w-20 text-2xl bg-transparent border-b-2 ${inputBorder} p-2 pb-4 outline-none text-center transition-colors`} autoFocus />
                                </div>
                                <span className={`text-3xl font-light pb-4 ${textSecondary}`}>/</span>
                                <div className="flex flex-col">
                                    <span className={`text-sm font-medium mb-2 ${textSecondary}`}>Mês</span>
                                    <input type="text" inputMode="numeric" maxLength={2} placeholder="MM" value={month}
                                        onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 2); update(day, v, year); if (v.length === 2) (e.target.nextElementSibling?.nextElementSibling?.nextElementSibling as HTMLInputElement)?.focus?.(); }}
                                        className={`w-20 text-2xl bg-transparent border-b-2 ${inputBorder} p-2 pb-4 outline-none text-center transition-colors`} />
                                </div>
                                <span className={`text-3xl font-light pb-4 ${textSecondary}`}>/</span>
                                <div className="flex flex-col">
                                    <span className={`text-sm font-medium mb-2 ${textSecondary}`}>Ano</span>
                                    <input type="text" inputMode="numeric" maxLength={4} placeholder="AAAA" value={year}
                                        onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 4); update(day, month, v); }}
                                        className={`w-28 text-2xl bg-transparent border-b-2 ${inputBorder} p-2 pb-4 outline-none text-center transition-colors`} />
                                </div>
                            </div>
                        );
                    })()}
                    {q.type === 'long_text' && <textarea placeholder="Digite sua resposta detalhada aqui..." value={answers[step] || ''} onChange={e => setAnswers({ ...answers, [step]: e.target.value })} className={`w-full text-xl bg-transparent border-b-2 ${inputBorder} p-2 outline-none transition-colors min-h-[150px] resize-none`} autoFocus />}
                    {(q.type === 'single_choice' || q.type === 'multiple_choice') && (
                        <div className="space-y-3">
                            {q.options?.map((opt, idx) => {
                                const isMulti = q.type === 'multiple_choice';
                                const cur: string[] = isMulti ? (answers[step] || []) : [];
                                const sel = isMulti ? cur.includes(opt as string) : answers[step] === opt;
                                return (
                                    <button key={idx}
                                        onClick={() => {
                                            if (isMulti) { const n = sel ? cur.filter(a => a !== opt) : [...cur, opt as string]; setAnswers({ ...answers, [step]: n }); }
                                            else { setAnswers({ ...answers, [step]: opt }); setTimeout(handleNext, 400); }
                                        }}
                                        className={`w-full text-left px-6 py-4 rounded-xl border-2 transition-all text-lg font-medium flex items-center justify-between ${sel ? 'border-transparent shadow-md ring-2 ring-offset-2' : optNormal}`}
                                        style={sel ? { backgroundColor: themeColor + '15', color: themeColor, borderColor: themeColor } : {}}>
                                        <div className="flex items-center gap-4">
                                            <div className={`w-8 h-8 ${!isMulti ? 'rounded-full' : 'rounded-md'} flex items-center justify-center font-bold text-sm ${sel ? 'bg-white shadow-sm' : letterNormal}`} style={sel ? { color: themeColor } : {}}>
                                                {isMulti && sel ? <Check className="w-5 h-5" /> : String.fromCharCode(65 + idx)}
                                            </div>{opt}
                                        </div>
                                        {sel && !isMulti && <Check className="w-6 h-6" style={{ color: themeColor }} />}
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>
                <div className="ml-10 mt-8 flex items-center gap-4">
                    <button onClick={handleNext} className="px-6 py-3 rounded-xl text-white font-bold text-lg transition-all hover:opacity-90 active:scale-95 shadow-md flex items-center gap-2" style={{ backgroundColor: themeColor }}>
                        {step === questions.length - 1 ? 'Enviar Respostas' : <><span>OK</span> <Check className="w-5 h-5" /></>}
                    </button>
                    <span className={`text-sm hidden sm:inline ${textSecondary}`}>pressione <strong>Enter ↵</strong></span>
                </div>
            </div>
        );
    };

    return (
        <div className="absolute inset-0 z-50 flex flex-col bg-white overflow-hidden">
            <div className="p-4 border-b flex justify-between items-center bg-gray-50 shrink-0">
                <button onClick={onClose} className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium text-sm"><ArrowLeft className="w-4 h-4" /> Voltar ao Editor</button>
                <div className="font-medium text-sm text-gray-500">Modo de Visualização</div>
            </div>
            {!done && <div className="h-1.5 bg-gray-100 shrink-0"><div className="h-full transition-all duration-500 ease-out" style={{ width: `${Math.max(0, ((step + 1) / (questions.length + 1)) * 100)}%`, backgroundColor: themeColor }} /></div>}
            <div className="flex-1 flex flex-col items-center justify-center p-8 w-full relative" style={bgStyle}>
                {coverImage && <div className="absolute inset-0 bg-black/40" />}
                <div className="max-w-4xl w-full mx-auto relative z-10">{renderContent()}</div>
            </div>
            {step > -1 && !done && (
                <div className="absolute bottom-6 right-6 flex items-center gap-2 z-20">
                    <button onClick={handlePrev} disabled={step === 0} className="w-12 h-12 rounded-xl bg-gray-900 text-white flex items-center justify-center disabled:opacity-20 hover:bg-gray-800 transition-colors"><ChevronUp className="w-6 h-6" /></button>
                    <button onClick={handleNext} className="w-12 h-12 rounded-xl bg-gray-900 text-white flex items-center justify-center hover:bg-gray-800 transition-colors"><ChevronDown className="w-6 h-6" /></button>
                </div>
            )}
        </div>
    );
};

const MemoPreviewSimulation = React.memo(PreviewSimulation);

// ─── Main BriefingBuilder ──────────────────────────────────────────────────────
type SelectedView = { type: 'welcome' } | { type: 'question'; index: number } | { type: 'endscreen' };

interface BriefingBuilderProps {
    initialBriefing?: Briefing;
    onSave: (briefing: Partial<Briefing>, questions: Partial<BriefingQuestion>[]) => Promise<void>;
    onCancel: () => void;
}

const BriefingBuilder: React.FC<BriefingBuilderProps> = ({ initialBriefing, onSave, onCancel }) => {
    // Core state
    const [title, setTitle] = useState(initialBriefing?.title || 'Novo Formulário');
    const [slug, setSlug] = useState(initialBriefing?.slug || normalizeSlug(initialBriefing?.title || 'novo-formulario'));
    const [description, setDescription] = useState(initialBriefing?.description || '');
    const [themeColor, setThemeColor] = useState(initialBriefing?.themeColor || '#DFA653');
    const [bgColor, setBgColor] = useState(initialBriefing?.bgColor || '#f0f0f5');
    const [textColorMode, setTextColorMode] = useState<'auto' | 'light' | 'dark'>(initialBriefing?.textColor || 'auto');
    const [coverImage, setCoverImage] = useState(initialBriefing?.coverImage || '');
    const [bgPosition, setBgPosition] = useState(initialBriefing?.bgPosition || 'center center');
    const [endScreen, setEndScreen] = useState<EndScreen>(initialBriefing?.endScreen || { ...DEFAULT_END_SCREEN });
    const [questions, setQuestions] = useState<Partial<BriefingQuestion>[]>(initialBriefing?.questions || []);

    // UI state
    const [selectedView, setSelectedView] = useState<SelectedView>({ type: 'welcome' });
    const [isPreview, setIsPreview] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [leftTab, setLeftTab] = useState<'content' | 'design'>('content');
    const [isUploading, setIsUploading] = useState(false);
    const [dragIdx, setDragIdx] = useState<number | null>(null);
    const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
    const [showResponses, setShowResponses] = useState(false);

    const resolvedTextMode = getResolvedTextMode(textColorMode, bgColor, !!coverImage);
    const activeQIdx = selectedView.type === 'question' ? selectedView.index : null;
    const currentQuestion = useMemo(() => (
        activeQIdx !== null ? questions[activeQIdx] : null
    ), [activeQIdx, questions]);

    const handleTitleChange = useCallback((nextTitle: string) => {
        setSlug((currentSlug) => {
            const previousTitleSlug = normalizeSlug(title);
            return currentSlug === previousTitleSlug ? normalizeSlug(nextTitle) : currentSlug;
        });
        setTitle(nextTitle);
    }, [title]);

    // ── Handlers ──
    const handleAddQuestion = (type: QuestionType) => {
        const newQ: Partial<BriefingQuestion> = {
            type, questionText: 'Sua questão aqui.',
            options: (type === 'single_choice' || type === 'multiple_choice') ? ['Opção A', 'Opção B'] : [],
            isRequired: false, orderIndex: questions.length,
        };
        setQuestions(prev => [...prev, newQ]);
        setSelectedView({ type: 'question', index: questions.length });
    };

    const handleUpdateQuestion = (index: number, updates: Partial<BriefingQuestion>) => {
        setQuestions(prev => { const u = [...prev]; u[index] = { ...u[index], ...updates }; return u; });
    };

    const handleRemoveQuestion = (index: number) => {
        setQuestions(prev => prev.filter((_, i) => i !== index));
        setSelectedView({ type: 'welcome' });
    };

    // Drag-to-reorder
    const handleDragStart = (idx: number) => setDragIdx(idx);
    const handleDragOver = (e: React.DragEvent, idx: number) => { e.preventDefault(); setDragOverIdx(idx); };
    const handleDragEnd = () => { setDragIdx(null); setDragOverIdx(null); };
    const handleDrop = (targetIdx: number) => {
        if (dragIdx === null || dragIdx === targetIdx) { handleDragEnd(); return; }
        setQuestions(prev => {
            const items = [...prev];
            const [moved] = items.splice(dragIdx, 1);
            items.splice(targetIdx, 0, moved);
            return items;
        });
        if (selectedView.type === 'question') {
            setSelectedView({ type: 'question', index: targetIdx });
        }
        handleDragEnd();
    };

    const handleImageUpload = async () => {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = 'image/*';
        input.onchange = async (ev) => {
            const file = (ev.target as HTMLInputElement).files?.[0];
            if (!file) return;
            setIsUploading(true);
            const ext = file.name.split('.').pop();
            const path = `bg/${Date.now()}.${ext}`;
            const { error } = await supabase.storage.from('briefing-assets').upload(path, file, { upsert: true });
            if (error) { console.error('Upload error:', error); setIsUploading(false); return; }
            const { data: urlData } = supabase.storage.from('briefing-assets').getPublicUrl(path);
            setCoverImage(urlData.publicUrl);
            setIsUploading(false);
        };
        input.click();
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await onSave(
                { title, slug: normalizeSlug(slug || title), description, themeColor, bgColor, textColor: textColorMode, coverImage: coverImage || null, bgPosition, endScreen, status: 'active' } as any,
                questions
            );
        } finally { setIsSaving(false); }
    };

    const handleClosePreview = useCallback(() => {
        setIsPreview(false);
    }, []);

    // ── Preview mode ──
    // ── Responses mode ──
    // ── Computed styles ──
    const centerBgStyle = useMemo<React.CSSProperties>(() => (
        coverImage
            ? { backgroundImage: `url(${coverImage})`, backgroundSize: 'cover', backgroundPosition: bgPosition }
            : { backgroundColor: bgColor }
    ), [bgColor, bgPosition, coverImage]);
    const isLight = resolvedTextMode === 'light';
    const pText = isLight ? 'text-white' : 'text-gray-900';
    const pSub = isLight ? 'text-white/60' : 'text-gray-500';

    // ══════════════════════════════════════════════════════════════════════════════
    if (isPreview) {
        return <MemoPreviewSimulation title={title} description={description} themeColor={themeColor} bgColor={bgColor} textMode={resolvedTextMode} coverImage={coverImage || undefined} bgPosition={bgPosition} questions={questions} endScreen={endScreen} onClose={handleClosePreview} />;
    }

    if (showResponses && initialBriefing) {
        return <BriefingResponses briefing={initialBriefing} onBack={() => setShowResponses(false)} />;
    }

    return (
        <div className="h-full flex flex-col bg-gray-50 dark:bg-[#0a0a0a] absolute inset-0 z-40">
            {/* ── HEADER ── */}
            <div className="h-14 px-4 border-b border-gray-200 dark:border-white/5 flex items-center justify-between bg-white dark:bg-[#111] shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={onCancel} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 text-gray-500 transition-colors"><ArrowLeft className="w-4 h-4" /></button>
                    <div className="flex flex-col gap-1">
                        <input type="text" value={title} onChange={e => handleTitleChange(e.target.value)} className="text-base font-bold text-gray-900 dark:text-white bg-transparent border-none focus:ring-0 p-0 placeholder-gray-400 w-64" placeholder="Nome do Formulário" />
                        <div className="flex items-center gap-1 text-[11px] text-gray-400">
                            <span>/</span>
                            <input type="text" value={slug} onChange={e => setSlug(normalizeSlug(e.target.value))} className="w-64 bg-transparent border-none focus:ring-0 p-0 text-[11px] font-medium text-gray-500 dark:text-gray-400 placeholder-gray-500" placeholder="slug-do-formulario" />
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {initialBriefing && (
                        <button onClick={() => setShowResponses(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-white/5"><MessageSquareText className="w-3.5 h-3.5" /> Respostas</button>
                    )}
                    {initialBriefing ? (
                        <button onClick={() => {
                            const url = publicFormUrl({ id: initialBriefing.id, slug });
                            navigator.clipboard.writeText(url);
                            const btn = document.getElementById('copy-link-btn');
                            if (btn) { btn.textContent = 'Copiado!'; setTimeout(() => btn.textContent = 'Copiar Link', 1500); }
                        }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-white/5"><Link2 className="w-3.5 h-3.5" /><span id="copy-link-btn">Copiar Link</span></button>
                    ) : (
                        <button onClick={() => setIsPreview(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-white/5"><Eye className="w-3.5 h-3.5" /> Preview</button>
                    )}
                    <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-1.5 px-4 py-2 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50 hover:bg-gray-800 dark:hover:bg-gray-200">
                        {isSaving ? 'Salvando...' : 'Publicar Formulário'}
                    </button>
                </div>
            </div>

            {/* ── 3-COLUMN LAYOUT ── */}
            <div className="flex-1 flex overflow-hidden">

                {/* ═════════ LEFT SIDEBAR ═════════ */}
                <div className="w-[330px] bg-white dark:bg-[#111] border-r border-gray-200 dark:border-white/5 flex flex-col shrink-0">
                    <div className="flex border-b border-gray-100 dark:border-white/5">
                        <button onClick={() => setLeftTab('content')} className={`flex-1 py-2.5 text-xs font-bold text-center transition-colors ${leftTab === 'content' ? 'text-gray-900 dark:text-white border-b-2 border-gray-900 dark:border-white' : 'text-gray-400 hover:text-gray-600'}`}>Conteúdo</button>
                        <button onClick={() => setLeftTab('design')} className={`flex-1 py-2.5 text-xs font-bold text-center transition-colors ${leftTab === 'design' ? 'text-gray-900 dark:text-white border-b-2 border-gray-900 dark:border-white' : 'text-gray-400 hover:text-gray-600'}`}>Design</button>
                    </div>

                    {leftTab === 'content' ? (
                        <div className="flex-1 overflow-y-auto">
                            {/* Welcome */}
                            <div className="p-3 border-b border-gray-50 dark:border-white/5">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Tela de Boas Vindas</p>
                                <button onClick={() => setSelectedView({ type: 'welcome' })}
                                    className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl text-left transition-all text-xs font-medium ${selectedView.type === 'welcome' ? 'bg-gray-900 dark:bg-white text-white dark:text-black shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'}`}>
                                    <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: themeColor + '20', color: themeColor }}><Home className="w-3.5 h-3.5" /></div>
                                    <span className="truncate">{title || 'Boas Vindas'}</span>
                                </button>
                            </div>

                            {/* Questions */}
                            <div className="p-3">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Questões</p>
                                <div className="space-y-0.5">
                                    {questions.map((_q, idx) => (
                                        <div key={idx}
                                            draggable
                                            onDragStart={() => handleDragStart(idx)}
                                            onDragOver={(e) => handleDragOver(e, idx)}
                                            onDragEnd={handleDragEnd}
                                            onDrop={() => handleDrop(idx)}
                                            className={`relative ${dragOverIdx === idx && dragIdx !== idx ? 'pt-6' : ''}`}>
                                            {dragOverIdx === idx && dragIdx !== idx && (
                                                <div className="absolute top-0 left-2 right-2 h-0.5 rounded-full" style={{ backgroundColor: themeColor }} />
                                            )}
                                            <button onClick={() => setSelectedView({ type: 'question', index: idx })}
                                                className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl text-left transition-all text-xs font-medium cursor-grab active:cursor-grabbing
                                                    ${selectedView.type === 'question' && selectedView.index === idx ? 'bg-gray-900 dark:bg-white text-white dark:text-black shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'}
                                                    ${dragIdx === idx ? 'opacity-40' : ''}`}>
                                                <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${selectedView.type === 'question' && selectedView.index === idx ? 'bg-white/20 dark:bg-black/20' : 'bg-gray-100 dark:bg-white/10'}`}>
                                                    {QUESTION_TYPES.find(qt => qt.type === _q.type)?.icon || <Type className="w-3.5 h-3.5" />}
                                                </div>
                                                <span className="truncate flex-1">{_q.questionText || 'Sem título'}</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                {/* Add question buttons */}
                                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-white/5">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Adicionar questão</p>
                                    <div className="grid grid-cols-2 gap-1.5">
                                        {QUESTION_TYPES.map(qt => (
                                            <button key={qt.type} onClick={() => handleAddQuestion(qt.type)}
                                                className="flex flex-col items-center justify-center gap-1 p-2 bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                                                {qt.icon}<span className="text-[10px] font-medium">{qt.label}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* End Screen */}
                            <div className="p-3 border-t border-gray-50 dark:border-white/5">
                                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Tela Final</p>
                                <button onClick={() => setSelectedView({ type: 'endscreen' })}
                                    className={`w-full flex items-center gap-2.5 p-2.5 rounded-xl text-left transition-all text-xs font-medium ${selectedView.type === 'endscreen' ? 'bg-gray-900 dark:bg-white text-white dark:text-black shadow-sm' : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'}`}>
                                    <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: themeColor + '20', color: themeColor }}><Flag className="w-3.5 h-3.5" /></div>
                                    <span className="truncate">{endScreen.title}</span>
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* ── Design Tab ── */
                        <div className="flex-1 overflow-y-auto p-4 space-y-5">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2"><Palette className="w-3 h-3 inline mr-1" /> Cor dos Botões</label>
                                <div className="flex items-center gap-3">
                                    <input type="color" value={themeColor} onChange={e => setThemeColor(e.target.value)} className="w-8 h-8 rounded-lg border-0 cursor-pointer p-0" />
                                    <span className="text-[10px] text-gray-400 uppercase font-mono">{themeColor}</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {['#DFA653', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#1e293b'].map(c => (
                                        <button key={c} onClick={() => setThemeColor(c)} className={`w-5 h-5 rounded-full border transition-all hover:scale-110 ${themeColor === c ? 'ring-2 ring-offset-1 ring-gray-900 dark:ring-white' : 'border-gray-200 dark:border-white/10'}`} style={{ backgroundColor: c }} />
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2"><Palette className="w-3 h-3 inline mr-1" /> Cor de Fundo</label>
                                <div className="flex items-center gap-3">
                                    <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} className="w-8 h-8 rounded-lg border-0 cursor-pointer p-0" />
                                    <span className="text-[10px] text-gray-400 uppercase font-mono">{bgColor}</span>
                                </div>
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {['#f0f0f5', '#ffffff', '#1e293b', '#0f172a', '#0a0a0a', '#fef3c7', '#f0fdf4', '#eff6ff', '#fdf2f8'].map(c => (
                                        <button key={c} onClick={() => setBgColor(c)} className={`w-5 h-5 rounded-full border transition-all hover:scale-110 ${bgColor === c ? 'ring-2 ring-offset-1 ring-gray-900 dark:ring-white' : 'border-gray-200 dark:border-white/10'}`} style={{ backgroundColor: c }} />
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2"><Sun className="w-3 h-3 inline mr-1" /> Cor do Texto</label>
                                <div className="flex gap-1">
                                    {([
                                        { mode: 'auto' as const, label: 'Auto', icon: <Sparkles className="w-3 h-3" /> },
                                        { mode: 'light' as const, label: 'Claro', icon: <Sun className="w-3 h-3" /> },
                                        { mode: 'dark' as const, label: 'Escuro', icon: <Moon className="w-3 h-3" /> },
                                    ]).map(opt => (
                                        <button key={opt.mode} onClick={() => setTextColorMode(opt.mode)}
                                            className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-[10px] font-bold transition-all
                                                ${textColorMode === opt.mode ? 'bg-gray-900 dark:bg-white text-white dark:text-black shadow-sm' : 'bg-gray-100 dark:bg-white/5 text-gray-500 hover:text-gray-700'}`}>
                                            {opt.icon} {opt.label}
                                        </button>
                                    ))}
                                </div>
                                <p className="text-[9px] text-gray-400 mt-1.5 leading-relaxed">
                                    {textColorMode === 'auto' ? 'Detecta automaticamente se o fundo é claro ou escuro' : textColorMode === 'light' ? 'Texto branco, ideal para fundos escuros' : 'Texto escuro, ideal para fundos claros'}
                                </p>
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2"><Image className="w-3 h-3 inline mr-1" /> Imagem de Fundo</label>
                                <div className="space-y-2">
                                    <button onClick={handleImageUpload} className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl text-xs font-medium text-gray-500 hover:text-gray-700 hover:border-gray-400 dark:hover:text-white dark:hover:border-white/30 transition-all">
                                        {isUploading ? <><div className="w-3.5 h-3.5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /> Enviando...</> : <><Upload className="w-3.5 h-3.5" /> Upload de Imagem</>}
                                    </button>
                                    <div className="flex items-center gap-2"><div className="flex-1 h-px bg-gray-200 dark:bg-white/10" /><span className="text-[9px] text-gray-400 font-bold">OU</span><div className="flex-1 h-px bg-gray-200 dark:bg-white/10" /></div>
                                    <input type="text" value={coverImage} onChange={e => setCoverImage(e.target.value)} placeholder="Cole a URL aqui..."
                                        className="w-full text-[11px] bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg p-2 dark:text-white transition-all" />
                                    {coverImage && (
                                        <div className="relative rounded-lg overflow-hidden h-20">
                                            <img src={coverImage} alt="" className="w-full h-full object-cover" style={{ objectPosition: bgPosition }} />
                                            <button onClick={() => setCoverImage('')} className="absolute top-1 right-1 w-5 h-5 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center transition-colors"><X className="w-3 h-3" /></button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {coverImage && (
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Posição da Imagem</label>
                                    <div className="grid grid-cols-3 gap-1 w-20 mx-auto">
                                        {BG_POSITIONS.map(pos => (
                                            <button key={pos.value} onClick={() => setBgPosition(pos.value)}
                                                className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold transition-all
                                                    ${bgPosition === pos.value ? 'bg-gray-900 dark:bg-white text-white dark:text-black' : 'bg-gray-100 dark:bg-white/10 text-gray-400 hover:bg-gray-200 dark:hover:bg-white/20'}`}>
                                                {pos.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ═════════ CENTER — WYSIWYG ═════════ */}
                <div className="flex-1 relative overflow-hidden">
                    <div className="absolute inset-0 transition-all duration-300" style={centerBgStyle}>
                        {coverImage && <div className="absolute inset-0 bg-black/40" />}
                    </div>
                    <div className="relative z-10 h-full flex flex-col items-center justify-center p-8 overflow-y-auto">

                        {/* Welcome */}
                        {selectedView.type === 'welcome' && (
                            <div className="w-full max-w-2xl">
                                <input type="text" value={title} onChange={e => handleTitleChange(e.target.value)}
                                    className={`w-full text-4xl md:text-5xl font-bold bg-transparent border-none focus:ring-0 p-0 mb-4 outline-none placeholder-gray-300 ${pText}`}
                                    style={!isLight ? { color: themeColor } : {}} placeholder="Título do seu formulário" />
                                <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Descrição opcional. Explique o objetivo deste formulário."
                                    className={`w-full text-xl md:text-2xl bg-transparent border-none focus:ring-0 p-0 mb-12 leading-relaxed resize-none outline-none placeholder-gray-300/50 ${pSub}`} rows={3} />
                                <div className="px-8 py-4 rounded-xl text-white font-bold text-lg inline-flex items-center gap-2 shadow-lg opacity-80 cursor-default" style={{ backgroundColor: themeColor, boxShadow: `0 10px 25px -5px ${themeColor}60` }}>
                                    Começar <span className="text-sm font-normal opacity-60 ml-2">Pressione Enter ↵</span>
                                </div>
                                <div className={`mt-8 flex items-center gap-2 text-sm font-medium ${pSub}`}><Clipboard className="w-4 h-4" /> {questions.length} perguntas</div>
                            </div>
                        )}

                        {/* Question editor */}
                        {selectedView.type === 'question' && questions[selectedView.index] && (() => {
                            const qIdx = selectedView.index;
                            const q = questions[qIdx];
                            return (
                                <div className="w-full max-w-2xl">
                                    <div className="flex items-start gap-4 mb-4">
                                        <span className="text-xl md:text-2xl font-bold opacity-50 mt-1" style={{ color: themeColor }}>{qIdx + 1} &rarr;</span>
                                        <input type="text" value={q.questionText || ''} onChange={e => handleUpdateQuestion(qIdx, { questionText: e.target.value })}
                                            className={`flex-1 text-2xl md:text-4xl font-bold bg-transparent border-none focus:ring-0 p-0 outline-none leading-tight ${pText}`} placeholder="Sua questão aqui." />
                                    </div>
                                    <div className="ml-10 md:ml-12 mb-8">
                                        <input type="text" value={q.description || ''} onChange={e => handleUpdateQuestion(qIdx, { description: e.target.value })} placeholder="Descrição (opcional)"
                                            className={`w-full text-lg bg-transparent border-none focus:ring-0 p-0 outline-none leading-relaxed ${pSub} placeholder-gray-300/40`} />
                                    </div>
                                    <div className="ml-10 md:ml-12 w-full max-w-lg">
                                        {q.type === 'short_text' && <div className={`w-full h-12 border-b-2 ${isLight ? 'border-white/30' : 'border-gray-300'} opacity-50`} />}
                                        {q.type === 'long_text' && <div className={`w-full h-28 border-2 border-dashed rounded-xl ${isLight ? 'border-white/20' : 'border-gray-200'} opacity-40`} />}
                                        {(q.type === 'single_choice' || q.type === 'multiple_choice') && (
                                            <div className="space-y-2.5">
                                                {q.options?.map((opt, oi) => (
                                                    <div key={oi} className={`flex items-center gap-3 px-5 py-3.5 rounded-xl border-2 transition-all group ${isLight ? 'border-white/20 bg-white/10' : 'border-gray-200 bg-white/60'}`}>
                                                        <div className={`w-7 h-7 ${q.type === 'single_choice' ? 'rounded-full' : 'rounded-md'} border-2 flex items-center justify-center font-bold text-xs shrink-0 ${isLight ? 'border-white/40 text-white/60' : 'border-gray-300 text-gray-400'}`}>{String.fromCharCode(65 + oi)}</div>
                                                        <input type="text" value={opt} onChange={e => { const o = [...(q.options || [])]; o[oi] = e.target.value; handleUpdateQuestion(qIdx, { options: o }); }}
                                                            className={`flex-1 bg-transparent border-none focus:ring-0 p-0 text-base font-medium outline-none ${isLight ? 'text-white placeholder-white/40' : 'text-gray-700 placeholder-gray-400'}`} placeholder={`Opção ${oi + 1}`} />
                                                        <button onClick={() => { const o = [...(q.options || [])]; o.splice(oi, 1); handleUpdateQuestion(qIdx, { options: o }); }}
                                                            className={`opacity-0 group-hover:opacity-100 p-1 rounded transition-all ${isLight ? 'text-white/40 hover:text-white' : 'text-gray-300 hover:text-red-500'}`}><X className="w-3.5 h-3.5" /></button>
                                                    </div>
                                                ))}
                                                <button onClick={() => handleUpdateQuestion(qIdx, { options: [...(q.options || []), `Opção ${(q.options?.length || 0) + 1}`] })}
                                                    className={`flex items-center gap-1.5 text-sm font-medium mt-2 transition-colors ${isLight ? 'text-white/50 hover:text-white' : 'text-gray-400 hover:text-gray-700'}`}>
                                                    <Plus className="w-3.5 h-3.5" /> Adicionar escolha
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="ml-10 md:ml-12 mt-8">
                                        <div className="px-6 py-3 rounded-xl text-white font-bold text-base inline-flex items-center gap-2 shadow-md opacity-80 cursor-default" style={{ backgroundColor: themeColor }}>OK <Check className="w-5 h-5" /></div>
                                        <span className={`text-xs ml-3 ${pSub}`}>pressione <strong>Enter ↵</strong></span>
                                    </div>
                                </div>
                            );
                        })()}

                        {/* End Screen editor */}
                        {selectedView.type === 'endscreen' && (
                            <div className="text-center space-y-6 max-w-lg mx-auto">
                                <div className="w-24 h-24 rounded-full flex items-center justify-center mx-auto" style={{ backgroundColor: themeColor }}>
                                    <Check className="w-12 h-12 text-white" />
                                </div>
                                <input type="text" value={endScreen.title} onChange={e => setEndScreen({ ...endScreen, title: e.target.value })}
                                    className={`w-full text-center text-4xl font-bold bg-transparent border-none focus:ring-0 p-0 outline-none ${pText}`} placeholder="Título da tela final" />
                                <textarea value={endScreen.message} onChange={e => setEndScreen({ ...endScreen, message: e.target.value })}
                                    className={`w-full text-center text-xl bg-transparent border-none focus:ring-0 p-0 outline-none resize-none leading-relaxed ${pSub}`} rows={2} placeholder="Mensagem de conclusão" />
                                {endScreen.buttonText && (
                                    <div className="px-8 py-4 rounded-xl text-white font-bold text-lg inline-flex items-center gap-2 shadow-lg cursor-default" style={{ backgroundColor: themeColor }}>
                                        {endScreen.buttonText}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* ═════════ RIGHT SIDEBAR ═════════ */}
                <div className="w-[330px] bg-white dark:bg-[#111] border-l border-gray-200 dark:border-white/5 flex flex-col shrink-0 overflow-y-auto">

                    {/* ── Welcome config ── */}
                    {selectedView.type === 'welcome' && (
                        <div className="p-5 space-y-5">
                            <h3 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-1.5"><Home className="w-4 h-4 text-gray-400" /> Tela de Boas-Vindas</h3>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Título</label>
                                <input type="text" value={title} onChange={e => handleTitleChange(e.target.value)} className="w-full text-xs bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg p-2.5 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Descrição</label>
                                <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full text-xs bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg p-2.5 dark:text-white resize-none" rows={4} placeholder="Descrição para os visitantes" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Texto do Botão</label>
                                <input type="text" value="Começar" disabled className="w-full text-xs bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg p-2.5 text-gray-400 cursor-not-allowed" />
                            </div>
                        </div>
                    )}

                    {/* ── Question config ── */}
                    {selectedView.type === 'question' && activeQIdx !== null && currentQuestion && (
                        <div className="p-5 space-y-5">
                            <div className="flex items-center justify-between">
                                <h3 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-1.5"><Settings2 className="w-4 h-4 text-gray-400" /> Questão {activeQIdx + 1}</h3>
                                <button onClick={() => handleRemoveQuestion(activeQIdx)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                            </div>
                            <div className="relative">
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Tipo</label>
                                <button type="button"
                                    onClick={() => {
                                        const el = document.getElementById('type-dropdown');
                                        if (el) el.classList.toggle('hidden');
                                    }}
                                    className="w-full flex items-center justify-between text-xs bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg p-2.5 font-medium text-gray-700 dark:text-gray-300 hover:border-gray-300 dark:hover:border-white/20 transition-colors">
                                    <span className="flex items-center gap-2">
                                        <span className="w-5 h-5 rounded flex items-center justify-center" style={{ backgroundColor: themeColor + '15', color: themeColor }}>
                                            {QUESTION_TYPES.find(qt => qt.type === currentQuestion.type)?.icon}
                                        </span>
                                        {QUESTION_TYPES.find(qt => qt.type === currentQuestion.type)?.label}
                                    </span>
                                    <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                                </button>
                                <div id="type-dropdown" className="hidden absolute top-full left-0 right-0 mt-1 bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-white/10 rounded-xl shadow-xl py-1 z-50 max-h-64 overflow-y-auto">
                                    {QUESTION_TYPES.map(qt => (
                                        <button key={qt.type} type="button"
                                            onClick={() => {
                                                const u: Partial<BriefingQuestion> = { type: qt.type };
                                                if ((qt.type === 'single_choice' || qt.type === 'multiple_choice') && (!currentQuestion.options || currentQuestion.options.length === 0)) u.options = ['Opção A', 'Opção B'];
                                                handleUpdateQuestion(activeQIdx, u);
                                                document.getElementById('type-dropdown')?.classList.add('hidden');
                                            }}
                                            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors
                                                ${currentQuestion.type === qt.type
                                                    ? 'text-gray-900 dark:text-white bg-gray-50 dark:bg-white/5'
                                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-white/5'}`}>
                                            <span className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                                                style={currentQuestion.type === qt.type ? { backgroundColor: themeColor + '15', color: themeColor } : {}}>
                                                {qt.icon}
                                            </span>
                                            <span className="flex-1 text-left">{qt.label}</span>
                                            {currentQuestion.type === qt.type && <Check className="w-3.5 h-3.5" style={{ color: themeColor }} />}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="flex items-center justify-between cursor-pointer">
                                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Obrigatória</span>
                                    <div className="relative inline-block w-9 h-5">
                                        <input type="checkbox" className="peer sr-only" checked={currentQuestion.isRequired} onChange={e => handleUpdateQuestion(activeQIdx, { isRequired: e.target.checked })} />
                                        <div className="block w-9 h-5 bg-gray-200 dark:bg-gray-700 rounded-full peer-checked:bg-green-500 transition-colors" />
                                        <div className="absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full transition-transform peer-checked:translate-x-4 shadow-sm" />
                                    </div>
                                </label>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Subtítulo / Descrição</label>
                                <textarea value={currentQuestion.description || ''} onChange={e => handleUpdateQuestion(activeQIdx, { description: e.target.value })}
                                    className="w-full text-xs bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg p-2.5 dark:text-white transition-all resize-none" placeholder="Explique melhor esta pergunta..." rows={3} />
                            </div>
                            {(currentQuestion.type === 'single_choice' || currentQuestion.type === 'multiple_choice') && (
                                <div>
                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Opções</label>
                                    <div className="space-y-1.5">
                                        {currentQuestion.options?.map((opt, oi) => (
                                            <div key={oi} className="flex items-center gap-2">
                                                <span className="text-[10px] font-bold text-gray-400 w-4 text-center">{String.fromCharCode(65 + oi)}</span>
                                                <input type="text" value={opt} onChange={e => { const o = [...(currentQuestion.options || [])]; o[oi] = e.target.value; handleUpdateQuestion(activeQIdx, { options: o }); }}
                                                    className="flex-1 text-xs bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg p-2 dark:text-white" />
                                                <button onClick={() => { const o = [...(currentQuestion.options || [])]; o.splice(oi, 1); handleUpdateQuestion(activeQIdx, { options: o }); }} className="text-gray-300 hover:text-red-500 transition-colors"><X className="w-3.5 h-3.5" /></button>
                                            </div>
                                        ))}
                                        <button onClick={() => handleUpdateQuestion(activeQIdx, { options: [...(currentQuestion.options || []), `Opção ${(currentQuestion.options?.length || 0) + 1}`] })}
                                            className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-white font-medium flex items-center gap-1 mt-1 transition-colors"><Plus className="w-3 h-3" /> Adicionar</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ── End Screen config ── */}
                    {selectedView.type === 'endscreen' && (
                        <div className="p-5 space-y-5">
                            <h3 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-1.5"><Flag className="w-4 h-4 text-gray-400" /> Tela Final</h3>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Título</label>
                                <input type="text" value={endScreen.title} onChange={e => setEndScreen({ ...endScreen, title: e.target.value })}
                                    className="w-full text-xs bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg p-2.5 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Mensagem</label>
                                <textarea value={endScreen.message} onChange={e => setEndScreen({ ...endScreen, message: e.target.value })}
                                    className="w-full text-xs bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg p-2.5 dark:text-white resize-none" rows={3} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Botão de Ação</label>
                                <input type="text" value={endScreen.buttonText || ''} onChange={e => setEndScreen({ ...endScreen, buttonText: e.target.value })}
                                    className="w-full text-xs bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg p-2.5 dark:text-white mb-2" placeholder="Ex: Voltar ao site" />
                                {endScreen.buttonText && (
                                    <div>
                                        <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5"><Link2 className="w-3 h-3 inline mr-1" /> URL do Botão</label>
                                        <input type="text" value={endScreen.buttonUrl || ''} onChange={e => setEndScreen({ ...endScreen, buttonUrl: e.target.value })}
                                            className="w-full text-xs bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg p-2.5 dark:text-white" placeholder="https://..." />
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="flex items-center justify-between cursor-pointer">
                                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Confetti ao concluir</span>
                                    <div className="relative inline-block w-9 h-5">
                                        <input type="checkbox" className="peer sr-only" checked={endScreen.showConfetti} onChange={e => setEndScreen({ ...endScreen, showConfetti: e.target.checked })} />
                                        <div className="block w-9 h-5 bg-gray-200 dark:bg-gray-700 rounded-full peer-checked:bg-green-500 transition-colors" />
                                        <div className="absolute left-0.5 top-0.5 bg-white w-4 h-4 rounded-full transition-transform peer-checked:translate-x-4 shadow-sm" />
                                    </div>
                                </label>
                            </div>
                            <div className="border-t border-gray-100 dark:border-white/5 pt-4">
                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5"><ExternalLink className="w-3 h-3 inline mr-1" /> Redirecionar após envio</label>
                                <input type="text" value={endScreen.redirectUrl || ''} onChange={e => setEndScreen({ ...endScreen, redirectUrl: e.target.value })}
                                    className="w-full text-xs bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg p-2.5 dark:text-white" placeholder="https://seusite.com.br" />
                                <p className="text-[10px] text-gray-400 mt-1.5">Se preenchido, o lead será redirecionado automaticamente após enviar o formulário.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BriefingBuilder;
