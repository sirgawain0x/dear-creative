import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const postStatusEnum = ["draft", "published"] as const;
export type PostStatus = (typeof postStatusEnum)[number];

/** Imported Paragraph archive rows; null means Adam newsletter content. */
export const postSourceEnum = ["paragraph", "beehiiv"] as const;
export type PostSource = (typeof postSourceEnum)[number];

export const subscriberStatusEnum = [
  "pending",
  "subscribed",
  "unsubscribed",
  "bounced",
] as const;

export const subscriberSourceEnum = [
  "paragraph_import",
  "beehiiv_import",
  "signup",
  "resend_webhook",
] as const;

export const payMethodEnum = [
  "x402_usdc",
  "crtvai_metoken",
  "unlock_member",
] as const;

export const approvalStatusEnum = [
  "pending",
  "approved",
  "rejected",
  "voided",
] as const;

export const deliveryChannelEnum = [
  "publish",
  "x",
  "email",
  "farcaster",
  "discord",
  "orb",
] as const;
export type DeliveryChannel = (typeof deliveryChannelEnum)[number];

export const deliveryReceiptStatusEnum = [
  "pending",
  "completed",
  "failed",
  "needs_review",
] as const;
export type DeliveryReceiptStatus =
  (typeof deliveryReceiptStatusEnum)[number];

export const deliveryReceiptChunkStatusEnum = [
  "pending",
  "completed",
  "failed",
  "needs_review",
] as const;
export type DeliveryReceiptChunkStatus =
  (typeof deliveryReceiptChunkStatusEnum)[number];

