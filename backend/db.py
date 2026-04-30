import psycopg2
import psycopg2.extras

DB_CONFIG = {
    "dbname": "wahapedia",
    "user": "wahapedia_user",
    "password": "changeme",
    "host": "localhost",
    "port": 5432,
}


def get_conn():
    return psycopg2.connect(**DB_CONFIG, cursor_factory=psycopg2.extras.RealDictCursor)
