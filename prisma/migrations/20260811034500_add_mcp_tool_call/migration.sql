-- CreateTable
CREATE TABLE "mcp_tool_call" (
    "name" TEXT NOT NULL PRIMARY KEY,
    "calls" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "lastMs" INTEGER,
    "lastError" TEXT,
    "lastErrorAt" DATETIME,
    "firstCalledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastCalledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
