import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

/**
 * Exactly one value_* column is populated per order_field_values row, matching the
 * referenced field's field_type (enforced at the application layer, not a DB CHECK -- see
 * the table's own schema comment). Renders each type as a plain string for display; this
 * screen doesn't edit field values, so no reverse mapping back to a typed value is needed.
 */
function extractFieldValue(row: {
  value_text: string | null;
  value_number: number | null;
  value_boolean: boolean | null;
  value_date: string | null;
}): string | null {
  if (row.value_text !== null) return row.value_text;
  if (row.value_number !== null) return row.value_number.toString();
  if (row.value_boolean !== null) return row.value_boolean ? "Yes" : "No";
  if (row.value_date !== null) return row.value_date;
  return null;
}

export interface ContactDetailStage {
  id: string;
  stageLabel: string;
  sortOrder: number;
}

export interface ContactDetailField {
  fieldKey: string;
  fieldLabel: string;
  fieldType: string;
  value: string | null;
}

export interface ContactDetailPayment {
  id: string;
  orderReference: string | null;
  amountDue: number;
  amountPaid: number;
  status: string;
  dueDate: string | null;
}

export interface ContactDetailData {
  id: string;
  name: string;
  currentStageId: string | null;
  availableStages: ContactDetailStage[];
  verticalFields: ContactDetailField[];
  payments: ContactDetailPayment[];
}

/**
 * Reads through an RLS-scoped client, same as lib/data/today.ts -- every query below is
 * naturally confined to the caller's own business via each table's tenant-isolation policy
 * (contacts, order_field_values, payments) or a globally-readable policy scoped by vertical
 * (pipeline_stages, vertical_field_definitions), never widened by application code.
 */
export async function getContactDetail(
  supabase: SupabaseClient<Database>,
  businessId: string,
  vertical: string,
  contactId: string,
): Promise<ContactDetailData | null> {
  const { data: contact, error: contactError } = await supabase
    .from("contacts")
    .select("id, name, pipeline_stage_id")
    .eq("id", contactId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (contactError) throw new Error(`Failed to load contact: ${contactError.message}`);
  if (!contact) return null;

  const [
    { data: businessStages, error: businessStagesError },
    { data: verticalDefaultStages, error: verticalStagesError },
  ] = await Promise.all([
    supabase
      .from("pipeline_stages")
      .select("id, stage_label, sort_order")
      .eq("business_id", businessId)
      .order("sort_order"),
    supabase
      .from("pipeline_stages")
      .select("id, stage_label, sort_order")
      .is("business_id", null)
      .eq("vertical", vertical)
      .order("sort_order"),
  ]);
  if (businessStagesError) throw new Error(`Failed to load business pipeline stages: ${businessStagesError.message}`);
  if (verticalStagesError) throw new Error(`Failed to load vertical default pipeline stages: ${verticalStagesError.message}`);
  // Business-specific overrides take precedence over vertical defaults, matching the same
  // pattern used for internal_reply_rules/message_templates elsewhere in the schema.
  const availableStages: ContactDetailStage[] =
    businessStages && businessStages.length > 0
      ? businessStages.map((s) => ({ id: s.id, stageLabel: s.stage_label, sortOrder: s.sort_order }))
      : (verticalDefaultStages ?? []).map((s) => ({ id: s.id, stageLabel: s.stage_label, sortOrder: s.sort_order }));

  const [{ data: fieldDefs, error: fieldDefsError }, { data: fieldValues, error: fieldValuesError }, { data: payments, error: paymentsError }] =
    await Promise.all([
      supabase
        .from("vertical_field_definitions")
        .select("id, field_key, field_label, field_type, sort_order")
        .eq("vertical", vertical)
        .eq("active", true)
        .order("sort_order"),
      supabase
        .from("order_field_values")
        .select("field_definition_id, value_text, value_number, value_boolean, value_date")
        .eq("contact_id", contactId),
      supabase
        .from("payments")
        .select("id, order_reference, amount_due, amount_paid, status, due_date")
        .eq("contact_id", contactId)
        .order("due_date", { ascending: true, nullsFirst: false }),
    ]);
  if (fieldDefsError) throw new Error(`Failed to load field definitions: ${fieldDefsError.message}`);
  if (fieldValuesError) throw new Error(`Failed to load field values: ${fieldValuesError.message}`);
  if (paymentsError) throw new Error(`Failed to load payments: ${paymentsError.message}`);

  const valueByFieldDefId = new Map((fieldValues ?? []).map((v) => [v.field_definition_id, v]));

  const verticalFields: ContactDetailField[] = (fieldDefs ?? []).map((def) => {
    const row = valueByFieldDefId.get(def.id);
    return {
      fieldKey: def.field_key,
      fieldLabel: def.field_label,
      fieldType: def.field_type,
      value: row ? extractFieldValue(row) : null,
    };
  });

  return {
    id: contact.id,
    name: contact.name ?? "Unnamed contact",
    currentStageId: contact.pipeline_stage_id,
    availableStages,
    verticalFields,
    payments: (payments ?? []).map((p) => ({
      id: p.id,
      orderReference: p.order_reference,
      amountDue: Number(p.amount_due),
      amountPaid: Number(p.amount_paid),
      status: p.status,
      dueDate: p.due_date,
    })),
  };
}
