import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import RightSidebar from './components/RightSidebar';
import Playground from './components/Playground';
import ValidationResult from './components/ValidationResult';
import AuthPortal from './components/AuthPortal';
import Dashboard from './components/Dashboard';
import useAppLogic from './hooks/useAppLogic';
import { serializeDiagram } from './diagramSerializer';
import '@xyflow/react/dist/style.css';

export default function App() {
  const {
    nodes, edges, tables,
    submitting, submitError, validationResult,
    token, user, authError, questionId,
    onNodesChange, onEdgesChange, onConnect,
    setEdges, setValidationResult,
    handleAddTable, handleUpdateTable, handleDeleteTable,
    handleQuestionLoaded, handleSubmit, handleReset,
    handleLogin, handleRegister, handleLogout, handleLoadSolution
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
      <div className="flex flex-col w-full h-screen overflow-hidden bg-neutral-0">
        <Navbar
          onSubmit={handleSubmit}
          onReset={handleReset}
          submitting={submitting}
          submitError={submitError}
          user={user}
          onLogout={handleLogout}
          onBack={null}
        />
        <Dashboard
          user={user}
          onSelectQuestion={handleQuestionLoaded}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full h-screen overflow-hidden bg-neutral-0">
      <Navbar
        onSubmit={handleSubmit}
        onReset={handleReset}
        submitting={submitting}
        submitError={submitError}
        user={user}
        onLogout={handleLogout}
        onBack={() => handleQuestionLoaded(null)}
      />

      <main className="main-workspace">
        <Sidebar 
          user={user}
          selectedQuestionId={questionId}
          onLoadSolution={handleLoadSolution}
          currentDiagram={serializeDiagram(tables, edges)}
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
    </div>
  );
}
