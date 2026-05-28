import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/shared/lib/supabase';
import { Briefing, BriefingQuestion, BriefingResponse } from '@/shared/types';
import {
    ArrowLeft, Inbox, Clock, CheckCircle2, ChevronRight,
    Type, AlignLeft, CheckSquare, List, FileText, Calendar,
    Hash, Mail, Phone, CalendarDays, Download, Search, FileSpreadsheet,
    Table2, Copy, ChevronDown, Check
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
type ResponseStatusFilter = 'all' | 'completed' | 'disqualified' | 'pending';
type DateRangeFilter = 'all' | 'today' | '7d' | '30d';

interface FilterOption<T extends string> {
    value: T;
    label: string;
}

interface ExportRow {
    response: BriefingResponse;
    values: string[];
    searchableText: string;
}

const STATUS_FILTER_OPTIONS: FilterOption<ResponseStatusFilter>[] = [
    { value: 'all', label: 'Todos status' },
    { value: 'completed', label: 'Concluidas' },
    { value: 'disqualified', label: 'Nao qualificadas' },
    { value: 'pending', label: 'Pendentes' },
];

const DATE_RANGE_OPTIONS: FilterOption<DateRangeFilter>[] = [
    { value: 'all', label: 'Todo periodo' },
    { value: 'today', label: 'Hoje' },
    { value: '7d', label: '7 dias' },
    { value: '30d', label: '30 dias' },
];

const STATUS_LABELS: Record<string, string> = {
    completed: 'Concluida',
    disqualified: 'Nao qualificada',
    pending: 'Pendente',
    reviewed: 'Revisada',
    new: 'Nova',
};

function valueToText(value: unknown): string {
    if (value === undefined || value === null) return '';
    if (Array.isArray(value)) return value.map(valueToText).filter(Boolean).join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
}

function sanitizeFilename(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '')
        .slice(0, 80) || 'formulario';
}

