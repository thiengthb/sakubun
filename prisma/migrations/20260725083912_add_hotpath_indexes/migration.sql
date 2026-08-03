-- CreateIndex
CREATE INDEX "Item_userId_kind_idx" ON "Item"("userId", "kind");

-- CreateIndex
CREATE INDEX "Item_visibility_createdAt_idx" ON "Item"("visibility", "createdAt");

-- CreateIndex
CREATE INDEX "ReviewLog_userId_rating_reviewedAt_idx" ON "ReviewLog"("userId", "rating", "reviewedAt");

-- CreateIndex
CREATE INDEX "SrsState_userId_state_idx" ON "SrsState"("userId", "state");
