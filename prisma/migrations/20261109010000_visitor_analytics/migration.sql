CREATE TABLE "VisitorEvent" (
  "id" UUID NOT NULL PRIMARY KEY,
  "visitorHash" CHAR(64) NOT NULL,
  "sessionId" UUID NOT NULL,
  "path" VARCHAR(500) NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "country" CHAR(2) NOT NULL,
  "device" VARCHAR(16) NOT NULL,
  "browser" VARCHAR(32) NOT NULL,
  "os" VARCHAR(32) NOT NULL,
  "source" VARCHAR(253) NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "VisitorEvent_occurredAt_idx" ON "VisitorEvent"("occurredAt");
CREATE INDEX "VisitorEvent_country_occurredAt_idx" ON "VisitorEvent"("country", "occurredAt");
CREATE INDEX "VisitorEvent_device_occurredAt_idx" ON "VisitorEvent"("device", "occurredAt");
CREATE INDEX "VisitorEvent_path_occurredAt_idx" ON "VisitorEvent"("path", "occurredAt");
CREATE TABLE "VisitorAnalyticsDay" (
  "date" DATE NOT NULL PRIMARY KEY,
  "views" INTEGER NOT NULL DEFAULT 0,
  "visitors" INTEGER NOT NULL DEFAULT 0,
  "sessions" INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE "VisitorIdentityDay" (
  "date" DATE NOT NULL,
  "visitorHash" CHAR(64) NOT NULL,
  PRIMARY KEY ("date", "visitorHash")
);
CREATE TABLE "VisitorSessionDay" (
  "date" DATE NOT NULL,
  "sessionId" UUID NOT NULL,
  PRIMARY KEY ("date", "sessionId")
);
