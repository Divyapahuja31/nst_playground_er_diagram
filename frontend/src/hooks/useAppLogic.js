import { useCallback, useState, useEffect } from 'react';
import { useNodesState, useEdgesState, addEdge } from '@xyflow/react';
import { submitSolution, loginUser, registerUser, fetchQuestion, updateQuestion, fetchWorkspace, saveWorkspace, fetchOfficialSolution } from '../api';
import { serializeDiagram, deserializeDiagram } from '../diagramSerializer';

const initialNodes = [];
const initialEdges = [];

export default function useAppLogic() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [tables, setTables] = useState([]);

  const [token, setToken] = useState(() => localStorage.getItem('auth_token'));
  const [user, setUser] = useState(() => {
    try {
      const u = localStorage.getItem('auth_user');
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  });
  const [authError, setAuthError] = useState(null);

  const [questionId, setQuestionId] = useState(() => {
    return localStorage.getItem('active_question_id') || null;
  });
  const [question, setQuestion] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [loadingSolution, setLoadingSolution] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const [solutionModalOpen, setSolutionModalOpen] = useState(false);
  const [solutionDiagram, setSolutionDiagram] = useState(null);

  const onConnect = useCallback(
    (params) => {
      const sourceTable = tables.find((t) => t.id === params.source);
      const targetTable = tables.find((t) => t.id === params.target);
      const edgeName = sourceTable && targetTable 
        ? `${sourceTable.name.toLowerCase()}_${targetTable.name.toLowerCase()}_rel` 
        : `rel_${Date.now()}`;
        
      setEdges((eds) => addEdge({
        ...params,
        label: '1 - 1',
        labelStyle: { fill: '#334155', fontWeight: 600, fontSize: 10, fontFamily: 'sans-serif' },
        labelBgStyle: { fill: '#ffffff', fillOpacity: 0.9, stroke: '#cbd5e1', strokeWidth: 1, rx: 4, ry: 4 },
        data: {
          name: edgeName,
          cardinality: 'One to One',
          compositeKeys: [],
        }
      }, eds));
    },
    [setEdges, tables],
  );

  const handleAddTable = (tableName) => {
    const id = `table-${Date.now()}`;
    const defaultColumns = [];
    const newTable = { id, name: tableName, columns: defaultColumns };

    setTables((prev) => [...prev, newTable]);
    setNodes((prev) => [
      ...prev,
      {
        id,
        type: 'tableNode',
        position: {
          x: 200 + Math.random() * 200,
          y: 150 + Math.random() * 150,
        },
        data: { label: tableName, columns: defaultColumns },
      },
    ]);
  };

  const handleUpdateTable = (updatedTable) => {
    setTables((prev) =>
      prev.map((t) => (t.id === updatedTable.id ? updatedTable : t))
    );
    setNodes((prev) =>
      prev.map((n) =>
        n.id === updatedTable.id
          ? {
              ...n,
              data: {
                ...n.data,
                label: updatedTable.name,
                columns: updatedTable.columns,
              },
            }
          : n
      )
    );
  };

  const handleDeleteTable = (tableId) => {
    setTables((prev) => prev.filter((t) => t.id !== tableId));
    setNodes((prev) => prev.filter((n) => n.id !== tableId));
  };

  const handleQuestionLoaded = async (id) => {
    setQuestionId(id);
    if (id) {
      localStorage.setItem('active_question_id', id);
    } else {
      localStorage.removeItem('active_question_id');
    }
    setValidationResult(null);
    setSubmitError(null);
    setSolutionModalOpen(false);
    setSolutionDiagram(null);

    if (!id) {
      setQuestion(null);
      setTables([]);
      setNodes([]);
      setEdges([]);
      setLoadingWorkspace(false);
      return;
    }

    setLoadingWorkspace(true);

    try {
      const qDetails = await fetchQuestion(id);
      setQuestion(qDetails);
    } catch (err) {
      console.warn("Could not fetch question metadata:", err);
    }

    try {
      const ws = await fetchWorkspace(id);
      if (ws && ws.diagram_json && Object.keys(ws.diagram_json).length > 0) {
        const { tables: loadedTables, nodes: loadedNodes, edges: loadedEdges } = deserializeDiagram(ws.diagram_json);
        setTables(loadedTables);
        setNodes(loadedNodes);
        setEdges(loadedEdges);
      } else {
        setTables([]);
        setNodes([]);
        setEdges([]);
      }
    } catch (err) {
      console.warn("Could not load workspace for question:", err);
      setTables([]);
      setNodes([]);
      setEdges([]);
    } finally {
      setLoadingWorkspace(false);
    }
  };

  useEffect(() => {
    const savedId = localStorage.getItem('active_question_id');
    if (savedId) {
      handleQuestionLoaded(savedId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    if (!questionId) return;
    setSaving(true);
    setSubmitError(null);
    try {
      const diagram = serializeDiagram(tables, edges);
      await saveWorkspace(questionId, diagram);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setSubmitError('Save failed: ' + (err.message || 'Unknown error'));
    } finally {
      setSaving(false);
    }
  };

  const handlePublishToggle = async () => {
    if (!question || !questionId) return;
    setIsPublishing(true);
    try {
      const nextPublished = !question.is_published;
      await updateQuestion(questionId, { is_published: nextPublished });
      setQuestion((prev) => prev ? { ...prev, is_published: nextPublished } : null);
    } catch (err) {
      alert("Failed to toggle published state: " + err.message);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleRevealSolution = async () => {
    if (!questionId) return;
    setLoadingSolution(true);
    try {
      const res = await fetchOfficialSolution(questionId);
      setSolutionDiagram(res.solution || {});
      setSolutionModalOpen(true);
    } catch (err) {
      alert("Failed to reveal official solution: " + err.message);
    } finally {
      setLoadingSolution(false);
    }
  };

  const handleSubmit = async () => {
    if (tables.length === 0) {
      setSubmitError('Add at least one table before submitting.');
      return;
    }
    if (!questionId) {
      setSubmitError('No question loaded — cannot submit.');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setValidationResult(null);

    try {
      const diagram = serializeDiagram(tables, edges);
      // Automatically save workspace diagram to PostgreSQL (safe fallback)
      await saveWorkspace(questionId, diagram).catch((err) => console.warn("Save workspace before submit skipped:", err));

      // Submit solution for validation
      const result = await submitSolution(questionId);
      setValidationResult(result);
    } catch (err) {
      setSubmitError(err.message || 'Submission failed');
    } finally {
      setSubmitting(false);
    }

  };

  const handleReset = () => {
    setTables([]);
    setNodes([]);
    setEdges([]);
    setValidationResult(null);
    setSubmitError(null);
  };

  const handleLogin = async (email, password) => {
    setAuthError(null);
    try {
      const data = await loginUser(email, password);
      localStorage.setItem('auth_token', data.access_token);
      localStorage.setItem('auth_user', JSON.stringify(data.user));
      setToken(data.access_token);
      setUser(data.user);
      return true;
    } catch (err) {
      setAuthError(err.message);
      return false;
    }
  };

  const handleRegister = async (fullName, email, password, role) => {
    setAuthError(null);
    try {
      const data = await registerUser(fullName, email, password, role);
      localStorage.setItem('auth_token', data.access_token);
      localStorage.setItem('auth_user', JSON.stringify(data.user));
      setToken(data.access_token);
      setUser(data.user);
      return true;
    } catch (err) {
      setAuthError(err.message);
      return false;
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('active_question_id');
    setToken(null);
    setUser(null);
    setQuestionId(null);
    handleReset();
  };

  if (typeof window !== 'undefined' && window.Cypress) {
    window.__testTables = tables;
    window.__testConnect = (params) => {
      onConnect(params);
    };
  }

  return {
    nodes, edges, tables,
    submitting, saving, saveSuccess, isPublishing, loadingWorkspace, loadingSolution, submitError, validationResult,
    token, user, authError, questionId, question,
    solutionModalOpen, setSolutionModalOpen, solutionDiagram,
    onNodesChange, onEdgesChange, onConnect,
    setEdges, setValidationResult,
    handleAddTable, handleUpdateTable, handleDeleteTable,
    handleQuestionLoaded, handleSave, handlePublishToggle, handleRevealSolution, handleSubmit, handleReset,
    handleLogin, handleRegister, handleLogout
  };
}
