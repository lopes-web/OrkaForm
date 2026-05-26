import React, { useState, useMemo, useDeferredValue, useCallback, memo } from 'react';
import { useBriefingsCRUD } from '../hooks/useBriefingsCRUD';
import { ClipboardList, Plus, Search, MoreVertical, LayoutTemplate, Edit3, Trash2, Link2, ExternalLink, MessageSquareText } from 'lucide-react';
import LoadingScreen from '@/shared/components/LoadingScreen';
import BriefingBuilder from './BriefingBuilder';
import BriefingResponses from './BriefingResponses';
import { Briefing, BriefingQuestion } from '@/shared/types';
import { publicFormUrl } from '../lib/formUrls';

interface BriefingsPanelProps {
    currentTeamId?: string;
    currentUserId?: string;
}

type PanelView = 'list' | 'builder' | 'responses';

interface BriefingCardProps {
    briefing: Briefing;
    isMenuOpen: boolean;
    menuPos: { top: number; left: number };
    onOpenBuilder: (briefing: Briefing) => void;
    onToggleMenu: (briefing: Briefing, target: HTMLElement) => void;
    onOpenResponses: (briefing: Briefing) => void;
    onCopyLink: (briefing: Briefing) => void;
    onOpenExternal: (briefing: Briefing) => void;
    onDelete: (briefing: Briefing) => void;
    onCloseMenu: () => void;
}

const BriefingCard = memo(({
    briefing,
    isMenuOpen,
    menuPos,
    onOpenBuilder,
    onToggleMenu,
    onOpenResponses,
    onCopyLink,
    onOpenExternal,
    onDelete,
    onCloseMenu,
}: BriefingCardProps) => (
    <div
        onClick={() => onOpenBuilder(briefing)}
        className="group flex flex-col bg-white dark:bg-[#1A1A1A] border border-gray-100 dark:border-white/5 rounded-2xl hover:shadow-lg hover:shadow-gray-200/50 dark:hover:shadow-black/50 transition-all cursor-pointer relative"
    >
        <div
            className="h-32 w-full relative rounded-t-2xl overflow-hidden"
            style={{ backgroundColor: briefing.themeColor || '#DFA653' }}
        >
            {briefing.coverImage && (
                <img src={briefing.coverImage} className="w-full h-full object-cover mix-blend-overlay opacity-50" alt="" />
            )}
            <div className="absolute top-3 right-3 flex items-center gap-2">
                {briefing.status === 'draft' && (
                    <span className="px-2.5 py-1 bg-white/20 backdrop-blur-md text-white border border-white/20 rounded-full text-[10px] font-bold uppercase tracking-wider">
                        Rascunho
                    </span>
                )}
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onToggleMenu(briefing, e.currentTarget as HTMLElement);
                    }}
                    className="w-8 h-8 bg-black/20 hover:bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-colors opacity-0 group-hover:opacity-100"
                >
                    <MoreVertical className="w-4 h-4" />
                </button>
                {isMenuOpen && (
                    <>
                        <div className="fixed inset-0 z-[60]" onClick={(e) => { e.stopPropagation(); onCloseMenu(); }} />
                        <div
                            className="fixed bg-white dark:bg-[#1A1A1A] rounded-xl border border-gray-100 dark:border-white/10 shadow-xl py-1 z-[70] min-w-[180px] animate-in fade-in zoom-in-95 origin-top-right"
                            style={{ top: menuPos.top, left: menuPos.left }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onCloseMenu(); onOpenBuilder(briefing); }}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                            >
                                <Edit3 className="w-4 h-4" /> Editar
                            </button>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onCopyLink(briefing); }}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                            >
                                <Link2 className="w-4 h-4" /> Copiar Link
                            </button>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onOpenExternal(briefing); }}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                            >
                                <ExternalLink className="w-4 h-4" /> Abrir Formulário
                            </button>
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onCloseMenu(); onOpenResponses(briefing); }}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                            >
                                <MessageSquareText className="w-4 h-4" /> Ver Respostas
                            </button>
                            <div className="border-t border-gray-100 dark:border-white/5 my-1" />
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); onCloseMenu(); onDelete(briefing); }}
                                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            >
                                <Trash2 className="w-4 h-4" /> Excluir
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>

        <div className="p-4 flex-1 flex flex-col">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-1 line-clamp-1">{briefing.title}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-4 flex-1">
                {briefing.description || 'Nenhuma descrição fornecida'}
            </p>

            <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100 dark:border-white/5">
                <span className="text-xs font-medium text-gray-400 dark:text-gray-500 flex items-center gap-1.5">
                    <ClipboardList className="w-3.5 h-3.5" />
                    {briefing.questions?.length || 0} perguntas
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                    {new Date(briefing.createdAt || '').toLocaleDateString('pt-BR')}
                </span>
            </div>
        </div>
    </div>
));

