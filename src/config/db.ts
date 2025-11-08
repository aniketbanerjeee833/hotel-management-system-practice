import mysql from "mysql2/promise";

// Create a connection pool with promise support
const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "", // your DB password
  database: "hotel-management-system-practice",

});

// Test connection once at startup
(async () => {
  try {
    const connection = await db.getConnection();
    console.log("✅ MySQL Connected!");
    connection.release(); // release back to pool
  } catch (err:any) {
    console.error("❌ DB Connection Failed:", err.message);
  }
})();

export default db;