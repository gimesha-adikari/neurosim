import sqlite3

def initialize_db(db_path="neural_net.db"):
    # Connect to SQLite database (creates file if not exists)
    with sqlite3.connect(db_path) as conn:
        cursor = conn.cursor()

        # Create users table to store registered users
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                hash TEXT NOT NULL
            )
        ''')

        # Create neurons table to store neurons with thresholds and positions
        # Each neuron belongs to a user (user_id foreign key)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS neurons (
                id TEXT PRIMARY KEY,
                threshold REAL NOT NULL,
                x REAL NOT NULL,
                y REAL NOT NULL,
                user_id INTEGER NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')

        # Create connections table to store edges between neurons for each user
        # Each connection links two neurons (from_id -> to_id) and belongs to a user
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS connections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                from_id TEXT NOT NULL,
                to_id TEXT NOT NULL,
                user_id INTEGER NOT NULL,
                FOREIGN KEY (from_id) REFERENCES neurons (id),
                FOREIGN KEY (to_id) REFERENCES neurons (id),
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')

        # Create firing_events table to record when neurons fire per user with timestamps
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS firing_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                neuron_id TEXT NOT NULL,
                user_id INTEGER NOT NULL,
                fired_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (neuron_id) REFERENCES neurons (id),
                FOREIGN KEY (user_id) REFERENCES users (id)
            );
        ''')

        # Commit changes to save the tables
        conn.commit()

    print("Database initialized with all tables and user_id fields.")

initialize_db()
