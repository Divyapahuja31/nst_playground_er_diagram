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
            ' prompt TEXT NOT NULL,'
            ' reference TEXT NOT NULL,'
            ' created_at REAL NOT NULL)'
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
            'INSERT INTO questions (title, prompt, solution, created_at) VALUES (?,?,?,?)',
            (title, question, json.dumps(solution), time.time()))
        return cur.lastrowid


def delete_question(question_id):
    with _conn() as c:
        cur = c.execute('DELETE FROM questions WHERE id = ?', (question_id,))
        return cur.rowcount > 0