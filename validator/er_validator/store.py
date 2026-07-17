import json
import sqlite3
import time
from pathlib import Path

DB_PATH = Path(__file__).resolve().parents[1] / 'portal.db'


def _conn():
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def init_db():
    with _conn() as c:
        c.execute(
            'CREATE TABLE IF NOT EXISTS questions ('
            ' id INTEGER PRIMARY KEY AUTOINCREMENT,'
            ' title TEXT NOT NULL,'
            ' question TEXT NOT NULL,'
            ' solution TEXT NOT NULL,'
            ' created_at REAL NOT NULL)'
        )
        # Check if table is empty
        row = c.execute('SELECT COUNT(*) as count FROM questions').fetchone()
        if row and row['count'] == 0:
            seed_path = Path(__file__).resolve().parent / 'seed_questions.json'
            if seed_path.exists():
                with open(seed_path, 'r', encoding='utf-8') as f:
                    seed_data = json.load(f)
                    for item in seed_data:
                        title = item.get('title')
                        question = item.get('question')
                        solution = item.get('solution')
                        if title and question and solution is not None:
                            c.execute(
                                'INSERT INTO questions (title, question, solution, created_at) VALUES (?,?,?,?)',
                                (title, question, json.dumps(solution), time.time())
                            )

def list_questions():
    with _conn() as c:
        rows = c.execute(
            'SELECT id, title, created_at FROM questions ORDER BY id DESC').fetchall()
    return [dict(r) for r in rows]


def get_question(question_id):
    with _conn() as c:
        row = c.execute('SELECT * FROM questions WHERE id = ?', (question_id,)).fetchone()
    if not row:
        return None
    question = dict(row)
    question['solution'] = json.loads(question['solution'])
    return question

def create_question(title, question, solution):
    with _conn() as c:
        cur = c.execute(
            'INSERT INTO questions (title, question, solution, created_at) VALUES (?,?,?,?)',
            (title, question, json.dumps(solution), time.time()))
        return cur.lastrowid


def delete_question(question_id):
    with _conn() as c:
        cur = c.execute('DELETE FROM questions WHERE id = ?', (question_id,))
        return cur.rowcount > 0