export default function Navbar() {
  return (
    <header className="header-navbar">
      <div className="navbar-left">
        <button className="btn-back">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="13" y1="8" x2="3" y2="8"></line>
            <polyline points="7 12 3 8 7 4"></polyline>
          </svg>
          <span>Back</span>
        </button>
        <div className="navbar-divider"></div>
        <span className="navbar-title">ER Diagram Question</span>
      </div>
      
      <div className="navbar-right">
        <div className="user-avatar" title="User Profile">DP</div>
        
        <button className="btn-icon-only bookmark-btn" title="Bookmark">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 2v12.5l5-3.5 5 3.5V2a1.5 1.5 0 0 0-1.5-1.5h-7A1.5 1.5 0 0 0 3 2z"></path>
          </svg>
        </button>
        
        <div className="progress-widget">
          <span className="progress-label">Total XP</span>
          <div className="progress-capsule">
            <svg className="xp-lightning-hexagon" width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <polygon points="9,1.5 16.5,5.8 16.5,14.2 9,18.5 1.5,14.2 1.5,5.8" fill="#fbbf24" stroke="#d97706" strokeWidth="1" />
              <path d="M11 4.5 L7.5 9.5 H10 L9 14.5 L13 9.5 H10.5 L11 4.5 Z" fill="#ffffff" />
            </svg>
            <span className="xp-value">18,815</span>
          </div>
        </div>
        
        <button className="btn-icon-only" title="Reset">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 4v6h-6"></path>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
          </svg>
        </button>
        
        <button className="btn-icon-only" title="Save Workspace">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.5 14.5h-9a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 3.5 2.5h7l3 3v7.5a1.5 1.5 0 0 1-1.5 1.5z"></path>
            <polyline points="11.5 14.5 11.5 9.5 4.5 9.5 4.5 14.5"></polyline>
            <polyline points="4.5 2.5 4.5 5.5 10.5 5.5"></polyline>
          </svg>
        </button>
        
        <button className="btn-submit">
          Submit Solution
        </button>
      </div>
    </header>
  );
}

