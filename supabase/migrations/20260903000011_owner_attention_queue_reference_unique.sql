-- Audit finding #3: insertAttentionItem() previously did a SELECT-then-INSERT to avoid
-- queuing the same message/reminder twice on a resumed retry -- a classic TOCTOU race under
-- true concurrency (two concurrent claims of the same message could both SELECT and see
-- nothing, then both INSERT). A partial unique index makes the guarantee real at the
-- database level; application code now performs a plain INSERT and treats a 23505 on this
-- index as an idempotent no-op, the same conflict-safe-write pattern already used for
-- messages(provider, provider_message_id) and automation_decision_log(message_id).
--
-- Partial (WHERE reference_id IS NOT NULL): a manual_flag entry has no reference_id and must
-- remain uniqueness-exempt -- an owner can flag the same contact for follow-up more than
-- once, and multiple such rows are not duplicates of each other.
--
-- Confirmed no existing data violates this before adding it (checked directly against the
-- live database: zero rows shared a (reference_type, reference_id) pair).
create unique index idx_owner_attention_queue_reference_unique
  on owner_attention_queue(reference_type, reference_id)
  where reference_id is not null;
