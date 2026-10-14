import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import RightSidebar from './components/RightSidebar';
import Playground from './components/Playground';
import ValidationResult from './components/ValidationResult';
import RevealSolutionModal from './components/RevealSolutionModal';
import AuthPortal from './components/AuthPortal';
import Dashboard from './components/Dashboard';
import useAppLogic from './hooks/useAppLogic';
import '@xyflow/react/dist/style.css';
import { Routes, Route, useNavigate, useParams, Navigate } from 'react-router-dom';
import { useEffect } from 'react';

export default function App() {
  const logic = useAppLogic();
  const navigate = useNavigate();

  if (!logic.token) {
    return (
      <AuthPortal
        onLogin={logic.handleLogin}
        onRegister={logic.handleRegister}
        authError={logic.authError}
      />
    );
  }

  return (
    <Routes>
      <Route 
        path="/" 
        element={
          <Dashboard
            user={logic.user}
            onLogout={logic.handleLogout}
            onSelectQuestion={(id) => navigate(`/questions/${id}`)}
          />
        } 
      />
      <Route path="/questions/:id" element={<WorkspaceRoute logic={logic} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function WorkspaceRoute({ logic }) {
  const { id } = useParams();
  const navigate = useNavigate();
  
  useEffect(() => {
    logic.handleQuestionLoaded(id);
    return () => {
      logic.handleQuestionLoaded(null);
    };
  }, [id]);

  return (
    <div className="flex flex-col w-full h-screen overflow-hidden bg-neutral-0 font-sans relative">
      <Navbar
        question={logic.question}
        user={logic.user}
        onSave={logic.handleSave}
        saving={logic.saving}
        saveSuccess={logic.saveSuccess}
        onPublishToggle={logic.handlePublishToggle}
        isPublishing={logic.isPublishing}
        onRevealSolution={logic.handleRevealSolution}
        loadingSolution={logic.loadingSolution}
        onSubmit={logic.handleSubmit}
        submitting={logic.submitting}
        submitError={logic.submitError}
        onReset={logic.handleReset}
        onLogout={logic.handleLogout}
        onBack={() => navigate('/')}
      />

      <main className="main-workspace relative">
        {logic.loadingWorkspace && (
          <div className="absolute inset-0 z-40 bg-white/80 backdrop-blur-xs flex flex-col items-center justify-center animate-fadeIn">
            <div className="w-10 h-10 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin mb-3"></div>
            <p className="font-sans text-[14px] font-bold text-neutral-800">Restoring Saved Workspace…</p>
          </div>
        )}

        <Sidebar 
          user={logic.user}
          question={logic.question}
        />
        <Playground
          nodes={logic.nodes}
          edges={logic.edges}
          onNodesChange={logic.onNodesChange}
          onEdgesChange={logic.onEdgesChange}
          onNodesDelete={logic.onNodesDelete}
          onConnect={logic.onConnect}
        />

        <RightSidebar
          tables={logic.tables}
          edges={logic.edges}
          setEdges={logic.setEdges}
          onAddTable={logic.handleAddTable}
          onUpdateTable={logic.handleUpdateTable}
          onDeleteTable={logic.handleDeleteTable}
        />
      </main>

      <ValidationResult
        result={logic.validationResult}
        onClose={() => logic.setValidationResult(null)}
      />

      {logic.solutionModalOpen && (
        <RevealSolutionModal
          solutionDiagram={logic.solutionDiagram}
          onClose={() => logic.setSolutionModalOpen(false)}
        />
      )}
    </div>
  );
}