export const sponsors = sqliteTable("sponsors", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  slotHtml: text("slot_html"),
  ctaUrl: text("cta_url"),
  startsAt: integer("starts_at", { mode: "timestamp_ms" }),
  endsAt: integer("ends_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const authors = sqliteTable(
  "authors",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    bio: text("bio"),
    avatarUrl: text("avatar_url"),
    payoutAddress: text("payout_address").notNull(),
    meTokenAddress: text("me_token_address"),
    meTokenSymbol: text("me_token_symbol"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    uniqueIndex("authors_slug_unique").on(table.slug),
  ],
);

export const posts = sqliteTable(
  "posts",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    authorId: text("author_id").references(() => authors.id),
    status: text("status", { enum: postStatusEnum }).notNull().default("draft"),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
    teaserText: text("teaser_text"),
    emailSubject: text("email_subject"),
    emailHtml: text("email_html"),
    bodyHtml: text("body_html"),
    freeContent: text("free_content"),
    gatedContent: text("gated_content"),
    isGated: integer("is_gated", { mode: "boolean" }).notNull().default(false),
    gatePriceUsdc: real("gate_price_usdc").default(1.0),
    audioUrl: text("audio_url"),
    audioVoice: text("audio_voice"),
    canonicalUrl: text("canonical_url"),
    sourceGuid: text("source_guid"),
    source: text("source", { enum: postSourceEnum }),
    sponsorId: text("sponsor_id").references(() => sponsors.id),
    /** Optional per-post 0xSplits override (co-writer groups). */
    splitAddressOverride: text("split_address_override"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    uniqueIndex("posts_slug_unique").on(table.slug),
    uniqueIndex("posts_canonical_url_unique").on(table.canonicalUrl),
    uniqueIndex("posts_source_guid_unique").on(table.sourceGuid),
    index("posts_status_published_at_idx").on(table.status, table.publishedAt),
    index("posts_source_idx").on(table.source),
  ],
);

export const subscribers = sqliteTable(
  "subscribers",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    status: text("status", { enum: subscriberStatusEnum })
      .notNull()
      .default("pending"),
    source: text("source", { enum: subscriberSourceEnum })
      .notNull()
      .default("signup"),
    subscribedAt: integer("subscribed_at", { mode: "timestamp_ms" }),
    unsubscribedAt: integer("unsubscribed_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    uniqueIndex("subscribers_email_unique").on(table.email),
    index("subscribers_status_idx").on(table.status),
  ],
);

export const unlocks = sqliteTable(
  "unlocks",
  {
    id: text("id").primaryKey(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id),
    walletAddress: text("wallet_address").notNull(),
    payMethod: text("pay_method", { enum: payMethodEnum }).notNull(),
    chainId: integer("chain_id"),
    txHash: text("tx_hash"),
    amountRaw: text("amount_raw"),
    unlockedAt: integer("unlocked_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("unlocks_post_id_idx").on(table.postId),
    index("unlocks_wallet_idx").on(table.walletAddress),
  ],
);

export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    actor: text("actor").notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    payloadJson: text("payload_json"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [index("audit_events_created_at_idx").on(table.createdAt)],
);

export const deliveryReceipts = sqliteTable(
  "delivery_receipts",
  {
    id: text("id").primaryKey(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id),
    channel: text("channel", { enum: deliveryChannelEnum }).notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    status: text("status", { enum: deliveryReceiptStatusEnum })
      .notNull()
      .default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("delivery_receipts_idempotency_unique").on(
      table.idempotencyKey,
    ),
    uniqueIndex("delivery_receipts_post_channel_unique").on(
      table.postId,
      table.channel,
    ),
  ],
);

export const deliveryReceiptChunks = sqliteTable(
  "delivery_receipt_chunks",
  {
    id: text("id").primaryKey(),
    receiptId: text("receipt_id")
      .notNull()
      .references(() => deliveryReceipts.id),
    chunkIndex: integer("chunk_index").notNull(),
    subscriberIdsJson: text("subscriber_ids_json").notNull(),
    status: text("status", { enum: deliveryReceiptChunkStatusEnum })
      .notNull()
      .default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastAttemptAt: integer("last_attempt_at", { mode: "timestamp_ms" }),
    lastError: text("last_error"),
    sentSubscriberIdsHash: text("sent_subscriber_ids_hash"),
    lastSentSubscriberIdsJson: text("last_sent_subscriber_ids_json"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    uniqueIndex("delivery_receipt_chunks_receipt_chunk_unique").on(
      table.receiptId,
      table.chunkIndex,
    ),
    index("delivery_receipt_chunks_receipt_id_idx").on(table.receiptId),
  ],
);

export const subscriptionPlanEnum = ["monthly", "yearly"] as const;
export type SubscriptionPlan = (typeof subscriptionPlanEnum)[number];

/** Newsletter writers; payout splits are deployed off-platform (Rex). */
export const writers = sqliteTable(
  "writers",
  {
    id: text("id").primaryKey(),
    payoutSplitAddress: text("payout_split_address"),
    /** Writer wallet receiving 90% on the PullSplit (used for splitHash verification). */
    payoutWalletAddress: text("payout_wallet_address"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [index("writers_payout_split_idx").on(table.payoutSplitAddress)],
);

export const subscriptionStatusEnum = ["active"] as const;
export type SubscriptionStatus = (typeof subscriptionStatusEnum)[number];

export const payoutStatusEnum = ["recorded"] as const;
export type PayoutStatus = (typeof payoutStatusEnum)[number];

export const subscriptions = sqliteTable(
  "subscriptions",
  {
    id: text("id").primaryKey(),
    privyUserId: text("privy_user_id").notNull(),
    wallet: text("wallet").notNull(),
    writerId: text("writer_id")
      .notNull()
      .references(() => writers.id),
    plan: text("plan", { enum: subscriptionPlanEnum }).notNull(),
    periodStart: integer("period_start", { mode: "timestamp_ms" }).notNull(),
    periodEnd: integer("period_end", { mode: "timestamp_ms" }).notNull(),
    status: text("status", { enum: subscriptionStatusEnum })
      .notNull()
      .default("active"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("subscriptions_privy_writer_idx").on(
      table.privyUserId,
      table.writerId,
    ),
    index("subscriptions_status_period_end_idx").on(
      table.status,
      table.periodEnd,
    ),
  ],
);

export const paymentLedger = sqliteTable(
  "payment_ledger",
  {
    id: text("id").primaryKey(),
    txHash: text("tx_hash").notNull(),
    quoteId: text("quote_id")
      .notNull()
      .references(() => subscriptionQuotes.id),
    grossAmountRaw: text("gross_amount_raw").notNull(),
    writerAmountRaw: text("writer_amount_raw").notNull(),
    platformAmountRaw: text("platform_amount_raw").notNull(),
    splitAddress: text("split_address").notNull(),
    tokenAddress: text("token_address").notNull(),
    tokenDecimals: integer("token_decimals").notNull(),
    payoutStatus: text("payout_status", { enum: payoutStatusEnum })
      .notNull()
      .default("recorded"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    uniqueIndex("payment_ledger_tx_hash_unique").on(table.txHash),
    index("payment_ledger_quote_id_idx").on(table.quoteId),
  ],
);

export const subscriptionQuotes = sqliteTable(
  "subscription_quotes",
  {
    id: text("id").primaryKey(),
    privyUserId: text("privy_user_id").notNull(),
    wallet: text("wallet").notNull(),
    writerId: text("writer_id")
      .notNull()
      .references(() => writers.id),
    plan: text("plan", { enum: subscriptionPlanEnum }).notNull(),
    usdCents: integer("usd_cents").notNull(),
    minAmountRaw: text("min_amount_raw").notNull(),
    payee: text("payee").notNull(),
    tokenAddress: text("token_address").notNull(),
    tokenDecimals: integer("token_decimals").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    signature: text("signature").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("subscription_quotes_writer_created_idx").on(
      table.writerId,
      table.createdAt,
    ),
    index("subscription_quotes_privy_writer_plan_created_idx").on(
      table.privyUserId,
      table.writerId,
      table.plan,
      table.createdAt,
    ),
  ],
);

/** Per-post USDC unlock purchases (PR C reader checkout). */
export const readerPostUnlockPurchases = sqliteTable(
  "reader_post_unlock_purchases",
  {
    id: text("id").primaryKey(),
    privyUserId: text("privy_user_id").notNull(),
    walletAddress: text("wallet_address").notNull(),
    writerId: text("writer_id")
      .notNull()
      .references(() => writers.id),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id),
    txHash: text("tx_hash").notNull(),
    chainId: integer("chain_id").notNull(),
    tokenAddress: text("token_address").notNull(),
    amountRaw: text("amount_raw").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    uniqueIndex("reader_post_unlock_tx_hash_unique").on(table.txHash),
    index("reader_post_unlock_post_wallet_idx").on(
      table.postId,
      table.walletAddress,
    ),
    index("reader_post_unlock_privy_writer_idx").on(
      table.privyUserId,
      table.writerId,
    ),
  ],
);

export const approvals = sqliteTable(
  "approvals",
  {
    id: text("id").primaryKey(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id),
    status: text("status", { enum: approvalStatusEnum })
      .notNull()
      .default("pending"),
    approvedBy: text("approved_by"),
    approvedAt: integer("approved_at", { mode: "timestamp_ms" }),
    contentHash: text("content_hash").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    uniqueIndex("approvals_post_id_unique").on(table.postId),
    index("approvals_status_idx").on(table.status),
  ],
);

export const adamIdeaStatusEnum = ["queued", "drafted", "archived"] as const;
export type AdamIdeaStatus = (typeof adamIdeaStatusEnum)[number];

export const adamScheduleRunStatusEnum = [
  "idle",
  "success",
  "failed",
  "skipped",
] as const;
export type AdamScheduleRunStatus = (typeof adamScheduleRunStatusEnum)[number];

export const adamIdeas = sqliteTable(
  "adam_ideas",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    rawContent: text("raw_content").notNull(),
    attachmentsJson: text("attachments_json"),
    status: text("status", { enum: adamIdeaStatusEnum })
      .notNull()
      .default("queued"),
    draftPostId: text("draft_post_id").references(() => posts.id),
    createdBy: text("created_by"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("adam_ideas_status_created_idx").on(table.status, table.createdAt),
  ],
);

export const adamSchedules = sqliteTable("adam_schedules", {
  id: text("id").primaryKey(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  cronExpression: text("cron_expression").notNull().default("0 9 * * 1"),
  timezone: text("timezone").notNull().default("America/New_York"),
  instructions: text("instructions"),
  lastRunAt: integer("last_run_at", { mode: "timestamp_ms" }),
  lastRunStatus: text("last_run_status", { enum: adamScheduleRunStatusEnum })
    .notNull()
    .default("idle"),
  lastRunMessage: text("last_run_message"),
  lastDraftPostId: text("last_draft_post_id").references(() => posts.id),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export const postFeedbackSentimentEnum = ["helpful", "skip"] as const;
export type PostFeedbackSentiment = (typeof postFeedbackSentimentEnum)[number];

export const postFeedback = sqliteTable(
  "post_feedback",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    sentiment: text("sentiment", { enum: postFeedbackSentimentEnum }).notNull(),
    voterHash: text("voter_hash"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("post_feedback_slug_idx").on(table.slug),
    index("post_feedback_created_at_idx").on(table.createdAt),
  ],
);

export const chatRoleEnum = ["user", "model", "system"] as const;
export type ChatRole = (typeof chatRoleEnum)[number];

export const adamChatThreads = sqliteTable(
  "adam_chat_threads",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull().default("New Conversation"),
    summary: text("summary"),
    isArchived: integer("is_archived", { mode: "boolean" })
      .notNull()
      .default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("adam_chat_threads_updated_at_idx").on(table.updatedAt),
    index("adam_chat_threads_is_archived_idx").on(table.isArchived),
  ],
);

export type AdamChatThreadRecord = typeof adamChatThreads.$inferSelect;

export const adamChatMessages = sqliteTable(
  "adam_chat_messages",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => adamChatThreads.id, { onDelete: "cascade" }),
    role: text("role", { enum: chatRoleEnum }).notNull(),
    content: text("content").notNull(),
    attachmentsJson: text("attachments_json"),
    createdDraftPostId: text("created_draft_post_id").references(
      () => posts.id,
      { onDelete: "set null" },
    ),
    createdApprovalId: text("created_approval_id"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("adam_chat_messages_thread_id_idx").on(table.threadId),
    index("adam_chat_messages_created_at_idx").on(table.createdAt),
  ],
);

export type AdamChatMessageRecord = typeof adamChatMessages.$inferSelect;

export const predictionStatusEnum = [
  "pending",
  "answered",
  "finalized",
  "invalid",
] as const;
export type PredictionStatus = (typeof predictionStatusEnum)[number];

export const predictions = sqliteTable(
  "predictions",
  {
    id: text("id").primaryKey(),
    questionId: text("question_id").notNull(),
    articleSlug: text("article_slug").notNull(),
    questionText: text("question_text").notNull(),
    bondToken: text("bond_token").default("ETH"),
    minBondWei: text("min_bond_wei"),
    txHash: text("tx_hash").notNull(),
    status: text("status", { enum: predictionStatusEnum })
      .notNull()
      .default("pending"),
    rawResult: text("raw_result"),
    resolvedOutcome: text("resolved_outcome"),
    resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
    socialBroadcastAt: integer("social_broadcast_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    uniqueIndex("predictions_question_id_idx").on(table.questionId),
    index("predictions_article_slug_idx").on(table.articleSlug),
    index("predictions_status_idx").on(table.status),
  ],
);

export type PredictionRecord = typeof predictions.$inferSelect;
export type NewPredictionRecord = typeof predictions.$inferInsert;

export const postRepurposeOutputStatusEnum = [
  "generating",
  "ready",
  "failed",
] as const;
export type PostRepurposeOutputStatus =
  (typeof postRepurposeOutputStatusEnum)[number];

export const postRepurposeOutputTypeEnum = [
  "audio_overview",
  "slide_deck",
  "video_overview",
  "mind_map",
  "report",
  "flashcards",
  "quiz",
  "data_table",
  "infographic",
] as const;

export const postRepurposeOutputs = sqliteTable(
  "post_repurpose_outputs",
  {
    id: text("id").primaryKey(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    outputType: text("output_type", {
      enum: postRepurposeOutputTypeEnum,
    }).notNull(),
    status: text("status", { enum: postRepurposeOutputStatusEnum }).notNull(),
    payloadJson: text("payload_json"),
    mediaUrl: text("media_url"),
    mediaMimeType: text("media_mime_type"),
    errorMessage: text("error_message"),
    claimToken: text("claim_token"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    uniqueIndex("post_repurpose_outputs_post_type_unique").on(
      table.postId,
      table.outputType,
    ),
  ],
);

export type PostRepurposeOutputRecord = typeof postRepurposeOutputs.$inferSelect;

export const linkedinMemberCredentials = sqliteTable("linkedin_member_credentials", {
  id: text("id").primaryKey(),
  memberSub: text("member_sub").notNull(),
  authorUrn: text("author_urn").notNull(),
  accessTokenEnc: text("access_token_enc").notNull(),
  refreshTokenEnc: text("refresh_token_enc"),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export type LinkedInMemberCredentialRecord =
  typeof linkedinMemberCredentials.$inferSelect;

export const earnAuditActionEnum = ["deposit", "withdraw"] as const;

/** Append-only audit trail for Privy Earn admin actions (written by actions PR). */
export const earnAuditLog = sqliteTable(
  "earn_audit_log",
  {
    id: text("id").primaryKey(),
    adminPrivyUserId: text("admin_privy_user_id").notNull(),
    adminWalletId: text("admin_wallet_id").notNull(),
    action: text("action", { enum: earnAuditActionEnum }).notNull(),
    vaultId: text("vault_id").notNull(),
    asset: text("asset").notNull(),
    amount: text("amount").notNull(),
    txHash: text("tx_hash"),
    status: text("status").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("earn_audit_log_created_at_idx").on(table.createdAt),
    index("earn_audit_log_vault_id_idx").on(table.vaultId),
  ],
);

export type EarnAuditLogRecord = typeof earnAuditLog.$inferSelect;

export const postWriterRoleEnum = ["author", "cowriter"] as const;
export type PostWriterRole = (typeof postWriterRoleEnum)[number];

export const postWriterStatusEnum = [
  "pending",
  "accepted",
  "removed",
] as const;
export type PostWriterStatus = (typeof postWriterStatusEnum)[number];

export const writerInviteStatusEnum = [
  "pending",
  "accepted",
  "expired",
  "revoked",
] as const;
export type WriterInviteStatus = (typeof writerInviteStatusEnum)[number];

export const writerGroupSplitStatusEnum = [
  "pending",
  "deployed",
  "failed",
] as const;
export type WriterGroupSplitStatus =
  (typeof writerGroupSplitStatusEnum)[number];

export const writerInvites = sqliteTable(
  "writer_invites",
  {
    id: text("id").primaryKey(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id),
    invitedBy: text("invited_by").notNull(),
    email: text("email"),
    wallet: text("wallet"),
    tokenHash: text("token_hash").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    acceptedWriterId: text("accepted_writer_id").references(() => authors.id),
    status: text("status", { enum: writerInviteStatusEnum })
      .notNull()
      .default("pending"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    index("writer_invites_post_id_idx").on(table.postId),
    index("writer_invites_status_idx").on(table.status),
  ],
);

export const postWriters = sqliteTable(
  "post_writers",
  {
    id: text("id").primaryKey(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id),
    writerId: text("writer_id").references(() => authors.id),
    inviteId: text("invite_id").references(() => writerInvites.id),
    role: text("role", { enum: postWriterRoleEnum }).notNull(),
    shareBps: integer("share_bps").notNull(),
    status: text("status", { enum: postWriterStatusEnum })
      .notNull()
      .default("pending"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    uniqueIndex("post_writers_post_writer_unique").on(
      table.postId,
      table.writerId,
    ),
    uniqueIndex("post_writers_post_invite_unique").on(
      table.postId,
      table.inviteId,
    ),
    index("post_writers_post_id_idx").on(table.postId),
    index("post_writers_writer_id_idx").on(table.writerId),
  ],
);

export const writerGroupSplits = sqliteTable(
  "writer_group_splits",
  {
    groupKey: text("group_key").primaryKey(),
    splitAddress: text("split_address"),
    status: text("status", { enum: writerGroupSplitStatusEnum })
      .notNull()
      .default("pending"),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [index("writer_group_splits_status_idx").on(table.status)],
);

export const postPreviewLinks = sqliteTable(
  "post_preview_links",
  {
    id: text("id").primaryKey(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id),
    tokenHash: text("token_hash").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
    createdBy: text("created_by").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" })
      .notNull()
      .default(sql`(unixepoch() * 1000)`),
  },
  (table) => [
    uniqueIndex("post_preview_links_token_hash_unique").on(table.tokenHash),
    index("post_preview_links_post_id_idx").on(table.postId),
  ],
);

export type PostWriterRecord = typeof postWriters.$inferSelect;
export type WriterInviteRecord = typeof writerInvites.$inferSelect;
export type WriterGroupSplitRecord = typeof writerGroupSplits.$inferSelect;
export type PostPreviewLinkRecord = typeof postPreviewLinks.$inferSelect;


