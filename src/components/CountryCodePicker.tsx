import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { COUNTRIES, Country, DEFAULT_COUNTRY } from '../lib/countries';

interface CountryCodePickerProps {
    selected: Country;
    onChange: (country: Country) => void;
    textClass?: string;
    borderClass?: string;
    /** Force light or dark appearance for the dropdown (overrides system dark mode) */
    theme?: 'light' | 'dark';
}

const CountryCodePicker: React.FC<CountryCodePickerProps> = ({ selected, onChange, textClass = '', borderClass = '', theme }) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const ref = useRef<HTMLDivElement>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    const filtered = COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.dial.includes(search) ||
        c.code.toLowerCase().includes(search.toLowerCase())
    );

    const handleClose = useCallback(() => {
        setOpen(false);
        setSearch('');
    }, []);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) handleClose();
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open, handleClose]);

    useEffect(() => {
        if (open && searchRef.current) searchRef.current.focus();
    }, [open]);

    // Theme-aware styles for the dropdown
    const isDark = theme === 'dark';
    const isLight = theme === 'light';
    const hasTheme = isDark || isLight;

    const dropBg = hasTheme
        ? (isDark ? 'bg-[#1A1A1A] border-white/10' : 'bg-white border-gray-200')
        : 'bg-white dark:bg-[#1A1A1A] border-gray-200 dark:border-white/10';
    const dropSearchBg = hasTheme
        ? (isDark ? 'bg-white/5' : 'bg-gray-50')
        : 'bg-gray-50 dark:bg-white/5';
    const dropSearchText = hasTheme
        ? (isDark ? 'text-white' : 'text-gray-900')
        : 'text-gray-900 dark:text-white';
    const dropBorder = hasTheme
        ? (isDark ? 'border-white/5' : 'border-gray-100')
        : 'border-gray-100 dark:border-white/5';
    const dropHover = hasTheme
        ? (isDark ? 'hover:bg-white/5' : 'hover:bg-gray-50')
        : 'hover:bg-gray-50 dark:hover:bg-white/5';
    const dropActiveBg = hasTheme
        ? (isDark ? 'bg-white/5' : 'bg-gray-50')
        : 'bg-gray-50 dark:bg-white/5';
    const dropName = hasTheme
        ? (isDark ? 'text-white' : 'text-gray-900')
        : 'text-gray-900 dark:text-white';

    return (
        <div ref={ref} className="relative shrink-0">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className={`flex items-center gap-1.5 text-xl md:text-2xl pb-4 border-b-2 ${borderClass} px-2 cursor-pointer hover:opacity-80 transition-opacity`}
            >
                <span className="text-2xl">{selected.flag}</span>
                <span className={textClass} style={{ opacity: 0.6 }}>{selected.dial}</span>
                <ChevronDown className="w-3.5 h-3.5 opacity-40" />
            </button>

            {open && (
                <div className={`absolute top-full left-0 mt-2 w-72 max-h-80 border rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 origin-top-left ${dropBg}`}>
                    {/* Search */}
                    <div className={`p-2 border-b ${dropBorder}`}>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input
                                ref={searchRef}
                                type="text"
                                placeholder="Buscar país..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className={`w-full pl-8 pr-3 py-2 ${dropSearchBg} border-none rounded-lg text-sm ${dropSearchText} outline-none placeholder-gray-400`}
                            />
                        </div>
                    </div>

                    {/* List */}
                    <div className="overflow-y-auto flex-1">
                        {filtered.length === 0 ? (
                            <div className="p-4 text-center text-sm text-gray-400">Nenhum país encontrado</div>
                        ) : (
                            filtered.map(c => (
                                <button
                                    key={c.code + c.dial}
                                    type="button"
                                    onClick={() => { onChange(c); handleClose(); }}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-left ${dropHover} transition-colors ${selected.code === c.code && selected.dial === c.dial ? dropActiveBg : ''}`}
                                >
                                    <span className="text-xl">{c.flag}</span>
                                    <span className={`flex-1 text-sm font-medium ${dropName} truncate`}>{c.name}</span>
                                    <span className="text-xs text-gray-400 font-mono">{c.dial}</span>
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default CountryCodePicker;
export { DEFAULT_COUNTRY };
export type { Country };
