import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { fetchQuestions, fetchQuestion } from '../api';

export default function Sidebar({ onQuestionLoaded }) {
  const [width, setWidth] = useState(420);
  const isResizing = useRef(false);

  const [questionData, setQuestionData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadQuestion() {
      try {
        const list = await fetchQuestions();
        if (list && list.length > 0) {
          const details = await fetchQuestion(list[0].id);
          setQuestionData(details);
          setLoading(false);
          if (onQuestionLoaded) onQuestionLoaded(list[0].id);
          return;
        }
      } catch (err) {
        console.error('Error fetching question from backend:', err);
      }
      
      // Fallback banking question
      setQuestionData({
        title: 'Banking ER Diagram',
        question: `A bank wants to design a database system to manage information about customers, accounts, and financial transactions.
A customer may own multiple accounts, and some accounts are joint accounts owned by multiple customers.
Each account records multiple financial transactions.
A transaction cannot exist without being linked to an account.

### TABLE AND ATTRIBUTES

**CUSTOMER**
- \`customer_id\` (Primary Key)
- \`name\`
- \`aadhaar\` (Unique)

**ACCOUNT_HOLDER**
- \`customer_id\` (Foreign Key → CUSTOMER.customer_id)
- \`account_id\` (Foreign Key → ACCOUNT.account_id)
- \`role\`
- *Primary Key*: (customer_id, account_id)

**ACCOUNT**
- \`account_id\` (Primary Key)
- \`account_type\`
- \`balance\`

**TRANSACTION**
- \`transaction_id\` (Primary Key)
- \`transaction_date\`
- \`amount\`
- \`account_id\` (Foreign Key → ACCOUNT.account_id)

### YOUR TASK
Using the above information:
1. Draw a complete ER diagram for the banking system.
2. Use the given entity names, attribute names, primary keys, and foreign keys exactly as specified.
3. Clearly show:
   - Entities
   - Attributes
   - Primary keys
   - Foreign keys
   - Relationships between entities
   - Cardinality of each relationship`
      });
      setLoading(false);
    }
    
    loadQuestion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startResizing = (e) => {
    isResizing.current = true;
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  const handleMouseMove = (e) => {
    if (!isResizing.current) return;
    const newWidth = e.clientX;
    if (newWidth >= 320 && newWidth <= 600) {
      setWidth(newWidth);
    }
  };

  const stopResizing = () => {
    isResizing.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopResizing);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  };

  return (
    <aside 
      className="flex h-full min-h-full bg-neutral-50 border-r border-neutral-300 relative z-[5] box-border" 
      style={{ width: `${width}px` }}
    >
      {/* Left thin vertical navigation tab bar */}
      <div className="w-14 min-w-[56px] h-full flex flex-col box-border">
        <div className="h-14 min-h-[56px] flex items-center justify-center bg-white box-border border-b border-neutral-100">
          <span className="font-serif text-[20px] font-bold text-neutral-900 select-none">Q</span>
        </div>
        
        <div className="grow bg-[#F6F7F9] border-r border-neutral-200 rounded-tr-2xl flex flex-col justify-between items-center py-5 box-border">
          <div className="flex flex-col items-center w-full box-border">
            <div 
              className="w-9 h-9 rounded-lg border-none bg-transparent text-neutral-950 flex items-center justify-center cursor-pointer transition-all duration-200 shadow-none active" 
              title="Question Description"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path>
                <rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect>
                <line x1="9" y1="12" x2="15" y2="12"></line>
                <line x1="9" y1="16" x2="13" y2="16"></line>
              </svg>
            </div>
          </div>

          <div className="flex flex-col items-center gap-4 w-full box-border">
            <button 
              className="w-8 h-8 rounded-lg border-none bg-transparent text-neutral-600 flex items-center justify-center cursor-pointer transition-all duration-200 hover:text-neutral-900 hover:bg-black/5" 
              title="Settings"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </button>
            
            <div 
              className="cursor-pointer flex items-center justify-center w-8 h-8 transition-transform duration-200 hover:scale-105" 
              title="Newton School"
            >
              <svg width="18" height="24" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 10H12M6 10V22C6 25.3137 8.68629 28 12 28C15.3137 28 18 25.3137 18 22V14M12 28V18M12 18L17.5 12.5M17.5 12.5H14M17.5 12.5V16" stroke="#0072F9" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Main panel for content */}
      <div className="grow h-full bg-white relative flex flex-col overflow-hidden rounded-tl-none shadow-[-4px_0_16px_rgba(0,0,0,0.01)] box-border">
        {loading ? (
          <div className="flex flex-col h-full w-full overflow-hidden items-center justify-center">
            <span className="font-sans text-[14px] text-neutral-600">Loading question...</span>
          </div>
        ) : (
          <div className="flex flex-col h-full w-full overflow-hidden">
            <header className="h-12 min-h-[48px] px-8 border-b-0 flex items-center justify-between box-border">
              <span className="font-sans text-[13px] font-bold tracking-[1.8px] text-neutral-700">QUESTION</span>
              <div className="flex items-center gap-2">
                <button 
                  className="w-8 h-8 rounded border-none bg-transparent text-neutral-500 flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-neutral-100 hover:text-neutral-900" 
                  title="Feedback"
                >
                  <svg width="18" height="14" viewBox="0 0 24 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="14" rx="2" ry="2" />
                    <path d="M16 17l4 4v-4" />
                    <line x1="12" y1="7" x2="12" y2="11" />
                    <line x1="12" y1="14" x2="12.01" y2="14" />
                  </svg>
                </button>
                <button 
                  className="w-8 h-8 rounded border-none bg-transparent text-neutral-500 flex items-center justify-center cursor-pointer transition-all duration-200 hover:bg-neutral-100 hover:text-neutral-900" 
                  title="Close Panel"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            </header>

            <div className="grow overflow-y-auto overflow-x-hidden p-8 pb-10 box-border scrollbar-thin">
              <h2 className="text-[32px] font-bold tracking-[-0.6px] text-neutral-950 mt-0 mb-4 font-sans leading-tight">{questionData?.title}</h2>
              
              <div className="flex items-center gap-3 mb-5">
                <span className="text-[13px] font-bold px-2.5 py-1 box-border bg-amber-50 text-amber-700 border border-amber-200 rounded-full">Medium</span>
                <span className="text-neutral-400 text-[14px] mx-1">▪</span>
                <span className="bg-[#FFF1E5] text-[#C2410C] border border-[#FFD8C2] rounded-md text-[13px] font-bold px-2.5 py-1 box-border">2x</span>
                <span className="text-neutral-400 text-[14px] mx-1">▪</span>
                <div className="bg-transparent text-neutral-800 font-bold inline-flex items-center gap-2 p-0 text-[13px] box-border">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="#FEB000" stroke="#D17300" strokeWidth="1.5" className="score-hexagon">
                    <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5" />
                    <path d="M13 6 L8.5 13 H12 L11 18 L15.5 11 H12 L13 6 Z" fill="#FFF" stroke="none" />
                  </svg>
                  <span className="text-[15px] tracking-wide">80/80</span>
                </div>
              </div>

              <div className="text-[13.5px] text-neutral-500 mt-0 mb-6 font-sans font-medium">Time Limit: 2, Memory Limit: 256000</div>
              
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="text-[18px] leading-relaxed text-neutral-700 font-normal mb-3">{children}</p>,
                  h3: ({ children }) => <h3 className="text-[20px] font-bold text-neutral-800 mt-8 mb-3 font-sans uppercase tracking-wider">{children}</h3>,
                  h4: ({ children }) => <h4 className="text-[14px] font-bold text-neutral-900 mt-5 mb-2 font-sans uppercase tracking-wider">{children}</h4>,
                  ul: ({ children }) => <ul className="pl-0 my-3 list-none">{children}</ul>,
                  ol: ({ children }) => <ol className="pl-5 my-4">{children}</ol>,
                  li: ({ children, ...props }) => {
                    // Check if it has a sub-list (e.g. Attributes under Entity)
                    const hasSubList = Array.isArray(children) && children.some(child => child?.props?.node?.type === 'list');
                    if (hasSubList) {
                      return (
                        <li className="list-none font-sans text-[18px] font-bold text-neutral-800 mt-6 mb-2 uppercase tracking-wider">
                          {children}
                        </li>
                      );
                    }
                    // If it is inside a nested list
                    const isNested = props.className?.includes('nested') || (props.node?.depth && props.node.depth > 1);
                    if (isNested) {
                      return (
                        <li className="list-none ml-5 text-[18px] leading-relaxed text-neutral-700 font-medium mb-1.5 normal-case tracking-normal">
                          {children}
                        </li>
                      );
                    }
                    // Standard list item (either bullet or numbered)
                    const isOrdered = props.ordered;
                    if (isOrdered) {
                      return (
                        <li className="text-[18px] leading-relaxed text-neutral-700 font-medium mb-3 list-decimal">
                          {children}
                        </li>
                      );
                    }
                    return (
                      <li className="list-disc text-[18px] leading-relaxed text-neutral-700 font-medium ml-5 mb-1.5">
                        {children}
                      </li>
                    );
                  },
                  hr: () => <hr className="border-none border-t border-neutral-200 my-6" />,
                  code: ({ children }) => <code className="font-mono text-[13px] text-[#db2777] bg-transparent font-semibold inline">{children}</code>
                }}
              >
                {questionData?.question}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* Drag resize handle */}
        <div 
          className="absolute top-0 -right-[3px] w-1.5 h-full cursor-col-resize z-10 transition-colors duration-200 hover:bg-brand-500 active:bg-brand-500" 
          onMouseDown={startResizing} 
        />
      </div>
    </aside>
  );
}
