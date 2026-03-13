-- CreateIndex
CREATE INDEX IF NOT EXISTS "Comment_postId_createdAt_idx" ON "Comment"("postId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Reply_commentId_createdAt_idx" ON "Reply"("commentId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Post_email_createdAt_idx" ON "Post"("email", "createdAt");
