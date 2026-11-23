import { useState, useEffect } from 'react';
import { fetchQuestionSpec, saveQuestionSpec, deleteQuestionSpec, testQuestionSpec, generateQuestionSpec } from '../api';
import { serializeDiagram } from '../diagramSerializer';

export default function TeacherSqlSpecModal({
  isOpen,
  onClose,
  questionId,
  questionTitle,
  tables = [],
  edges = [],
  onSpecSaved
}) {
  const [activeTab, setActiveTab] = useState('queries'); // 'queries' | 'entities' | 'json' | 'test'
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Spec State
  const [spec, setSpec] = useState({
    version: 1,
    entities: [],
    relationships: [],
    sql_tests: [],
    marks: {
      entities_and_attributes: 25.0,
      relationships_and_cardinalities: 25.0,
      keys_and_constraints: 25.0,
      sql_behavioral_tests: 25.0,
    }
  });

  // Test Run Result State
  const [testReport, setTestReport] = useState(null);

  // New Test Query Form State
  const [newTestName, setNewTestName] = useState('');
  const [newTestDesc, setNewTestDesc] = useState('');
  const [newTestSql, setNewTestSql] = useState('');
  const [newTestExpectSuccess, setNewTestExpectSuccess] = useState(true);
  const [newTestMarks, setNewTestMarks] = useState(5.0);
  const [newTestKind, setNewTestKind] = useState('raw_sql');
  const [showAddForm, setShowAddForm] = useState(false);

  // Load existing spec on open
  useEffect(() => {
    if (!isOpen || !questionId) return;
    async function load() {
      setLoading(true);
      setError('');
      setSuccessMsg('');
      setTestReport(null);
      try {
        const existing = await fetchQuestionSpec(questionId);
        if (existing) {
          setSpec(existing);
        } else {
          // If no spec exists yet, pre-populate default structure
          setSpec({
            version: 1,
            entities: [],
            relationships: [],
            sql_tests: [],
            marks: {
              entities_and_attributes: 25.0,
              relationships_and_cardinalities: 25.0,
              keys_and_constraints: 25.0,
              sql_behavioral_tests: 25.0,
            }
          });
        }
      } catch (err) {
        setError(err.message || 'Failed to load question spec');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [isOpen, questionId]);

  if (!isOpen) return null;

  // Auto-generate spec from current canvas diagram
  const handleAutoGenerate = async () => {
    setError('');
    setSuccessMsg('');

    // Pre-flight check: If canvas has 0 tables
    if (!tables || tables.length === 0) {
      setError('Your canvas is currently empty. Please add at least one table with columns on your canvas first, or click "Load Sample Template" below.');
      return;
    }

    // Pre-flight check: If any table has 0 columns
    const emptyTable = tables.find((t) => !t.columns || t.columns.length === 0);
    if (emptyTable) {
      setError(`Table "${emptyTable.name || 'Unnamed'}" has no columns. Please add columns (e.g. id, name) in the right sidebar before generating.`);
      return;
    }

    setLoading(true);
    try {
      const diagram = serializeDiagram(tables, edges);
      const generated = await generateQuestionSpec(questionId, { diagram });
      setSpec(generated);
      setSuccessMsg('Successfully generated entities & initial SQL queries from canvas!');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err) {
      setError('Could not auto-generate: ' + (err.message || 'Make sure tables exist on canvas.'));
    } finally {
      setLoading(false);
    }
  };

  // Quick starter template loader
  const handleLoadSampleTemplate = () => {
    const sampleSpec = {
      version: 1,
      entities: [
        {
          name: 'student',
          attributes: [
            { name: 'id', data_type: 'INTEGER', is_primary_key: true, is_not_null: true, is_unique: true, required: true },
            { name: 'name', data_type: 'VARCHAR', is_primary_key: false, is_not_null: true, is_unique: false, required: true },
            { name: 'email', data_type: 'VARCHAR', is_primary_key: false, is_not_null: true, is_unique: true, required: true },
          ]
        },
        {
          name: 'course',
          attributes: [
            { name: 'id', data_type: 'INTEGER', is_primary_key: true, is_not_null: true, is_unique: true, required: true },
            { name: 'title', data_type: 'VARCHAR', is_primary_key: false, is_not_null: true, is_unique: false, required: true },
            { name: 'credits', data_type: 'INTEGER', is_primary_key: false, is_not_null: false, is_unique: false, required: true },
          ]
        },
        {
          name: 'enrollment',
          attributes: [
            { name: 'id', data_type: 'INTEGER', is_primary_key: true, is_not_null: true, is_unique: true, required: true },
            { name: 'student_id', data_type: 'INTEGER', is_primary_key: false, is_not_null: true, is_unique: false, required: true },
            { name: 'course_id', data_type: 'INTEGER', is_primary_key: false, is_not_null: true, is_unique: false, required: true },
          ]
        }
      ],
      relationships: [
        { from_entity: 'student', to_entity: 'enrollment', cardinality: 'one_to_many', fk_attribute: 'student_id' },
        { from_entity: 'course', to_entity: 'enrollment', cardinality: 'one_to_many', fk_attribute: 'course_id' },
      ],
      sql_tests: [
        {
          name: 'insert_student_valid',
          description: 'Insert valid student record should succeed',
          kind: 'raw_sql',
          operation: { sql: "INSERT INTO student (id, name, email) VALUES (1, 'Alice Smith', 'alice@school.edu');" },
          expect_success: true,
          marks: 5.0,
        },
        {
          name: 'insert_course_valid',
          description: 'Insert valid course record should succeed',
          kind: 'raw_sql',
          operation: { sql: "INSERT INTO course (id, title, credits) VALUES (101, 'Intro to Databases', 4);" },
          expect_success: true,
          marks: 5.0,
        },
        {
          name: 'insert_enrollment_valid',
          description: 'Enrolling a student into a course should succeed',
          kind: 'raw_sql',
          operation: { sql: "INSERT INTO enrollment (id, student_id, course_id) VALUES (1, 1, 101);" },
          expect_success: true,
          marks: 5.0,
        },
        {
          name: 'reject_invalid_fk_enrollment',
          description: 'Enrolling student into non-existent course (999) must trigger Foreign Key constraint error',
          kind: 'raw_sql',
          operation: { sql: "INSERT INTO enrollment (id, student_id, course_id) VALUES (2, 1, 999);" },
          expect_success: false,
          marks: 10.0,
        }
      ],
      marks: {
        entities_and_attributes: 25.0,
        relationships_and_cardinalities: 25.0,
        keys_and_constraints: 25.0,
        sql_behavioral_tests: 25.0,
      }
    };
    setSpec(sampleSpec);
    setSuccessMsg('✓ Loaded starter Student-Course schema and SQL test queries!');
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  // Add new query to spec
  const handleAddQuery = (e) => {
    e.preventDefault();
    if (!newTestName.trim()) {
      setError('Query Name is required');
      return;
    }
    if (!newTestSql.trim()) {
      setError('SQL Query is required');
      return;
    }

    const newTest = {
      name: newTestName.trim().toLowerCase().replace(/\s+/g, '_'),
      description: newTestDesc.trim() || newTestName.trim(),
      kind: newTestKind,
      operation: {
        sql: newTestSql.trim(),
      },
      expect_success: newTestExpectSuccess,
      marks: Number(newTestMarks) || 5.0,
    };

    setSpec((prev) => ({
      ...prev,
      sql_tests: [...(prev.sql_tests || []), newTest],
    }));

    // Reset form
    setNewTestName('');
    setNewTestDesc('');
    setNewTestSql('');
    setNewTestExpectSuccess(true);
    setNewTestMarks(5.0);
    setShowAddForm(false);
    setError('');
  };

  // Delete query from spec
  const handleDeleteQuery = (index) => {
    setSpec((prev) => ({
      ...prev,
      sql_tests: prev.sql_tests.filter((_, i) => i !== index),
    }));
  };

  // Save spec to backend
  const handleSaveSpec = async () => {
    setSaving(true);
    setError('');
    setSuccessMsg('');
    try {
      await saveQuestionSpec(questionId, spec);
      setSuccessMsg('✓ SQL Test Suite and validation spec saved successfully!');
      if (onSpecSaved) onSpecSaved(spec);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to save spec');
    } finally {
      setSaving(false);
    }
  };

  // Remove spec (revert to legacy graph evaluation)
  const handleDeleteSpec = async () => {
    if (!window.confirm('Disable SQL query validation and revert to visual diagram comparison?')) return;
    setSaving(true);
    setError('');
    try {
      await deleteQuestionSpec(questionId);
      setSuccessMsg('SQL validation disabled. Reverted to legacy graph matching.');
      if (onSpecSaved) onSpecSaved(null);
      setTimeout(() => onClose(), 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  // Test run spec against current canvas solution
  const handleTestRun = async () => {
    setTesting(true);
    setError('');
    setTestReport(null);
    try {
      const diagram = serializeDiagram(tables, edges);
      const report = await testQuestionSpec(questionId, {
        spec,
        diagram
      });
      setTestReport(report);
      setActiveTab('test');
    } catch (err) {
      setError('Test run failed: ' + (err.message || 'Ensure tables exist on canvas.'));
    } finally {
      setTesting(false);
    }
  };

  const sqlTests = spec.sql_tests || [];
  const entities = spec.entities || [];

  return (
    <div className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in font-sans">
      <div 
        className="bg-white w-full max-w-4xl rounded-2xl border border-neutral-200/90 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="px-6 py-4 border-b border-neutral-100 bg-[#f8fafc] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-200 text-brand-600 flex items-center justify-center font-bold text-[18px]">
              ⚙️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[16px] font-extrabold text-neutral-900 m-0">SQL Query Validation Suite</h2>
                <span className="px-2 py-0.5 rounded-md bg-brand-50 border border-brand-200 text-brand-700 text-[10px] font-bold uppercase tracking-wider">
                  Teacher Mode
                </span>
              </div>
              <p className="text-[12px] text-neutral-500 m-0 mt-0.5">
                Define the SQL queries and database assertions that student ER diagrams must satisfy.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-neutral-200/60 text-neutral-400 hover:text-neutral-700 flex items-center justify-center cursor-pointer border-none bg-transparent transition-colors"
          >
            ✕
          </button>
        </header>

        {/* Notifications */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl border border-red-200 bg-red-50 text-red-600 text-[12px] font-medium flex items-center justify-between">
            <span>⚠️ {error}</span>
            <button onClick={() => setError('')} className="text-red-400 hover:text-red-700 bg-transparent border-none cursor-pointer">✕</button>
          </div>
        )}
        {successMsg && (
          <div className="mx-6 mt-4 p-3 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 text-[12px] font-medium flex items-center justify-between">
            <span>{successMsg}</span>
            <button onClick={() => setSuccessMsg('')} className="text-emerald-400 hover:text-emerald-700 bg-transparent border-none cursor-pointer">✕</button>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="px-6 pt-3 border-b border-neutral-200 bg-white flex items-center gap-6 shrink-0">
          <button
            onClick={() => setActiveTab('queries')}
            className={`pb-3 font-bold text-[13px] border-b-2 cursor-pointer transition-colors flex items-center gap-2 ${
              activeTab === 'queries'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <span>SQL Test Queries</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-neutral-100 text-neutral-700 font-extrabold">
              {sqlTests.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('entities')}
            className={`pb-3 font-bold text-[13px] border-b-2 cursor-pointer transition-colors flex items-center gap-2 ${
              activeTab === 'entities'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <span>Expected Schema Entities</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-neutral-100 text-neutral-700 font-extrabold">
              {entities.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('test')}
            className={`pb-3 font-bold text-[13px] border-b-2 cursor-pointer transition-colors flex items-center gap-2 ${
              activeTab === 'test'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            <span>Test Run Sandbox</span>
            {testReport && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                testReport.is_valid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {testReport.total_marks_earned} pts
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('json')}
            className={`pb-3 font-bold text-[13px] border-b-2 cursor-pointer transition-colors ${
              activeTab === 'json'
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-800'
            }`}
          >
            Advanced JSON Spec
          </button>
        </div>

        {/* Content Area */}
        <div className="grow overflow-y-auto p-6 bg-neutral-50/50">
          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <span className="animate-spin text-2xl text-brand-600">🌀</span>
              <p className="text-[13px] text-neutral-500 font-medium">Loading validation specification…</p>
            </div>
          ) : (
            <>
              {/* ── TAB 1: SQL TEST QUERIES ── */}
              {activeTab === 'queries' && (
                <div className="flex flex-col gap-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-[14px] font-extrabold text-neutral-900 m-0">SQL Behavioral Tests</h3>
                      <p className="text-[12px] text-neutral-500 m-0 mt-0.5">
                        These queries will be executed directly against each student's generated database schema.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleAutoGenerate}
                        className="px-3.5 py-2 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-700 font-bold text-[12px] transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                        title="Extract entities and generate initial test cases from the canvas diagram"
                      >
                        <span>⚡ Generate from Canvas</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowAddForm(!showAddForm)}
                        className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-[12px] transition-all cursor-pointer flex items-center gap-1.5 shadow-xs border-none"
                      >
                        <span>+ Add Test Query</span>
                      </button>
                    </div>
                  </div>

                  {/* Add Query Form Drawer */}
                  {showAddForm && (
                    <form onSubmit={handleAddQuery} className="bg-white border border-brand-200 rounded-2xl p-5 shadow-sm flex flex-col gap-4 animate-scale-up">
                      <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
                        <h4 className="text-[13px] font-bold text-neutral-900 m-0 flex items-center gap-1.5">
                          <span>➕</span> Add New SQL Test Query
                        </h4>
                        <button
                          type="button"
                          onClick={() => setShowAddForm(false)}
                          className="text-neutral-400 hover:text-neutral-600 border-none bg-transparent cursor-pointer font-bold text-[13px]"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Test Name (Identifier)</label>
                          <input
                            type="text"
                            placeholder="e.g. insert_valid_student"
                            value={newTestName}
                            onChange={(e) => setNewTestName(e.target.value)}
                            className="h-9 px-3 rounded-lg border border-neutral-300 bg-neutral-50 text-[13px] outline-none focus:border-brand-500 font-medium font-mono"
                          />
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Test Description</label>
                          <input
                            type="text"
                            placeholder="e.g. Inserting a valid student row should succeed"
                            value={newTestDesc}
                            onChange={(e) => setNewTestDesc(e.target.value)}
                            className="h-9 px-3 rounded-lg border border-neutral-300 bg-neutral-50 text-[13px] outline-none focus:border-brand-500 font-medium"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">SQL Query to Execute</label>
                          <span className="text-[10px] text-neutral-400">Standard SQLite / PostgreSQL SQL statement</span>
                        </div>
                        <textarea
                          rows={3}
                          placeholder="INSERT INTO student (id, name, email) VALUES (1, 'Alice', 'alice@edu.org');"
                          value={newTestSql}
                          onChange={(e) => setNewTestSql(e.target.value)}
                          className="p-3 rounded-lg border border-neutral-300 bg-neutral-900 text-emerald-400 font-mono text-[12.5px] outline-none focus:border-brand-500 leading-relaxed"
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-1">
                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Expected Execution Outcome</label>
                          <select
                            value={newTestExpectSuccess ? 'true' : 'false'}
                            onChange={(e) => setNewTestExpectSuccess(e.target.value === 'true')}
                            className="h-9 px-3 rounded-lg border border-neutral-300 bg-white text-[12.5px] font-bold outline-none cursor-pointer"
                          >
                            <option value="true">✓ Expect Success (Operation Succeeds)</option>
                            <option value="false">✕ Expect Rejection (Constraint / FK Violation)</option>
                          </select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Test Category / Kind</label>
                          <select
                            value={newTestKind}
                            onChange={(e) => setNewTestKind(e.target.value)}
                            className="h-9 px-3 rounded-lg border border-neutral-300 bg-white text-[12.5px] font-bold outline-none cursor-pointer"
                          >
                            <option value="raw_sql">Custom SQL Query</option>
                            <option value="insert_valid">Valid Row Insert</option>
                            <option value="insert_fk_valid">Foreign Key Check (Valid)</option>
                            <option value="insert_fk_invalid">Foreign Key Violation (Negative)</option>
                            <option value="insert_duplicate">Duplicate PK Check (Negative)</option>
                            <option value="unique_constraint">Unique Constraint Check</option>
                          </select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <label className="text-[11px] font-bold text-neutral-500 uppercase tracking-wider">Marks Allocation</label>
                          <input
                            type="number"
                            min="0"
                            max="50"
                            step="0.5"
                            value={newTestMarks}
                            onChange={(e) => setNewTestMarks(e.target.value)}
                            className="h-9 px-3 rounded-lg border border-neutral-300 bg-neutral-50 text-[13px] font-bold outline-none"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-100">
                        <button
                          type="button"
                          onClick={() => setShowAddForm(false)}
                          className="px-4 py-2 rounded-xl border border-neutral-200 bg-white text-neutral-600 font-bold text-[12px] cursor-pointer hover:bg-neutral-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-5 py-2 rounded-xl bg-brand-600 text-white font-bold text-[12px] cursor-pointer hover:bg-brand-700 border-none shadow-xs"
                        >
                          Add Query
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Query Cards List */}
                  {sqlTests.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-dashed border-neutral-300 p-10 text-center flex flex-col items-center justify-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center text-xl text-neutral-400">
                        📝
                      </div>
                      <h4 className="text-[14px] font-bold text-neutral-800 m-0">No SQL Test Queries Defined</h4>
                      <p className="text-[12px] text-neutral-500 m-0 max-w-md">
                        Draw tables on your canvas and click <strong>"⚡ Generate from Canvas"</strong>, or load a pre-configured starter schema below.
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <button
                          type="button"
                          onClick={handleLoadSampleTemplate}
                          className="px-4 py-2 rounded-xl border border-brand-200 bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold text-[12px] transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                        >
                          <span>🪄 Load Starter Template (Student & Course)</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {sqlTests.map((t, idx) => {
                        let sqlStatement = t.operation?.sql;
                        if (!sqlStatement && t.operation?.row) {
                          const entity = t.operation.entity || 'table';
                          const cols = Object.keys(t.operation.row).join(', ');
                          const vals = Object.values(t.operation.row).map((v) => typeof v === 'string' ? `'${v}'` : String(v)).join(', ');
                          sqlStatement = `INSERT INTO ${entity} (${cols}) VALUES (${vals});`;
                        }
                        return (
                          <div 
                            key={t.name + idx}
                            className="bg-white border border-neutral-200 rounded-xl p-4 shadow-2xs hover:border-neutral-300 transition-all flex flex-col gap-2.5"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-2.5 flex-wrap">
                                <span className="font-mono text-[13px] font-extrabold text-neutral-900">
                                  {t.name}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                  t.expect_success
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                                }`}>
                                  {t.expect_success ? '✓ Expect Success' : '✕ Expect Rejection / Error'}
                                </span>
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-neutral-100 text-neutral-600 border border-neutral-200">
                                  {t.kind}
                                </span>
                                <span className="text-[11px] font-extrabold text-neutral-500">
                                  {t.marks} pts
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleDeleteQuery(idx)}
                                className="text-neutral-400 hover:text-red-600 border-none bg-transparent cursor-pointer p-1 transition-colors"
                                title="Remove test query"
                              >
                                🗑️
                              </button>
                            </div>

                            <p className="text-[12.5px] text-neutral-600 m-0 font-medium">
                              {t.description}
                            </p>

                            {sqlStatement && (
                              <div className="bg-neutral-900 rounded-lg p-2.5 overflow-x-auto">
                                <code className="font-mono text-[12px] text-emerald-400 whitespace-pre">
                                  {sqlStatement}
                                </code>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB 2: EXPECTED ENTITIES ── */}
              {activeTab === 'entities' && (
                <div className="flex flex-col gap-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-[14px] font-extrabold text-neutral-900 m-0">Expected Relational Entities</h3>
                      <p className="text-[12px] text-neutral-500 m-0 mt-0.5">
                        The tables and column constraints expected in the student's schema.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleAutoGenerate}
                      className="px-3.5 py-2 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-700 font-bold text-[12px] transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
                    >
                      <span>⚡ Sync from Canvas</span>
                    </button>
                  </div>

                  {entities.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-dashed border-neutral-300 p-8 text-center flex flex-col items-center justify-center gap-3 text-neutral-500 text-[13px]">
                      <p className="m-0">No entities defined yet. Draw tables on your canvas and click "Sync from Canvas", or load our starter template.</p>
                      <button
                        type="button"
                        onClick={handleLoadSampleTemplate}
                        className="px-4 py-2 rounded-xl border border-brand-200 bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold text-[12px] transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <span>🪄 Load Starter Template (Student & Course)</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {entities.map((e, idx) => (
                        <div key={e.name + idx} className="bg-white border border-neutral-200 rounded-xl p-4 shadow-2xs">
                          <div className="flex items-center justify-between border-b border-neutral-100 pb-2 mb-3">
                            <span className="font-bold text-[14px] text-neutral-900">{e.name}</span>
                            <span className="text-[11px] font-extrabold text-neutral-400">{e.attributes?.length || 0} columns</span>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            {(e.attributes || []).map((a) => (
                              <div key={a.name} className="flex items-center justify-between text-[12px] py-1 border-b border-neutral-50">
                                <div className="flex items-center gap-2">
                                  <span className={`font-mono font-bold ${a.is_primary_key ? 'text-amber-700' : 'text-neutral-800'}`}>
                                    {a.name}
                                  </span>
                                  {a.is_primary_key && (
                                    <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-extrabold text-[9px]">PK</span>
                                  )}
                                  {a.is_unique && !a.is_primary_key && (
                                    <span className="px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 font-extrabold text-[9px]">UQ</span>
                                  )}
                                </div>
                                <span className="font-mono text-[11px] text-neutral-500">{a.data_type}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB 3: TEST RUN SANDBOX ── */}
              {activeTab === 'test' && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between bg-white border border-neutral-200 p-4 rounded-xl">
                    <div>
                      <h4 className="text-[13px] font-bold text-neutral-900 m-0">Validate Query Suite</h4>
                      <p className="text-[12px] text-neutral-500 m-0 mt-0.5">
                        Test your SQL suite against the current canvas reference diagram to ensure all queries execute cleanly.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={testing}
                      onClick={handleTestRun}
                      className="px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-[12px] transition-all cursor-pointer border-none shadow-xs flex items-center gap-2"
                    >
                      {testing ? (
                        <>
                          <span className="animate-spin">🌀</span>
                          Executing Tests…
                        </>
                      ) : (
                        '🧪 Run Test Suite Now'
                      )}
                    </button>
                  </div>

                  {testReport && (
                    <div className="bg-white border border-neutral-200 rounded-xl p-5 shadow-xs flex flex-col gap-4">
                      <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-3 h-3 rounded-full ${testReport.is_valid ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                          <h4 className="text-[14px] font-extrabold text-neutral-900 m-0">
                            {testReport.is_valid ? 'All Queries Passed Successfully' : 'Some Queries Failed Assertion'}
                          </h4>
                        </div>
                        <span className="font-mono font-extrabold text-[14px] text-brand-700">
                          {testReport.total_marks_earned} / {testReport.total_marks_possible} Marks ({testReport.percentage}%)
                        </span>
                      </div>

                      {/* Behavioral outcomes */}
                      {testReport.behavioral_test_results?.all_tests && (
                        <div className="flex flex-col gap-2">
                          <label className="text-[11px] font-bold text-neutral-400 uppercase tracking-wider">Test Query Outcomes</label>
                          {testReport.behavioral_test_results.all_tests.map((t, idx) => (
                            <div 
                              key={t.test_name + idx}
                              className={`p-3 rounded-lg border text-[12px] flex flex-col gap-1.5 ${
                                t.passed ? 'bg-emerald-50/50 border-emerald-200' : 'bg-red-50/50 border-red-200'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span>{t.passed ? '✅' : '❌'}</span>
                                  <strong className="font-mono text-neutral-900">{t.test_name}</strong>
                                </div>
                                <span className={`font-bold ${t.passed ? 'text-emerald-700' : 'text-red-700'}`}>
                                  {t.marks_earned} / {t.marks_possible} pts
                                </span>
                              </div>
                              <p className="text-neutral-600 m-0">{t.message}</p>
                              {t.error_details && (
                                <div className="font-mono text-[11px] text-red-600 bg-red-100/50 p-2 rounded">
                                  {t.error_details}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── TAB 4: ADVANCED JSON SPEC ── */}
              {activeTab === 'json' && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] text-neutral-500 m-0">
                      Direct JSON representation of the question's relational specification and test cases.
                    </p>
                  </div>
                  <textarea
                    rows={16}
                    value={JSON.stringify(spec, null, 2)}
                    onChange={(e) => {
                      try {
                        const parsed = JSON.parse(e.target.value);
                        setSpec(parsed);
                        setError('');
                      } catch {
                        // ignore JSON parse error while typing
                      }
                    }}
                    className="p-4 rounded-xl border border-neutral-300 bg-neutral-900 text-emerald-400 font-mono text-[12px] outline-none leading-relaxed"
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer Actions */}
        <footer className="px-6 py-4 border-t border-neutral-200 bg-white flex items-center justify-between shrink-0">
          <button
            type="button"
            disabled={saving || loading}
            onClick={handleDeleteSpec}
            className="px-3.5 py-2 rounded-xl text-neutral-500 hover:text-red-600 hover:bg-red-50 text-[12px] font-bold transition-colors cursor-pointer border-none bg-transparent"
            title="Reverts question to visual graph comparison mode"
          >
            Revert to Visual Comparison
          </button>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700 font-bold text-[13px] transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              disabled={saving || loading}
              onClick={handleSaveSpec}
              className="px-6 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-[13px] shadow-sm transition-all cursor-pointer flex items-center gap-2 border-none"
            >
              {saving ? (
                <>
                  <span className="animate-spin">🌀</span>
                  Saving Suite…
                </>
              ) : (
                '💾 Save & Activate SQL Test Suite'
              )}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
