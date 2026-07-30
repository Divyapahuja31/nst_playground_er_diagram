import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { fetchQuestion } from '../api';

export default function Sidebar({ user, selectedQuestionId }) {
  const [width, setWidth] = useState(420);
  const isResizing = useRef(false);

  const [questionData, setQuestionData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedQuestionId) return;
    async function loadDetail() {
      setLoading(true);
      try {
        const details = await fetchQuestion(selectedQuestionId);
        setQuestionData(details);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadDetail();
  }, [selectedQuestionId]);

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
      className="flex h-full min-h-full bg-neutral-50 border-r border-neutral-300 relative z-[5] box-border font-sans" 
      style={{ width: `${width}px` }}
    >
      <div className="grow h-full bg-white relative flex flex-col overflow-hidden box-border">
        {loading ? (
          <div className="flex flex-col h-full w-full overflow-hidden items-center justify-center">
            <span className="font-sans text-[14px] text-neutral-600">Loading problem description...</span>
          </div>
        ) : (
          <div className="flex flex-col h-full w-full overflow-hidden">
            <header className="h-14 min-h-[56px] px-6 border-b border-neutral-200 flex items-center justify-between box-border bg-neutral-50/50">
              <span className="font-sans text-[13px] font-bold tracking-[1px] text-neutral-700">QUESTION DETAIL</span>
            </header>

            <div className="grow overflow-y-auto overflow-x-hidden p-6 pb-10 box-border scrollbar-thin">
              <h2 className="text-[24px] font-bold tracking-[-0.5px] text-neutral-950 mt-0 mb-3 font-sans leading-tight">
                {questionData?.title}
              </h2>
              
              <div className="flex items-center gap-3 mb-5 flex-wrap">
                <span className="text-[12px] font-bold px-2.5 py-0.5 box-border bg-amber-50 text-amber-800 border border-amber-200 rounded-full">
                  Medium
                </span>
                {user?.role !== 'STUDENT' && questionData?.creator_email && (
                  <>
                    <span className="text-neutral-300 text-[12px]">▪</span>
                    <span className="text-[12px] text-neutral-500 font-medium">Creator: {questionData.creator_email}</span>
                  </>
                )}
                {questionData?.is_published !== undefined && (
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${questionData.is_published ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-neutral-100 text-neutral-600 border border-neutral-300'}`}>
                    {questionData.is_published ? 'Published' : 'Draft'}
                  </span>
                )}
              </div>

              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="text-[14px] leading-relaxed text-neutral-700 font-normal mb-3">{children}</p>,
                  h3: ({ children }) => <h3 className="text-[15px] font-bold text-neutral-800 mt-6 mb-2.5 font-sans uppercase tracking-wider">{children}</h3>,
                  h4: ({ children }) => <h4 className="text-[13px] font-bold text-neutral-900 mt-4 mb-2 font-sans uppercase tracking-wider">{children}</h4>,
                  ul: ({ children }) => <ul className="pl-0 my-2 list-none">{children}</ul>,
                  ol: ({ children }) => <ol className="pl-5 my-3">{children}</ol>,
                  li: ({ children, ...props }) => (
                    <li className="list-disc text-[14px] leading-relaxed text-neutral-700 font-medium ml-4 mb-1.5">
                      {children}
                    </li>
                  ),
                  hr: () => <hr className="border-none border-t border-neutral-200 my-4" />,
                  code: ({ children }) => <code className="font-mono text-[12px] text-[#db2777] bg-transparent font-semibold inline">{children}</code>
                }}
              >
                {questionData?.question}
              </ReactMarkdown>
            </div>
          </div>
        )}
      </div>

      {/* Drag resize handle */}
      <div 
        className="absolute top-0 -right-[3px] w-1.5 h-full cursor-col-resize z-10 transition-colors duration-200 hover:bg-brand-500 active:bg-brand-500" 
        onMouseDown={startResizing} 
      />
    </aside>
  );
}
