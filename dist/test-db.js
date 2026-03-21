"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pg_1 = require("pg");
require("dotenv/config");
async function testConnection() {
    const client = new pg_1.Client({
        connectionString: process.env.DATABASE_URL,
    });
    try {
        console.log('Connecting to:', process.env.DATABASE_URL);
        await client.connect();
        console.log('✅ Connection successful!');
        const res = await client.query('SELECT NOW()');
        console.log('Server time:', res.rows[0]);
        await client.end();
    }
    catch (err) {
        console.error('❌ Connection failed:', err.message);
        process.exit(1);
    }
}
testConnection();
