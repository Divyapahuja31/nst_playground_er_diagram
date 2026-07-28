const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000';


function getHeaders() {
  const token = localStorage.getItem('auth_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

export async function fetchQuestions() {
  const res = await fetch(`${API_BASE}/questions`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch questions: ${res.status}`);
  return res.json();
}

export async function fetchQuestion(id, includeSolution = false) {
  const url = `${API_BASE}/questions/${id}${includeSolution ? '?include_solution=true' : ''}`;
  const res = await fetch(url, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch question ${id}: ${res.status}`);
  return res.json();
}

export async function fetchWorkspace(questionId) {
  const res = await fetch(`${API_BASE}/questions/${questionId}/workspace`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch workspace for question ${questionId}: ${res.status}`);
  return res.json();
}

export async function fetchOfficialSolution(questionId) {
  const res = await fetch(`${API_BASE}/questions/${questionId}/solution`, {
    headers: getHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Failed to fetch solution: ${res.status}`);
  }
  return res.json();
}


export async function saveWorkspace(questionId, diagramJson) {
  const res = await fetch(`${API_BASE}/questions/${questionId}/workspace`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ diagram_json: diagramJson }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Failed to save workspace: ${res.status}`);
  }
  return res.json();
}

export async function submitSolution(questionId, studentDiagram) {
  const payload = studentDiagram ? { student: studentDiagram } : {};
  const res = await fetch(`${API_BASE}/questions/${questionId}/submit`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Submission failed: ${res.status}`);
  }
  return res.json();
}


export async function loginUser(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Login failed: ${res.status}`);
  }
  return res.json();
}

export async function registerUser(fullName, email, password, role) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ full_name: fullName, email, password, role }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Registration failed: ${res.status}`);
  }
  return res.json();
}

export async function fetchMe() {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error(`Failed to fetch user profile: ${res.status}`);
  return res.json();
}

export async function createQuestion(payload) {
  const res = await fetch(`${API_BASE}/questions`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Failed to create question: ${res.status}`);
  }
  return res.json();
}

export async function updateQuestion(id, payload) {
  const res = await fetch(`${API_BASE}/questions/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Failed to update question: ${res.status}`);
  }
  return res.json();
}

export async function deleteQuestion(id) {
  const res = await fetch(`${API_BASE}/questions/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Failed to delete question: ${res.status}`);
  }
  return res.json();
}
