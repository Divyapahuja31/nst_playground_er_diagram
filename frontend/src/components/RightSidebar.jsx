import { useState } from 'react';

export default function RightSidebar() {
  const [activeTab, setActiveTab] = useState('tables');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <aside className="w-80 min-w-[320px] h-full bg-neutral-0 border-l border-neutral-300 flex flex-col box-border z-5">
      {/* Tabs */}
      <div className="flex h-12 border-b border-neutral-300 box-border">
        <button
          className={`flex-1 bg-transparent border-none font-sans text-[14px] font-bold cursor-pointer flex items-center justify-center relative transition-colors duration-200 ${
            activeTab === 'tables'
              ? 'text-brand-500 after:content-[""] after:absolute after:bottom-[-1px] after:left-0 after:width-full after:h-[2px] after:bg-brand-500'
              : 'text-neutral-700 hover:text-neutral-900'
          }`}
          onClick={() => setActiveTab('tables')}
        >
          Tables
        </button>
        <button
          className={`flex-1 bg-transparent border-none font-sans text-[14px] font-bold cursor-pointer flex items-center justify-center relative transition-colors duration-200 ${
            activeTab === 'relations'
              ? 'text-brand-500 after:content-[""] after:absolute after:bottom-[-1px] after:left-0 after:width-full after:h-[2px] after:bg-brand-500'
              : 'text-neutral-700 hover:text-neutral-900'
          }`}
          onClick={() => setActiveTab('relations')}
        >
          Relations
        </button>
      </div>

      {/* Action Bar */}
      <div className="sidebar-action-bar flex flex-col gap-3 p-4 box-border">
        {activeTab === 'tables' && (
          <button className="h-9 flex items-center gap-1.5 px-3 bg-neutral-100 border border-neutral-300 rounded-lg text-neutral-900 font-sans text-[13px] font-bold cursor-pointer transition-all duration-200 hover:bg-neutral-200 hover:border-neutral-400 focus-visible:outline-none focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-100 whitespace-nowrap w-fit">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            <span>Add Table</span>
          </button>
        )}

        <div className="h-9 flex items-center gap-2 px-3 bg-neutral-100 border border-neutral-300 rounded-lg text-neutral-700 box-border transition-all duration-200 focus-within:border-brand-500 focus-within:bg-neutral-0 focus-within:ring-2 focus-within:ring-brand-100 w-full">
          <svg className="shrink-0 text-neutral-600" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <input
            className="w-full bg-transparent border-none outline-none font-sans text-[13px] font-semibold text-neutral-900 p-0 placeholder-neutral-500"
            type="text"
            placeholder="Search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>
    </aside>
  );
}
