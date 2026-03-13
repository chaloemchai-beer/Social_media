-- CreateIndex
CREATE INDEX "Comment_postId_idx" ON "Comment"("postId");

-- CreateIndex
CREATE INDEX "Comment_email_idx" ON "Comment"("email");

-- CreateIndex
CREATE INDEX "Post_email_idx" ON "Post"("email");

-- CreateIndex
CREATE INDEX "Post_createdAt_idx" ON "Post"("createdAt");

-- CreateIndex
CREATE INDEX "Reply_commentId_idx" ON "Reply"("commentId");