const BriefingsPanel: React.FC<BriefingsPanelProps> = ({ currentTeamId, currentUserId }) => {
    const { briefings, loading, createBriefing, updateBriefing, deleteBriefing } = useBriefingsCRUD(currentTeamId, currentUserId);

    const [currentView, setCurrentView] = useState<PanelView>('list');
    const [selectedBriefing, setSelectedBriefing] = useState<Briefing | undefined>(undefined);
    const [searchTerm, setSearchTerm] = useState('');
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);
    const [menuPos, setMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
    const deferredSearchTerm = useDeferredValue(searchTerm);

    const handleOpenBuilder = useCallback((briefing?: Briefing) => {
        setSelectedBriefing(briefing);
        setCurrentView('builder');
    }, []);

    const handleSaveBriefing = useCallback(async (briefingData: Partial<Briefing>, questions: Partial<BriefingQuestion>[]) => {
        if (selectedBriefing) {
            await updateBriefing(selectedBriefing.id, briefingData, questions as any);
            // Update selectedBriefing with latest data so remount uses correct values
            setSelectedBriefing(prev => prev ? { ...prev, ...briefingData, questions: questions as any } : prev);
        } else {
            // Create
            if (!currentTeamId || !currentUserId) return;
            const newId = await createBriefing(
                { ...briefingData, teamId: currentTeamId, userId: currentUserId, isTemplate: false } as any,
                questions as any
            );
            if (newId) {
                setSelectedBriefing({ ...briefingData, id: newId, teamId: currentTeamId, userId: currentUserId, isTemplate: false, questions: questions as any } as Briefing);
            }
        }
        // Stay in builder
    }, [currentTeamId, currentUserId, createBriefing, selectedBriefing, updateBriefing]);

    const filteredBriefings = useMemo(() => {
        const term = deferredSearchTerm.trim().toLowerCase();
        if (!term) return briefings;
        return briefings.filter(b => b.title.toLowerCase().includes(term));
    }, [briefings, deferredSearchTerm]);

    const handleToggleMenu = useCallback((briefing: Briefing, target: HTMLElement) => {
        setOpenMenuId(prev => {
            if (prev === briefing.id) {
                return null;
            }
            const rect = target.getBoundingClientRect();
            setMenuPos({ top: rect.bottom + 4, left: Math.min(rect.right - 180, window.innerWidth - 200) });
            return briefing.id;
        });
    }, []);

    const handleCloseMenu = useCallback(() => setOpenMenuId(null), []);

    const handleOpenResponses = useCallback((briefing: Briefing) => {
        setSelectedBriefing(briefing);
        setCurrentView('responses');
    }, []);

    const handleCopyLink = useCallback((briefing: Briefing) => {
        navigator.clipboard.writeText(publicFormUrl(briefing));
    }, []);

    const handleOpenExternal = useCallback((briefing: Briefing) => {
        window.open(publicFormUrl(briefing), '_blank');
    }, []);

    const handleDeleteBriefing = useCallback((briefing: Briefing) => {
        if (confirm('Tem certeza que deseja excluir este formulário?')) {
            void deleteBriefing(briefing.id);
        }
    }, [deleteBriefing]);

    // Builder renders BEFORE loading check — prevents fetchBriefings() from unmounting Builder
    if (currentView === 'builder') {
        return (
            <BriefingBuilder
                initialBriefing={selectedBriefing}
                onSave={handleSaveBriefing}
                onCancel={() => setCurrentView('list')}
            />
        );
    }

    if (currentView === 'responses' && selectedBriefing) {
        return (
            <BriefingResponses
                briefing={selectedBriefing}
                onBack={() => setCurrentView('list')}
            />
        );
    }

    // No full-screen LoadingScreen — loading is handled inline in the grid area below

    return (
        <div className="h-full flex flex-col pt-3 bg-gray-50/50 dark:bg-transparent relative">
            <div className="px-6 pb-4 shrink-0">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1 max-w-xl">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1 tracking-tight">
                            Formulários
                        </h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                            Crie experiências interativas para captar dados dos seus clientes.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-indigo-500 transition-colors" />
                            <input
                                type="text"
                                placeholder="Buscar formulários..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full md:w-64 pl-9 pr-4 py-2.5 bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-white/5 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:focus:ring-white/10 dark:focus:border-white/20 transition-all text-gray-900 dark:text-white"
                            />
                        </div>

                        <button
                            onClick={() => handleOpenBuilder()}
                            className="flex items-center gap-2 px-4 py-2.5 bg-black dark:bg-white text-white dark:text-black rounded-xl text-sm font-semibold transition-all shadow-lg shadow-gray-200 dark:shadow-none hover:bg-gray-800 dark:hover:bg-gray-200 active:scale-95 whitespace-nowrap"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Novo Formulário</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-8">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-64 mt-10">
                        <div className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-white/5 flex items-center justify-center animate-pulse">
                            <LayoutTemplate className="w-5 h-5 text-gray-300 dark:text-gray-600" />
                        </div>
                        <p className="text-xs text-gray-400 mt-3">Carregando formulários...</p>
                    </div>
                ) : filteredBriefings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 mt-10 border-2 border-dashed border-gray-200 dark:border-white/5 rounded-2xl bg-white/50 dark:bg-white/[0.02]">
                        <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 rounded-2xl flex items-center justify-center mb-4">
                            <LayoutTemplate className="w-8 h-8 text-gray-400 dark:text-gray-500" />
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Nenhum formulário encontrado</h3>
                        <p className="text-gray-500 dark:text-gray-400 text-sm max-w-sm text-center mb-6">
                            Comece criando seu primeiro formulário para coletar informações dos clientes de forma mágica.
                        </p>
                        <button
                            onClick={() => handleOpenBuilder()}
                            className="flex items-center gap-2 px-5 py-2.5 bg-white dark:bg-[#1A1A1A] text-gray-700 dark:text-white hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-white/10 rounded-xl shadow-sm transition-all"
                        >
                            <Plus className="w-4 h-4" />
                            <span className="font-medium text-sm">Criar meu primeiro formulário</span>
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredBriefings.map((briefing) => (
                            <BriefingCard
                                key={briefing.id}
                                briefing={briefing}
                                isMenuOpen={openMenuId === briefing.id}
                                menuPos={menuPos}
                                onOpenBuilder={handleOpenBuilder}
                                onToggleMenu={handleToggleMenu}
                                onOpenResponses={handleOpenResponses}
                                onCopyLink={handleCopyLink}
                                onOpenExternal={handleOpenExternal}
                                onDelete={handleDeleteBriefing}
                                onCloseMenu={handleCloseMenu}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default BriefingsPanel;
