/**
 * Server entry point to Start the Fastify HTTP server
 */
import { buildApp } from "./app.js";
import { config } from "./config/env.js";

async function start() {
    const app = buildApp();

    try {
        await app.listen({
            port: config.port,
            host: config.host
        });

        console.log(`
╔═════════════════════════════════════════════════════════╗
║                                                        
║     BackLens Core API Server                           
║                                                        
║   Environment: ${config.nodeEnv.padEnd(35)}            
║   Port:        ${String(config.port).padEnd(35)}       
║   Host:        ${config.host.padEnd(35)}               
║   Graph DB:    ${config.graphDbPath.padEnd(35)}        
║                                                        
║   Health:      http://localhost:${config.port}/health  
║   API Docs:    http://localhost:${config.port}/        
║                                                        
╚═════════════════════════════════════════════════════════╝
    `);

    } catch (err) {
        app.log.error(err);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on("SIGINT", async () => {
    console.log("\n Received SIGINT, shutting down gracefully...");
    process.exit(0);
});

process.on("SIGTERM", async () => {
    console.log("\n Received SIGTERM, shutting down gracefully...");
    process.exit(0);
});

// Start server
start();

//use this - pnpm --filter @backlens/core-api dev 