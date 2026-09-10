-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Company" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "country" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Signal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sentiment" REAL NOT NULL,
    "severity" REAL NOT NULL,
    "observedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Signal_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SignalSnapshot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "takenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fingerprint" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    CONSTRAINT "SignalSnapshot_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RiskScore" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "companyId" TEXT NOT NULL,
    "overallScore" INTEGER NOT NULL,
    "financialScore" INTEGER NOT NULL,
    "legalScore" INTEGER NOT NULL,
    "reputationalScore" INTEGER NOT NULL,
    "cyberScore" INTEGER NOT NULL,
    "explanations" TEXT NOT NULL,
    "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "modelVersion" TEXT NOT NULL,
    CONSTRAINT "RiskScore_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RiskFactor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "riskScoreId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "weight" REAL NOT NULL,
    "evidenceText" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "sentiment" REAL NOT NULL,
    CONSTRAINT "RiskFactor_riskScoreId_fkey" FOREIGN KEY ("riskScoreId") REFERENCES "RiskScore" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MonitoredCompany" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "lastCheckedAt" DATETIME,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MonitoredCompany_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MonitoredCompany_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MonitoringAlert" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "monitoredCompanyId" TEXT NOT NULL,
    "changeType" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "detectedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "MonitoringAlert_monitoredCompanyId_fkey" FOREIGN KEY ("monitoredCompanyId") REFERENCES "MonitoredCompany" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Signal_companyId_category_idx" ON "Signal"("companyId", "category");

-- CreateIndex
CREATE INDEX "SignalSnapshot_companyId_takenAt_idx" ON "SignalSnapshot"("companyId", "takenAt");

-- CreateIndex
CREATE INDEX "RiskScore_companyId_computedAt_idx" ON "RiskScore"("companyId", "computedAt");

-- CreateIndex
CREATE INDEX "RiskFactor_riskScoreId_idx" ON "RiskFactor"("riskScoreId");

-- CreateIndex
CREATE UNIQUE INDEX "MonitoredCompany_userId_companyId_key" ON "MonitoredCompany"("userId", "companyId");

-- CreateIndex
CREATE INDEX "MonitoringAlert_monitoredCompanyId_detectedAt_idx" ON "MonitoringAlert"("monitoredCompanyId", "detectedAt");
