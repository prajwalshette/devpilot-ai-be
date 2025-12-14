import { config } from 'dotenv';
config({ path: `.env` });

export const CREDENTIALS = process.env.CREDENTIALS === 'true';
export const { NODE_ENV, PORT, DATABASE_URL, SECRET_KEY, LOG_FORMAT, LOG_DIR, ORIGIN, GEMINI_API_KEY, GEMINI_MODEL, QDRANT_URL, QDRANT_API_KEY} = process.env;
