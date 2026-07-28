import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { fetchQuestion, updateQuestion } from '../api';

export default function Sidebar({ user, selectedQuestionId, onLoadSolution, currentDiagram }) {
  const [width, setWidth] = useState(420);
  const isResizing = useRef(false);

  const [questionData, setQuestionData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedQuestionId) return;
    async function loadDetail() {
      setLoading(true);
      try {
        const details = await fetchQuestion(selectedQuestionId, true); // try include_solution if allowed
        setQuestionData(details);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadDetail();
  }, [selectedQuestionId]);

  const handleSaveActiveSolution = async () => {
    if (!questionData) return;
    try {
      await updateQuestion(questionData.id, {
        title: questionData.title,
        question: questionData.question,
        solution: currentDiagram
      });
      alert('Reference solution saved successfully!');
    } catch (err) {
      alert(err.message);
    }
  };

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

  const isTeacher = user?.role === 'TEACHER' || user?.role === 'ADMIN';

  return (
    <aside 
      className="flex h-full min-h-full bg-neutral-50 border-r border-neutral-300 relative z-[5] box-border" 
      style={{ width: `${width}px` }}
    >
      {/* Main panel for content */}
      <div className="grow h-full bg-white relative flex flex-col overflow-hidden box-border">
        {loading ? (
          <div className="flex flex-col h-full w-full overflow-hidden items-center justify-center">
            <span className="font-sans text-[14px] text-neutral-600">Loading details...</span>
          </div>
        ) : (
          <div className="flex flex-col h-full w-full overflow-hidden">
            <header className="h-14 min-h-[56px] px-6 border-b border-neutral-200 flex items-center justify-between box-border bg-neutral-50/50">
              <span className="font-sans text-[13px] font-bold tracking-[1px] text-neutral-700">QUESTION DETAIL</span>
            </header>

            <div className="grow overflow-y-auto overflow-x-hidden p-6 pb-10 box-border scrollbar-thin">
              <h2 className="text-[26px] font-bold tracking-[-0.6px] text-neutral-950 mt-0 mb-3 font-sans leading-tight">{questionData?.title}</h2>
              
              <div className="flex items-center gap-3 mb-5 flex-wrap">
                <span className="text-[12px] font-bold px-2 py-0.5 box-border bg-amber-50 text-amber-700 border border-amber-200 rounded-full">Medium</span>
                {user?.role !== 'STUDENT' && (
                  <>
                    <span className="text-neutral-300 text-[12px]">▪</span>
                    <span className="text-[12px] text-neutral-500">Creator: {questionData?.creator_email || 'Default Teacher'}</span>
                  </>
                )}
              </div>

              {/* Teacher reference solution tools */}
              {(user?.role === 'TEACHER' || user?.role === 'ADMIN') && questionData && (
                <div className="flex gap-2 flex-wrap bg-[#f8fafc] border border-neutral-200/60 p-3.5 rounded-xl mb-6 items-center">
                  <span className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider block w-full mb-1">Teacher reference solution:</span>
                  {String(user?.id).toLowerCase() !== String(questionData.reviewer_id || '').toLowerCase() ? (
                    <>
                      <button
                        type="button"
                        onClick={() => onLoadSolution(questionData.id)}
                        className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-brand-50 text-brand-600 hover:bg-brand-100 transition-colors cursor-pointer border-none"
                      >
                        Load Solution to Canvas
                      </button>
                      
                      {(String(user?.id).toLowerCase() === String(questionData.created_by || '').toLowerCase() || 
                        String(user?.id).toLowerCase() === String(questionData.owner_id || '').toLowerCase() ||
                        user?.role === 'ADMIN') && (
                        <button
                          type="button"
                          onClick={handleSaveActiveSolution}
                          className="px-3 py-1.5 text-[11px] font-bold rounded-lg bg-green-50 text-green-600 hover:bg-green-100 transition-colors cursor-pointer border-none"
                          title="Overwrite solution with current canvas layout"
                        >
                          Save Canvas as Solution
                        </button>
                      )}
                    </>
                  ) : (
                    <span className="text-[11.5px] text-neutral-500 italic pl-1">
                      Assigned Reviewer (Blind): Solution access restricted.
                    </span>
                  )}
                </div>
              )}

              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="text-[14px] leading-relaxed text-neutral-700 font-normal mb-3">{children}</p>,
                  h3: ({ children }) => <h3 className="text-[15px] font-bold text-neutral-800 mt-6 mb-2.5 font-sans uppercase tracking-wider">{children}</h3>,
                  h4: ({ children }) => <h4 className="text-[13px] font-bold text-neutral-900 mt-4 mb-2 font-sans uppercase tracking-wider">{children}</h4>,
                  ul: ({ children }) => <ul className="pl-0 my-2 list-none">{children}</ul>,
                  ol: ({ children }) => <ol className="pl-5 my-3">{children}</ol>,
                  li: ({ children, ...props }) => {
                    const hasSubList = Array.isArray(children) && children.some(child => child?.props?.node?.type === 'list');
                    if (hasSubList) {
                      return (
                        <li className="list-none font-sans text-[14px] font-bold text-neutral-800 mt-4 mb-1.5 uppercase tracking-wider">
                          {children}
                        </li>
                      );
                    }
                    const isNested = props.className?.includes('nested') || (props.node?.depth && props.node.depth > 1);
                    if (isNested) {
                      return (
                        <li className="list-none ml-4 text-[13.5px] leading-relaxed text-neutral-700 font-medium mb-1.5 normal-case tracking-normal">
                          {children}
                        </li>
                      );
                    }
                    return (
                      <li className="list-disc text-[14px] leading-relaxed text-neutral-700 font-medium ml-4 mb-1.5">
                        {children}
                      </li>
                    );
                  },
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
