from contextlib import contextmanager
from unittest import TestCase
from unittest.mock import patch
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import database


class StartupLockTest(TestCase):
    def test_initialized_postgres_does_not_reacquire_exclusive_schema_locks(self):
        statements=[]
        class Cursor:
            def __init__(self, result=None): self.result=result
            def fetchone(self): return self.result
        class Connection:
            postgres=True
            def execute(self, sql, params=()):
                statements.append(sql)
                if sql.lstrip().startswith('ALTER TABLE'):
                    raise AssertionError('Existing tables must not be locked for redundant ALTER TABLE')
                if 'SELECT relrowsecurity' in sql: return Cursor({'relrowsecurity':True})
                if 'information_schema.columns' in sql: return Cursor({'exists':1})
                return Cursor()
        @contextmanager
        def connect(): yield Connection()
        with patch.object(database,'connect',connect):
            database.init_db()
        self.assertGreater(sum('SELECT relrowsecurity' in s for s in statements),10)
        self.assertEqual(sum('information_schema.columns' in s for s in statements),len(database.MIGRATIONS))
