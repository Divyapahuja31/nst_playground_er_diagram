import { useCallback, useState } from 'react';
import { useNodesState, useEdgesState, addEdge } from '@xyflow/react';
import { submitSolution, loginUser, registerUser, fetchQuestion } from '../api';
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

  const [questionId, setQuestionId] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const onConnect = useCallback(
    (params) => {
      const sourceTable = tables.find((t) => t.id === params.source);
      const targetTable = tables.find((t) => t.id === params.target);
      const edgeName = sourceTable && targetTable 
        ? `${sourceTable.name.toLowerCase()}_${targetTable.name.toLowerCase()}_rel` 
        : `rel_${Date.now()}`;
        
      setEdges((eds) => addEdge({
        ...params,
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

  const handleQuestionLoaded = (id) => {
    setQuestionId(id);
    if (!id) {
      setTables([]);
      setNodes([]);
      setEdges([]);
      setValidationResult(null);
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
      const result = await submitSolution(questionId, diagram);
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
    setToken(null);
    setUser(null);
    handleReset();
  };

  const handleLoadSolution = async (qId) => {
    try {
      const q = await fetchQuestion(qId, true); // True request for solution
      if (q && q.solution) {
        const { tables: loadedTables, nodes: loadedNodes, edges: loadedEdges } = deserializeDiagram(q.solution);
        setTables(loadedTables);
        setNodes(loadedNodes);
        setEdges(loadedEdges);
      } else {
        alert("This question does not have a reference solution diagram, or you do not have permission to view it.");
      }
    } catch (err) {
      alert("Failed to load solution: " + err.message);
    }
  };

  if (typeof window !== 'undefined' && window.Cypress) {
    window.__testTables = tables;
    window.__testConnect = (params) => {
      onConnect(params);
    };
  }

  return {
    nodes, edges, tables,
    submitting, submitError, validationResult,
    token, user, authError, questionId,
    onNodesChange, onEdgesChange, onConnect,
    setEdges, setValidationResult,
    handleAddTable, handleUpdateTable, handleDeleteTable,
    handleQuestionLoaded, handleSubmit, handleReset,
    handleLogin, handleRegister, handleLogout, handleLoadSolution
  };
}
