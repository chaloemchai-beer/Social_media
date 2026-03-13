CREATE TABLE "ProfileMedia" (
    "id"        TEXT NOT NULL,
    "email"     TEXT NOT NULL,
    "type"      TEXT NOT NULL,
    "url"       TEXT NOT NULL,
    "title"     TEXT,
    "duration"  INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProfileMedia_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ProfileMedia_email_idx" ON "ProfileMedia"("email");
CREATE INDEX "ProfileMedia_email_type_idx" ON "ProfileMedia"("email", "type");
