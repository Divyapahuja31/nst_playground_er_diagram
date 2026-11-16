import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import RightSidebar from './components/RightSidebar';
import Playground from './components/Playground';
import ValidationResult from './components/ValidationResult';
import RevealSolutionModal from './components/RevealSolutionModal';
import TeacherSqlSpecModal from './components/TeacherSqlSpecModal';
import AuthPortal from './components/AuthPortal';
import Dashboard from './components/Dashboard';
import useAppLogic from './hooks/useAppLogic';
import '@xyflow/react/dist/style.css';
import { useState } from 'react';

export default function App() {
  const [sqlSpecModalOpen, setSqlSpecModalOpen] = useState(false);
  const {
    nodes, edges, tables,
    submitting, saving, saveSuccess, isPublishing, loadingWorkspace, loadingSolution, submitError, validationResult,
    token, user, authError, questionId, question,
    solutionModalOpen, setSolutionModalOpen, solutionDiagram,
    onNodesChange, onEdgesChange, onConnect,
    setEdges, setValidationResult,
    handleAddTable, handleUpdateTable, handleDeleteTable,
    handleQuestionLoaded, handleSave, handlePublishToggle, handleDeleteQuestion, handleRevealSolution, handleSubmit, handleReset,
    handleLogin, handleRegister, handleLogout
  } = useAppLogic();

  if (!token) {
    return (
      <AuthPortal
        onLogin={handleLogin}
        onRegister={handleRegister}
        authError={authError}
      />
    );
  }

  if (questionId === null) {
    return (
      <Dashboard
        user={user}
        onLogout={handleLogout}
        onSelectQuestion={handleQuestionLoaded}
      />
    );
  }


  return (
    <div className="flex flex-col w-full h-screen overflow-hidden bg-neutral-0 font-sans relative">
      <Navbar
        question={question}
        user={user}
        onSave={handleSave}
        saving={saving}
        saveSuccess={saveSuccess}
        onPublishToggle={handlePublishToggle}
        onDeleteQuestion={handleDeleteQuestion}
        isPublishing={isPublishing}
        onRevealSolution={handleRevealSolution}
        loadingSolution={loadingSolution}
        onSubmit={handleSubmit}
        submitting={submitting}
        submitError={submitError}
        onReset={handleReset}
        onLogout={handleLogout}
        onBack={() => handleQuestionLoaded(null)}
        onOpenSqlSpec={() => setSqlSpecModalOpen(true)}
      />

      <main className="main-workspace relative">
        {loadingWorkspace && (
          <div className="absolute inset-0 z-40 bg-white/80 backdrop-blur-xs flex flex-col items-center justify-center animate-fadeIn">
            <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin mb-3"></div>
            <p className="font-sans text-[14px] font-bold text-neutral-800">Restoring Saved Workspace…</p>
          </div>
        )}

        <Sidebar 
          user={user}
          selectedQuestionId={questionId}
          question={question}
        />
        <Playground
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
        />

        <RightSidebar
          tables={tables}
          edges={edges}
          setEdges={setEdges}
          onAddTable={handleAddTable}
          onUpdateTable={handleUpdateTable}
          onDeleteTable={handleDeleteTable}
        />
      </main>

      <ValidationResult
        result={validationResult}
        onClose={() => setValidationResult(null)}
      />

      {solutionModalOpen && (
        <RevealSolutionModal
          solutionDiagram={solutionDiagram}
          onClose={() => setSolutionModalOpen(false)}
        />
      )}

      {sqlSpecModalOpen && (
        <TeacherSqlSpecModal
          isOpen={sqlSpecModalOpen}
          onClose={() => setSqlSpecModalOpen(false)}
          questionId={questionId}
          questionTitle={question?.title}
          tables={tables}
          edges={edges}
          onSpecSaved={(savedSpec) => {
            // Update local question metadata to indicate spec is active
            if (question) {
              question.has_spec = Boolean(savedSpec);
            }
          }}
        />
      )}
    </div>
  );
}
