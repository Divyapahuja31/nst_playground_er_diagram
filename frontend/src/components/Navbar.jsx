export default function Navbar() {
  return (
    <header className="h-14 min-h-[56px] bg-neutral-0 border-b border-neutral-300 flex justify-between items-center px-6 box-border z-10">
      <div className="flex items-center gap-4">
        <button className="flex items-center gap-2 bg-transparent border-none text-neutral-900 font-sans text-[14px] font-bold cursor-pointer py-2 transition-opacity duration-200 hover:opacity-80">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="13" y1="8" x2="3" y2="8"></line>
            <polyline points="7 12 3 8 7 4"></polyline>
          </svg>
          <span>Back</span>
        </button>
        <div className="w-[1px] h-5 bg-neutral-300"></div>
        <span className="font-sans text-[15px] font-bold text-neutral-900">ER Diagram Question</span>
      </div>
      
      <div className="flex items-center gap-4">
        <div className="w-9 h-9 rounded-full bg-[#6c4c23] text-neutral-0 flex items-center justify-center font-sans text-[12px] font-bold cursor-pointer transition-transform duration-200 hover:scale-105" title="User Profile">DP</div>
        
        <button className="w-9 h-9 rounded-lg border border-neutral-300 bg-neutral-0 text-neutral-700 flex items-center justify-center cursor-pointer shadow-xs transition-all duration-200 hover:bg-neutral-100 hover:border-neutral-400 hover:text-neutral-900 focus-visible:outline-none focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-100" title="Bookmark">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 2v12.5l5-3.5 5 3.5V2a1.5 1.5 0 0 0-1.5-1.5h-7A1.5 1.5 0 0 0 3 2z"></path>
          </svg>
        </button>
        
        <div className="flex items-center gap-2 font-sans">
          <span className="text-[13px] font-semibold text-neutral-700">Total XP</span>
          <div className="flex items-center gap-1.5 px-3 h-8 rounded-full bg-neutral-0 border border-neutral-300 box-border text-neutral-900 text-[13px] font-bold">
            <svg className="w-[18px] h-[18px] flex items-center justify-center text-neutral-0" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <polygon points="9,1.5 16.5,5.8 16.5,14.2 9,18.5 1.5,14.2 1.5,5.8" fill="#fbbf24" stroke="#d97706" strokeWidth="1" />
              <path d="M11 4.5 L7.5 9.5 H10 L9 14.5 L13 9.5 H10.5 L11 4.5 Z" fill="#ffffff" />
            </svg>
            <span>18,815</span>
          </div>
        </div>
        
        <button className="w-9 h-9 rounded-lg border border-neutral-300 bg-neutral-0 text-neutral-700 flex items-center justify-center cursor-pointer shadow-xs transition-all duration-200 hover:bg-neutral-100 hover:border-neutral-400 hover:text-neutral-900 focus-visible:outline-none focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-100" title="Reset">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 4v6h-6"></path>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
        </button>
        
        <button className="w-9 h-9 rounded-lg border border-neutral-300 bg-neutral-0 text-neutral-700 flex items-center justify-center cursor-pointer shadow-xs transition-all duration-200 hover:bg-neutral-100 hover:border-neutral-400 hover:text-neutral-900 focus-visible:outline-none focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-brand-100" title="Save Workspace">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.5 14.5h-9a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 3.5 2.5h7l3 3v7.5a1.5 1.5 0 0 1-1.5 1.5z"></path>
            <polyline points="11.5 14.5 11.5 9.5 4.5 9.5 4.5 14.5"></polyline>
            <polyline points="4.5 2.5 4.5 5.5 10.5 5.5"></polyline>
          </svg>
        </button>
        
        <button className="px-4 h-9 rounded-lg bg-brand-500 text-neutral-0 border-none font-sans text-[13px] font-bold cursor-pointer inline-flex items-center justify-center shadow-xs transition-all duration-200 hover:bg-brand-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-100">
          Submit Solution
        </button>
      </div>
    </header>
  );
}