function escapeCsvCell(value: string): string {
    const escaped = value.replace(/"/g, '""');
    return /[";\n\r]/.test(escaped) ? `"${escaped}"` : escaped;
}

function escapeHtmlCell(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function downloadBlob(content: string, filename: string, type: string): void {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function isWithinRange(date: string, range: DateRangeFilter): boolean {
    if (range === 'all') return true;
    const submitted = new Date(date).getTime();
    const now = new Date();

    if (range === 'today') {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        return submitted >= start;
    }

    const days = range === '7d' ? 7 : 30;
    return submitted >= Date.now() - days * 24 * 60 * 60 * 1000;
}

interface FilterDropdownProps<T extends string> {
    active: boolean;
    options: FilterOption<T>[];
    value: T;
    onChange: (value: T) => void;
    onToggle: () => void;
    onClose: () => void;
}

function FilterDropdown<T extends string>({
    active,
    options,
    value,
    onChange,
    onToggle,
    onClose,
}: FilterDropdownProps<T>) {
    const selected = options.find((option) => option.value === value) || options[0];

    return (
        <div className="relative min-w-0">
            <button
                type="button"
                onClick={onToggle}
                className={`h-10 w-full min-w-0 px-3 rounded-xl border text-left flex items-center justify-between gap-2 transition-all
                    ${active
                        ? 'bg-[#101010] border-[#DFA653]/70 shadow-[0_0_0_3px_rgba(223,166,83,0.12)]'
                        : 'bg-black/30 border-white/10 hover:border-[#DFA653]/50 hover:bg-black/40'}`}
            >
                <span className="text-xs font-semibold text-white truncate">{selected.label}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform ${active ? 'rotate-180 text-[#DFA653]' : ''}`} />
            </button>

            {active && (
                <>
                    <button type="button" className="fixed inset-0 z-[55] cursor-default" onClick={onClose} aria-label="Fechar filtro" />
                    <div className="absolute left-0 right-0 top-12 z-[65] overflow-hidden rounded-xl border border-white/10 bg-[#171717] shadow-2xl shadow-black/40 p-1">
                        {options.map((option) => {
                            const isSelected = option.value === value;
                            return (
                                <button
                                    key={option.value}
                                    type="button"
                                    onClick={() => {
                                        onChange(option.value);
                                        onClose();
                                    }}
                                    className={`w-full min-h-9 px-2.5 py-2 rounded-lg flex items-center justify-between gap-2 text-left transition-colors
                                        ${isSelected ? 'bg-[#DFA653]/15 text-[#DFA653]' : 'text-gray-300 hover:bg-white/5 hover:text-white'}`}
                                >
                                    <span className="text-xs font-medium leading-tight">{option.label}</span>
                                    {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                                </button>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}

interface BriefingResponsesProps {
    briefing: Briefing;
    onBack: () => void;
}

const BriefingResponses: React.FC<BriefingResponsesProps> = ({ briefing, onBack }) => {
    const [responses, setResponses] = useState<BriefingResponse[]>([]);
    const [questions, setQuestions] = useState<BriefingQuestion[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<ResponseStatusFilter>('all');
    const [dateRange, setDateRange] = useState<DateRangeFilter>('all');
    const [isExportOpen, setIsExportOpen] = useState(false);
    const [exportFeedback, setExportFeedback] = useState('');
    const [openFilter, setOpenFilter] = useState<'status' | 'date' | null>(null);

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
                contact: r.contact || {},
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

    const exportHeaders = useMemo(() => [
        'ID da resposta',
        'Enviado em',
        'Status',
        'Nome',
        'WhatsApp',
        'E-mail',
        'Empresa',
        ...questions.map((question, index) => `${index + 1}. ${question.questionText}`),
    ], [questions]);
    const themeColor = briefing.themeColor || '#DFA653';
    const answeredCount = (r: BriefingResponse) => Object.keys(r.answers || {}).length;

    const exportRows = useMemo<ExportRow[]>(() => responses.map((response) => {
        const contact = response.contact || {};
        const values = [
            response.id,
            `${formatDate(response.submittedAt)} ${formatTime(response.submittedAt)}`,
            STATUS_LABELS[String(response.status)] || String(response.status),
            valueToText(contact.name),
            valueToText(contact.whatsapp),
            valueToText(contact.email),
            valueToText(contact.company),
            ...questions.map((question) => {
                const contactField = question.settings?.contactField;
                if (typeof contactField === 'string' && contact[contactField]) return valueToText(contact[contactField]);
                return valueToText(response.answers?.[question.id]);
            }),
        ];

        return {
            response,
            values,
            searchableText: values.join(' ').toLowerCase(),
        };
    }), [questions, responses]);

    const filteredRows = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        return exportRows.filter((row) => {
            const status = String(row.response.status);
            const matchesStatus = statusFilter === 'all'
                || (statusFilter === 'pending' && status !== 'completed' && status !== 'disqualified')
                || status === statusFilter;
            return matchesStatus && isWithinRange(row.response.submittedAt, dateRange) && (!term || row.searchableText.includes(term));
        });
    }, [dateRange, exportRows, searchTerm, statusFilter]);

    const filteredResponses = useMemo(() => filteredRows.map((row) => row.response), [filteredRows]);
    const selectedResponse = filteredResponses.find(r => r.id === selectedId);
    const hasExportRows = filteredRows.length > 0;
    const baseFilename = `respostas-${sanitizeFilename(briefing.slug || briefing.title)}-${new Date().toISOString().slice(0, 10)}`;

    useEffect(() => {
        if (filteredResponses.length === 0) {
            if (selectedId !== null) setSelectedId(null);
            return;
        }
        if (!selectedId || !filteredResponses.some((response) => response.id === selectedId)) {
            setSelectedId(filteredResponses[0].id);
        }
    }, [filteredResponses, selectedId]);

    const buildDelimited = useCallback((delimiter: string) => [
        exportHeaders.map(escapeCsvCell).join(delimiter),
        ...filteredRows.map((row) => row.values.map(escapeCsvCell).join(delimiter)),
    ].join('\r\n'), [exportHeaders, filteredRows]);

    const handleExportCsv = useCallback(() => {
        if (!hasExportRows) return;
        downloadBlob(`\uFEFF${buildDelimited(';')}`, `${baseFilename}.csv`, 'text/csv;charset=utf-8');
        setExportFeedback('CSV gerado');
        setIsExportOpen(false);
    }, [baseFilename, buildDelimited, hasExportRows]);

    const handleExportXls = useCallback(() => {
        if (!hasExportRows) return;
        const rows = [exportHeaders, ...filteredRows.map((row) => row.values)];
        const table = rows
            .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtmlCell(cell)}</td>`).join('')}</tr>`)
            .join('');
        const html = `<html><head><meta charset="utf-8" /></head><body><table>${table}</table></body></html>`;
        downloadBlob(html, `${baseFilename}.xls`, 'application/vnd.ms-excel;charset=utf-8');
        setExportFeedback('Excel gerado');
        setIsExportOpen(false);
    }, [baseFilename, exportHeaders, filteredRows, hasExportRows]);

    const handleCopyTable = useCallback(async () => {
        if (!hasExportRows) return;
        await navigator.clipboard.writeText(buildDelimited('\t'));
        setExportFeedback('Tabela copiada');
        setIsExportOpen(false);
    }, [buildDelimited, hasExportRows]);

    useEffect(() => {
        if (!exportFeedback) return;
        const timer = window.setTimeout(() => setExportFeedback(''), 1800);
        return () => window.clearTimeout(timer);
    }, [exportFeedback]);

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
                    {exportFeedback && (
                        <span className="hidden sm:inline text-xs font-semibold text-emerald-500">{exportFeedback}</span>
                    )}
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 dark:bg-white/5 rounded-lg">
                        <FileText className="w-3.5 h-3.5 text-gray-400" />
                        <span className="text-xs font-bold text-gray-600 dark:text-gray-300">{filteredRows.length}</span>
                        <span className="text-xs text-gray-400">de {responses.length}</span>
                    </div>
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setIsExportOpen((open) => !open)}
                            disabled={!hasExportRows || loading}
                            className="h-9 px-3 rounded-lg bg-white dark:bg-white text-gray-900 border border-gray-200 dark:border-transparent text-xs font-bold flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <Download className="w-4 h-4" />
                            Exportar
                            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                        </button>
                        {isExportOpen && (
                            <>
                                <button type="button" className="fixed inset-0 z-[80] cursor-default" onClick={() => setIsExportOpen(false)} aria-label="Fechar exportacao" />
                                <div className="absolute right-0 top-11 z-[90] w-64 rounded-xl border border-white/10 bg-[#171717] shadow-2xl p-2">
                                    <div className="px-3 py-2 border-b border-white/5">
                                        <p className="text-xs font-bold text-white">Exportar {filteredRows.length} respostas</p>
                                        <p className="text-[11px] text-gray-500">Respeita busca, status e periodo.</p>
                                    </div>
                                    <button type="button" onClick={handleExportCsv} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-200 hover:bg-white/5 rounded-lg transition-colors">
                                        <FileSpreadsheet className="w-4 h-4 text-[#DFA653]" />
                                        CSV para Excel
                                    </button>
                                    <button type="button" onClick={handleExportXls} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-200 hover:bg-white/5 rounded-lg transition-colors">
                                        <Table2 className="w-4 h-4 text-[#DFA653]" />
                                        Excel .xls
                                    </button>
                                    <button type="button" onClick={handleCopyTable} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-200 hover:bg-white/5 rounded-lg transition-colors">
                                        <Copy className="w-4 h-4 text-[#DFA653]" />
                                        Copiar tabela
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* ── Body ── */}
            <div className="flex-1 flex overflow-hidden">

                {/* ═══ Left: Responses List ═══ */}
                <div className="w-[330px] bg-white dark:bg-[#111] border-r border-gray-200 dark:border-white/5 flex flex-col shrink-0">
                    <div className="p-3 border-b border-gray-100 dark:border-white/5 space-y-3">
                        <div className="flex items-center justify-between">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                                {loading ? 'Carregando...' : `${filteredRows.length} respostas`}
                            </p>
                            {!loading && responses.length > 0 && filteredRows.length !== responses.length && (
                                <button type="button" onClick={() => { setSearchTerm(''); setStatusFilter('all'); setDateRange('all'); }} className="text-[11px] font-semibold text-[#DFA653] hover:text-white transition-colors">
                                    Limpar
                                </button>
                            )}
                        </div>

                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                                placeholder="Buscar por nome, email, resposta..."
                                className="w-full h-9 pl-8 pr-3 rounded-lg bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/10 text-xs text-gray-900 dark:text-white placeholder-gray-500 outline-none focus:border-[#DFA653] transition-colors"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <FilterDropdown
                                active={openFilter === 'status'}
                                options={STATUS_FILTER_OPTIONS}
                                value={statusFilter}
                                onChange={setStatusFilter}
                                onToggle={() => setOpenFilter((current) => current === 'status' ? null : 'status')}
                                onClose={() => setOpenFilter(null)}
                            />
                            <FilterDropdown
                                active={openFilter === 'date'}
                                options={DATE_RANGE_OPTIONS}
                                value={dateRange}
                                onChange={setDateRange}
                                onToggle={() => setOpenFilter((current) => current === 'date' ? null : 'date')}
                                onClose={() => setOpenFilter(null)}
                            />
                        </div>
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
                        ) : filteredResponses.length === 0 ? (
                            <div className="p-8 flex flex-col items-center justify-center gap-3 text-center">
                                <div className="w-14 h-14 bg-gray-50 dark:bg-white/5 rounded-2xl flex items-center justify-center">
                                    <Search className="w-7 h-7 text-gray-300 dark:text-gray-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">Nada nesse filtro</p>
                                    <p className="text-xs text-gray-400 mt-1">Ajuste a busca, o status ou o periodo.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="p-2 space-y-0.5">
                                {filteredResponses.map((r, idx) => {
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
                                                    <span className="text-xs font-bold">Resposta {filteredResponses.length - idx}</span>
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
                                        Resposta #{filteredResponses.length - filteredResponses.findIndex(r => r.id === selectedId)}
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
