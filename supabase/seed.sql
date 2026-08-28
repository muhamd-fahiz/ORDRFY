-- Idempotent seed: safe to re-run against any environment without creating duplicates,
-- via the unique constraints already defined on each table (Ordrfy-Final-Architecture.pdf
-- Section 14).

-- Channels: WhatsApp and Instagram launch active in V1; Facebook exists as a row so the
-- adapter pattern extends to it later without any schema change.
insert into channels (name, active) values
  ('whatsapp', true),
  ('instagram', true),
  ('facebook', false)
on conflict (name) do nothing;

-- Verticals: all 5 are now content-seeded and launch-ready (Bakers & Gift Businesses
-- addendum, 2026-08-28) -- Baker and Gift flipped active=true now that their pipeline/
-- template/reminder/field content exists below.
insert into verticals (key, label, active) values
  ('fashion', 'Fashion', true),
  ('tutor', 'Tutor', true),
  ('service', 'Appointment-Based Service', true),
  ('baker', 'Baker / Custom Cake Business', true),
  ('gift', 'Personalized / Surprise Gift Business', true)
on conflict (key) do update set label = excluded.label, active = excluded.active;

-- ---------------------------------------------------------------------------
-- Fashion: New Inquiry -> Interested -> Order Confirmed -> Payment Pending ->
--          Paid -> Shipped -> Completed
-- ---------------------------------------------------------------------------
insert into pipeline_stages (business_id, vertical, stage_key, stage_label, sort_order) values
  (null, 'fashion', 'new_inquiry',      'New Inquiry',      1),
  (null, 'fashion', 'interested',       'Interested',        2),
  (null, 'fashion', 'order_confirmed',  'Order Confirmed',   3),
  (null, 'fashion', 'payment_pending',  'Payment Pending',   4),
  (null, 'fashion', 'paid',             'Paid',              5),
  (null, 'fashion', 'shipped',          'Shipped',           6),
  (null, 'fashion', 'completed',        'Completed',         7)
on conflict (business_id, vertical, stage_key) do nothing;

-- ---------------------------------------------------------------------------
-- Tutor: Parent Inquiry -> Info Sent -> Interested -> Enrolled -> Fee Due -> Paid
-- ---------------------------------------------------------------------------
insert into pipeline_stages (business_id, vertical, stage_key, stage_label, sort_order) values
  (null, 'tutor', 'parent_inquiry', 'Parent Inquiry', 1),
  (null, 'tutor', 'info_sent',      'Info Sent',       2),
  (null, 'tutor', 'interested',     'Interested',      3),
  (null, 'tutor', 'enrolled',       'Enrolled',        4),
  (null, 'tutor', 'fee_due',        'Fee Due',         5),
  (null, 'tutor', 'paid',           'Paid',            6)
on conflict (business_id, vertical, stage_key) do nothing;

-- ---------------------------------------------------------------------------
-- Service: Inquiry -> Availability Checked -> Quote Sent -> Booking Requested ->
--          Advance Pending -> Confirmed -> Reminder Sent -> Completed
-- ---------------------------------------------------------------------------
insert into pipeline_stages (business_id, vertical, stage_key, stage_label, sort_order) values
  (null, 'service', 'inquiry',               'Inquiry',               1),
  (null, 'service', 'availability_checked',  'Availability Checked',  2),
  (null, 'service', 'quote_sent',            'Quote Sent',            3),
  (null, 'service', 'booking_requested',     'Booking Requested',     4),
  (null, 'service', 'advance_pending',       'Advance Pending',       5),
  (null, 'service', 'confirmed',             'Confirmed',             6),
  (null, 'service', 'reminder_sent',         'Reminder Sent',         7),
  (null, 'service', 'completed',             'Completed',             8)
on conflict (business_id, vertical, stage_key) do nothing;

-- ---------------------------------------------------------------------------
-- Baker: New Inquiry -> Requirements Collected -> Quote Sent -> Awaiting Confirmation ->
--        Awaiting Advance Payment -> Order Confirmed -> Preparing ->
--        Ready for Pickup/Delivery -> Out for Delivery -> Completed -> Cancelled
-- ---------------------------------------------------------------------------
insert into pipeline_stages (business_id, vertical, stage_key, stage_label, sort_order) values
  (null, 'baker', 'new_inquiry',              'New Inquiry',                   1),
  (null, 'baker', 'requirements_collected',   'Requirements Collected',        2),
  (null, 'baker', 'quote_sent',               'Quote Sent',                    3),
  (null, 'baker', 'awaiting_confirmation',    'Awaiting Customer Confirmation',4),
  (null, 'baker', 'awaiting_advance_payment', 'Awaiting Advance Payment',      5),
  (null, 'baker', 'order_confirmed',          'Order Confirmed',               6),
  (null, 'baker', 'preparing',                'Preparing',                     7),
  (null, 'baker', 'ready_for_pickup_delivery','Ready for Pickup / Delivery',   8),
  (null, 'baker', 'out_for_delivery',         'Out for Delivery',              9),
  (null, 'baker', 'completed',                'Completed',                    10),
  (null, 'baker', 'cancelled',                'Cancelled',                    11)
on conflict (business_id, vertical, stage_key) do nothing;

-- ---------------------------------------------------------------------------
-- Gift: New Inquiry -> Occasion/Recipient Collected -> Requirements Collected ->
--       Options/Quote Sent -> Customization Pending -> Awaiting Confirmation ->
--       Awaiting Advance Payment -> Order Confirmed -> Preparing/Personalizing ->
--       Ready -> Dispatched -> Delivered -> Completed -> Cancelled
-- ---------------------------------------------------------------------------
insert into pipeline_stages (business_id, vertical, stage_key, stage_label, sort_order) values
  (null, 'gift', 'new_inquiry',               'New Inquiry',                          1),
  (null, 'gift', 'occasion_recipient_collected','Occasion / Recipient Details Collected',2),
  (null, 'gift', 'requirements_collected',    'Gift Requirements Collected',          3),
  (null, 'gift', 'options_quote_sent',        'Options / Quote Sent',                 4),
  (null, 'gift', 'customization_pending',     'Customization Pending',                5),
  (null, 'gift', 'awaiting_confirmation',     'Awaiting Customer Confirmation',       6),
  (null, 'gift', 'awaiting_advance_payment',  'Awaiting Advance Payment',             7),
  (null, 'gift', 'order_confirmed',           'Order Confirmed',                      8),
  (null, 'gift', 'preparing_personalizing',   'Preparing / Personalizing',            9),
  (null, 'gift', 'ready',                     'Ready',                                10),
  (null, 'gift', 'dispatched',                'Dispatched / Out for Delivery',        11),
  (null, 'gift', 'delivered',                 'Delivered',                            12),
  (null, 'gift', 'completed',                 'Completed',                            13),
  (null, 'gift', 'cancelled',                 'Cancelled',                            14)
on conflict (business_id, vertical, stage_key) do nothing;

-- ---------------------------------------------------------------------------
-- Vertical-specific order fields (Bakers & Gift Businesses addendum). Payment fields
-- (total/advance/balance/status/due date) are deliberately NOT duplicated here -- they map
-- directly onto the existing generic `payments` table (amount_due, amount_paid, status,
-- due_date); advance received is just a partial amount_paid, balance is amount_due -
-- amount_paid computed on the fly. Reminder-timing fields (quote follow-up date, advance
-- reminder date, etc.) are also not stored here -- they're reminder_type values on the
-- `reminders` table, with timing configured via business_settings, not order data.
-- select_options are vertical-wide defaults (this table has no business_id column, per its
-- own design) -- a business needing a different flavour list is a Build Phase 3+ UI
-- question, not a V1 requirement per the addendum.
-- ---------------------------------------------------------------------------
insert into vertical_field_definitions (vertical, field_key, field_label, field_type, select_options, is_required, sort_order, active) values
  ('baker', 'occasion', 'Occasion', 'text', null, false, 1, true),
  ('baker', 'cake_flavour', 'Cake Flavour', 'select',
    array['Chocolate','Vanilla','Butterscotch','Red Velvet','Black Forest','Pineapple','Other'], true, 2, true),
  ('baker', 'cake_size_weight', 'Cake Size / Weight', 'text', null, true, 3, true),
  ('baker', 'egg_or_eggless', 'Egg / Eggless', 'select', array['Egg','Eggless'], true, 4, true),
  ('baker', 'custom_design_requirements', 'Custom Design Requirements', 'text', null, false, 5, true),
  ('baker', 'design_reference_notes', 'Reference Image / Design Notes', 'text', null, false, 6, true),
  ('baker', 'cake_message', 'Message to Write on Cake', 'text', null, false, 7, true),
  ('baker', 'quantity', 'Quantity', 'number', null, true, 8, true),
  ('baker', 'pickup_or_delivery', 'Pickup or Delivery', 'select', array['Pickup','Delivery'], true, 9, true),
  ('baker', 'delivery_pickup_date', 'Delivery / Pickup Date', 'date', null, true, 10, true),
  ('baker', 'delivery_pickup_time', 'Delivery / Pickup Time', 'text', null, false, 11, true),
  ('baker', 'delivery_address', 'Delivery Address', 'text', null, false, 12, true),
  ('baker', 'additional_notes', 'Additional Notes', 'text', null, false, 13, true)
on conflict (vertical, field_key) do update set
  field_label = excluded.field_label, field_type = excluded.field_type,
  select_options = excluded.select_options, is_required = excluded.is_required,
  sort_order = excluded.sort_order, active = excluded.active;

insert into vertical_field_definitions (vertical, field_key, field_label, field_type, select_options, is_required, sort_order, active) values
  ('gift', 'recipient_name', 'Recipient Name', 'text', null, false, 1, true),
  ('gift', 'recipient_relationship', 'Recipient Relationship', 'select',
    array['Husband','Wife','Mother','Father','Friend','Boyfriend','Girlfriend','Child','Other'], false, 2, true),
  ('gift', 'occasion', 'Occasion', 'select',
    array['Birthday','Anniversary','Friendship','Mother''s Day','Father''s Day','Valentine''s Day','Surprise','Thank You','Other'], true, 3, true),
  ('gift', 'gift_type', 'Gift Type', 'text', null, false, 4, true),
  ('gift', 'budget_range', 'Budget Range', 'text', null, false, 5, true),
  ('gift', 'personalization_required', 'Personalization Required', 'boolean', null, false, 6, true),
  ('gift', 'name_to_include', 'Name to Include', 'text', null, false, 7, true),
  ('gift', 'custom_message', 'Custom Message', 'text', null, false, 8, true),
  ('gift', 'gift_notes', 'Gift Notes', 'text', null, false, 9, true),
  ('gift', 'quantity', 'Quantity', 'number', null, true, 10, true),
  ('gift', 'special_instructions', 'Special Instructions', 'text', null, false, 11, true),
  ('gift', 'surprise_required', 'Surprise Required', 'boolean', null, false, 12, true),
  ('gift', 'delivery_date', 'Delivery Date', 'date', null, true, 13, true),
  ('gift', 'delivery_time', 'Delivery Time', 'text', null, false, 14, true),
  ('gift', 'delivery_address', 'Delivery Address', 'text', null, false, 15, true),
  ('gift', 'recipient_delivery_details', 'Recipient Delivery Details', 'text', null, false, 16, true),
  ('gift', 'special_delivery_instructions', 'Special Delivery Instructions', 'text', null, false, 17, true)
on conflict (vertical, field_key) do update set
  field_label = excluded.field_label, field_type = excluded.field_type,
  select_options = excluded.select_options, is_required = excluded.is_required,
  sort_order = excluded.sort_order, active = excluded.active;

-- ---------------------------------------------------------------------------
-- Internal reply rules (starter set -- expanded with real customer-interview-informed
-- content in Build Phase 3, per the prompt's explicit "not placeholder text" requirement).
-- trigger_priority resolves ambiguity when a message matches more than one rule; equal
-- priority + multiple matches always falls back to Needs Owner Attention, never a guess.
-- ---------------------------------------------------------------------------
insert into internal_reply_rules (business_id, vertical, rule_key, trigger_keywords, trigger_priority, reply_text, active) values
  (null, 'fashion', 'fashion_price', array['price', 'cost', 'how much', 'rate'], 10,
    'Thanks for asking! Could you tell us which item/style you''re interested in so we can share the exact price?', true),
  (null, 'fashion', 'fashion_size', array['size', 'available', 'in stock'], 10,
    'Let us know the item and your size, and we''ll confirm availability right away.', true),
  (null, 'fashion', 'fashion_delivery', array['delivery', 'shipping', 'cod'], 8,
    'We deliver across India. Cash on delivery is available in select areas -- share your pincode and we''ll confirm.', true),

  (null, 'tutor', 'tutor_timing', array['timing', 'timings', 'schedule'], 10,
    'We run batches in the morning and evening -- let us know your preferred time and we''ll share available slots.', true),
  (null, 'tutor', 'tutor_fee', array['fee', 'fees', 'monthly fee', 'cost'], 10,
    'Thanks for asking! Could you share which subject/class you''re interested in so we can share the exact monthly fee?', true),
  (null, 'tutor', 'tutor_trial', array['trial', 'trial class', 'demo'], 8,
    'Yes, we offer a trial class! Let us know a convenient day and time and we''ll set it up.', true),

  (null, 'service', 'service_availability', array['available', 'availability', 'free on'], 10,
    'Could you share the date you have in mind? We''ll check availability and get back to you.', true),
  (null, 'service', 'service_package', array['package', 'packages', 'price', 'cost'], 10,
    'Thanks for reaching out! Could you share a bit about what you need so we can share the right package and price?', true),
  (null, 'service', 'service_travel', array['travel', 'come to', 'at home', 'at my place'], 8,
    'Yes, we do offer at-location service in select areas -- let us know your location and we''ll confirm.', true),

  (null, 'baker', 'baker_price', array['price', 'cost', 'how much', 'rate'], 10,
    'Thanks for reaching out! Could you share the occasion, size, and flavour you have in mind so we can share the exact price?', true),
  (null, 'baker', 'baker_flavour', array['flavour', 'flavor', 'taste', 'options'], 10,
    'We have Chocolate, Vanilla, Butterscotch, Red Velvet, Black Forest, and Pineapple -- let us know your favourite!', true),
  (null, 'baker', 'baker_eggless', array['eggless', 'without egg', 'egg or eggless'], 9,
    'Yes, eggless is available! Let us know if you''d like egg or eggless for your order.', true),
  (null, 'baker', 'baker_availability', array['available', 'availability', 'free on'], 10,
    'Could you share the date you need the cake for? We''ll check availability and get back to you.', true),
  (null, 'baker', 'baker_delivery', array['delivery', 'deliver', 'pickup'], 8,
    'We offer both pickup and delivery -- let us know your preference and location and we''ll confirm.', true),
  (null, 'baker', 'baker_custom_design', array['custom design', 'design', 'photo cake', 'theme cake'], 9,
    'We''d love to make that for you! Could you share a reference photo or describe the design you have in mind?', true),

  (null, 'gift', 'gift_recommendation', array['what gifts', 'recommend', 'suggestion', 'options'], 10,
    'We''d love to help! Could you share the occasion and who the gift is for so we can suggest the best options?', true),
  (null, 'gift', 'gift_budget', array['budget', 'price range', 'how much', 'cost'], 10,
    'Sure! What budget range did you have in mind? That''ll help us suggest the best options.', true),
  (null, 'gift', 'gift_personalization', array['personalize', 'personalise', 'customize', 'customise', 'add name', 'engrave'], 9,
    'Yes, we can personalize this! Let us know the name or message you''d like included.', true),
  (null, 'gift', 'gift_surprise', array['surprise', 'secret delivery', 'without them knowing'], 9,
    'Yes, we can arrange a surprise delivery! Let us know the date, time, and any special instructions.', true),
  (null, 'gift', 'gift_delivery', array['delivery date', 'deliver on', 'delivery time'], 8,
    'Could you share the date and time you need this delivered by? We''ll confirm availability.', true)
on conflict (business_id, vertical, rule_key, language) do update set
  trigger_keywords = excluded.trigger_keywords,
  trigger_priority = excluded.trigger_priority,
  reply_text = excluded.reply_text,
  active = excluded.active;

-- ---------------------------------------------------------------------------
-- Opt-out keyword detection (India-fit addendum #11). Checked before internal_reply_rules
-- matching on every inbound message -- an opt-out phrase always wins. English + Hindi
-- seeded at launch per addendum #10's "even if only en/hi ship first."
-- ---------------------------------------------------------------------------
insert into opt_out_keywords (business_id, language, keyword, active) values
  (null, 'en', 'stop', true),
  (null, 'en', 'unsubscribe', true),
  (null, 'en', 'do not contact', true),
  (null, 'en', 'remove me', true),
  (null, 'hi', 'band karo', true),
  (null, 'hi', 'mat bhejo', true)
on conflict (business_id, language, keyword) do update set active = excluded.active;

-- ---------------------------------------------------------------------------
-- Reminder templates (starter set). WhatsApp rows are seeded with approval_status
-- 'not_submitted' -- meta_template_id stays null until the real template is actually
-- submitted and approved via Meta Business Manager (Build Phase 4). All are category
-- 'utility', enforced by the reminder-template-category guard trigger. Instagram rows
-- carry reply_text only, used when the window is open or WhatsApp consent has been granted
-- (docs/decisions/2026-08-28-instagram-whatsapp-consent-routing.md).
-- ---------------------------------------------------------------------------
insert into message_templates (
  business_id, vertical, channel_id, template_key, category, approval_status, reply_text, active
) values
  (null, 'fashion', (select id from channels where name = 'whatsapp'), 'fashion_payment_due',
    'utility', 'not_submitted', null, true),
  (null, 'fashion', (select id from channels where name = 'instagram'), 'fashion_payment_due',
    null, null, 'Hi! Just a friendly reminder that payment for your order is still pending. Let us know if you have any questions!', true),

  (null, 'tutor', (select id from channels where name = 'whatsapp'), 'tutor_fee_due',
    'utility', 'not_submitted', null, true),
  (null, 'tutor', (select id from channels where name = 'instagram'), 'tutor_fee_due',
    null, null, 'Hi! This month''s fee is due -- let us know once it''s paid, or reach out if you have questions.', true),

  (null, 'service', (select id from channels where name = 'whatsapp'), 'service_appointment',
    'utility', 'not_submitted', null, true),
  (null, 'service', (select id from channels where name = 'instagram'), 'service_appointment',
    null, null, 'Hi! Just a reminder about your upcoming appointment. Reply if you need to reschedule.', true)
on conflict (business_id, vertical, channel_id, template_key, language) do update set
  category = excluded.category,
  approval_status = excluded.approval_status,
  reply_text = excluded.reply_text,
  active = excluded.active;

-- ---------------------------------------------------------------------------
-- Baker: reminder-triggering templates (category=utility, matches the 6 reminder_type
-- values used by the reminder engine) + owner-selectable quick-send milestone templates
-- (category=null -- naturally within-window sends, free-form on both channels, no Meta
-- approval needed; not tied to any reminders row). "Price Information Response" and
-- "Availability Response" from the source addendum are deliberately NOT duplicated here --
-- they're already covered by the baker_price/baker_availability internal_reply_rules above.
-- ---------------------------------------------------------------------------
insert into message_templates (
  business_id, vertical, channel_id, template_key, category, approval_status, reply_text, active
) values
  -- Reminder-triggering (reminder_type: quote_followup, advance_due, preparation_deadline, pickup_reminder, delivery_reminder, balance_due)
  (null, 'baker', (select id from channels where name = 'whatsapp'), 'baker_quote_followup', 'utility', 'not_submitted', null, true),
  (null, 'baker', (select id from channels where name = 'instagram'), 'baker_quote_followup', null, null,
    'Hi! Just checking in on the cake quote we sent -- let us know if you''d like to go ahead or have any questions!', true),
  (null, 'baker', (select id from channels where name = 'whatsapp'), 'baker_advance_due', 'utility', 'not_submitted', null, true),
  (null, 'baker', (select id from channels where name = 'instagram'), 'baker_advance_due', null, null,
    'Hi! To confirm your cake order, we''ll need the advance payment -- let us know once it''s done.', true),
  (null, 'baker', (select id from channels where name = 'whatsapp'), 'baker_preparation_deadline', 'utility', 'not_submitted', null, true),
  (null, 'baker', (select id from channels where name = 'instagram'), 'baker_preparation_deadline', null, null,
    'Hi! Your cake order date is approaching -- we''re getting started on preparation soon. Let us know if any details have changed.', true),
  (null, 'baker', (select id from channels where name = 'whatsapp'), 'baker_pickup_reminder', 'utility', 'not_submitted', null, true),
  (null, 'baker', (select id from channels where name = 'instagram'), 'baker_pickup_reminder', null, null,
    'Hi! Just a reminder that your cake is ready for pickup soon. Let us know if you have any questions.', true),
  (null, 'baker', (select id from channels where name = 'whatsapp'), 'baker_delivery_reminder', 'utility', 'not_submitted', null, true),
  (null, 'baker', (select id from channels where name = 'instagram'), 'baker_delivery_reminder', null, null,
    'Hi! Your cake delivery is coming up soon -- we''ll keep you posted on timing.', true),
  (null, 'baker', (select id from channels where name = 'whatsapp'), 'baker_balance_due', 'utility', 'not_submitted', null, true),
  (null, 'baker', (select id from channels where name = 'instagram'), 'baker_balance_due', null, null,
    'Hi! Hope you loved the cake! The remaining balance is still pending -- let us know once it''s settled.', true),

  -- Owner-selectable quick-send milestone templates
  (null, 'baker', (select id from channels where name = 'whatsapp'), 'baker_welcome', null, null,
    'Thanks for reaching out! We''d love to make your custom cake -- could you share the occasion, size, and flavour you have in mind?', true),
  (null, 'baker', (select id from channels where name = 'instagram'), 'baker_welcome', null, null,
    'Thanks for reaching out! We''d love to make your custom cake -- could you share the occasion, size, and flavour you have in mind?', true),
  (null, 'baker', (select id from channels where name = 'whatsapp'), 'baker_quote_sent', null, null,
    'Here''s your quote based on what you shared. Let us know if you''d like to go ahead!', true),
  (null, 'baker', (select id from channels where name = 'instagram'), 'baker_quote_sent', null, null,
    'Here''s your quote based on what you shared. Let us know if you''d like to go ahead!', true),
  (null, 'baker', (select id from channels where name = 'whatsapp'), 'baker_advance_payment_request', null, null,
    'To confirm your order, please send the advance payment -- let us know once it''s done and we''ll get started!', true),
  (null, 'baker', (select id from channels where name = 'instagram'), 'baker_advance_payment_request', null, null,
    'To confirm your order, please send the advance payment -- let us know once it''s done and we''ll get started!', true),
  (null, 'baker', (select id from channels where name = 'whatsapp'), 'baker_order_confirmation', null, null,
    'Your order is confirmed! We''ll keep you updated as we prepare your cake.', true),
  (null, 'baker', (select id from channels where name = 'instagram'), 'baker_order_confirmation', null, null,
    'Your order is confirmed! We''ll keep you updated as we prepare your cake.', true),
  (null, 'baker', (select id from channels where name = 'whatsapp'), 'baker_preparation_update', null, null,
    'Quick update: your cake is being prepared! We''ll let you know once it''s ready.', true),
  (null, 'baker', (select id from channels where name = 'instagram'), 'baker_preparation_update', null, null,
    'Quick update: your cake is being prepared! We''ll let you know once it''s ready.', true),
  (null, 'baker', (select id from channels where name = 'whatsapp'), 'baker_pickup_ready', null, null,
    'Good news -- your cake is ready for pickup! Let us know when you''ll be by.', true),
  (null, 'baker', (select id from channels where name = 'instagram'), 'baker_pickup_ready', null, null,
    'Good news -- your cake is ready for pickup! Let us know when you''ll be by.', true),
  (null, 'baker', (select id from channels where name = 'whatsapp'), 'baker_out_for_delivery', null, null,
    'Your cake is out for delivery! It should reach you shortly.', true),
  (null, 'baker', (select id from channels where name = 'instagram'), 'baker_out_for_delivery', null, null,
    'Your cake is out for delivery! It should reach you shortly.', true),
  (null, 'baker', (select id from channels where name = 'whatsapp'), 'baker_delivery_confirmation', null, null,
    'Your cake has been delivered! We hope you love it -- happy celebrating!', true),
  (null, 'baker', (select id from channels where name = 'instagram'), 'baker_delivery_confirmation', null, null,
    'Your cake has been delivered! We hope you love it -- happy celebrating!', true),
  (null, 'baker', (select id from channels where name = 'whatsapp'), 'baker_thank_you', null, null,
    'Thank you so much for your order! We''d love to bake for you again.', true),
  (null, 'baker', (select id from channels where name = 'instagram'), 'baker_thank_you', null, null,
    'Thank you so much for your order! We''d love to bake for you again.', true)
on conflict (business_id, vertical, channel_id, template_key, language) do update set
  category = excluded.category,
  approval_status = excluded.approval_status,
  reply_text = excluded.reply_text,
  active = excluded.active;

-- ---------------------------------------------------------------------------
-- Gift Business: reminder-triggering templates (category=utility, matches the 7
-- reminder_type values) + owner-selectable quick-send milestone templates. "Gift
-- Recommendation/Options Response," "Budget Information Request," and "Personalization
-- Details Request" from the source addendum are deliberately NOT duplicated here -- already
-- covered by the gift_recommendation/gift_budget/gift_personalization internal_reply_rules.
-- ---------------------------------------------------------------------------
insert into message_templates (
  business_id, vertical, channel_id, template_key, category, approval_status, reply_text, active
) values
  -- Reminder-triggering (reminder_type: followup_after_options, customization_confirmation, advance_due, preparation_deadline, special_date_reminder, delivery_reminder, balance_due)
  (null, 'gift', (select id from channels where name = 'whatsapp'), 'gift_followup_after_options', 'utility', 'not_submitted', null, true),
  (null, 'gift', (select id from channels where name = 'instagram'), 'gift_followup_after_options', null, null,
    'Hi! Just checking in on the gift options we shared -- let us know if you''d like to go ahead or need anything else.', true),
  (null, 'gift', (select id from channels where name = 'whatsapp'), 'gift_customization_confirmation', 'utility', 'not_submitted', null, true),
  (null, 'gift', (select id from channels where name = 'instagram'), 'gift_customization_confirmation', null, null,
    'Hi! We still need a few personalization details to finalize your gift -- could you confirm them when you get a chance?', true),
  (null, 'gift', (select id from channels where name = 'whatsapp'), 'gift_advance_due', 'utility', 'not_submitted', null, true),
  (null, 'gift', (select id from channels where name = 'instagram'), 'gift_advance_due', null, null,
    'Hi! To confirm your gift order, we''ll need the advance payment -- let us know once it''s done.', true),
  (null, 'gift', (select id from channels where name = 'whatsapp'), 'gift_preparation_deadline', 'utility', 'not_submitted', null, true),
  (null, 'gift', (select id from channels where name = 'instagram'), 'gift_preparation_deadline', null, null,
    'Hi! Your gift''s delivery date is approaching -- we''re getting started on preparation. Let us know if anything has changed.', true),
  (null, 'gift', (select id from channels where name = 'whatsapp'), 'gift_special_date_reminder', 'utility', 'not_submitted', null, true),
  (null, 'gift', (select id from channels where name = 'instagram'), 'gift_special_date_reminder', null, null,
    'Hi! Just a heads-up that the special date for this gift is coming up soon -- everything''s on track.', true),
  (null, 'gift', (select id from channels where name = 'whatsapp'), 'gift_delivery_reminder', 'utility', 'not_submitted', null, true),
  (null, 'gift', (select id from channels where name = 'instagram'), 'gift_delivery_reminder', null, null,
    'Hi! Your gift delivery is coming up soon -- we''ll keep you posted on timing.', true),
  (null, 'gift', (select id from channels where name = 'whatsapp'), 'gift_balance_due', 'utility', 'not_submitted', null, true),
  (null, 'gift', (select id from channels where name = 'instagram'), 'gift_balance_due', null, null,
    'Hi! Hope the gift was a hit! The remaining balance is still pending -- let us know once it''s settled.', true),

  -- Owner-selectable quick-send milestone templates
  (null, 'gift', (select id from channels where name = 'whatsapp'), 'gift_welcome', null, null,
    'Thanks for reaching out! We''d love to help you find the perfect gift -- could you share the occasion and who it''s for?', true),
  (null, 'gift', (select id from channels where name = 'instagram'), 'gift_welcome', null, null,
    'Thanks for reaching out! We''d love to help you find the perfect gift -- could you share the occasion and who it''s for?', true),
  (null, 'gift', (select id from channels where name = 'whatsapp'), 'gift_quote_sent', null, null,
    'Here''s your quote based on what you shared. Let us know if you''d like to go ahead!', true),
  (null, 'gift', (select id from channels where name = 'instagram'), 'gift_quote_sent', null, null,
    'Here''s your quote based on what you shared. Let us know if you''d like to go ahead!', true),
  (null, 'gift', (select id from channels where name = 'whatsapp'), 'gift_advance_payment_request', null, null,
    'To confirm your order, please send the advance payment -- let us know once it''s done and we''ll get started!', true),
  (null, 'gift', (select id from channels where name = 'instagram'), 'gift_advance_payment_request', null, null,
    'To confirm your order, please send the advance payment -- let us know once it''s done and we''ll get started!', true),
  (null, 'gift', (select id from channels where name = 'whatsapp'), 'gift_order_confirmation', null, null,
    'Your order is confirmed! We''ll keep you updated as we prepare your gift.', true),
  (null, 'gift', (select id from channels where name = 'instagram'), 'gift_order_confirmation', null, null,
    'Your order is confirmed! We''ll keep you updated as we prepare your gift.', true),
  (null, 'gift', (select id from channels where name = 'whatsapp'), 'gift_preparation_update', null, null,
    'Quick update: your gift is being prepared and personalized! We''ll let you know once it''s ready.', true),
  (null, 'gift', (select id from channels where name = 'instagram'), 'gift_preparation_update', null, null,
    'Quick update: your gift is being prepared and personalized! We''ll let you know once it''s ready.', true),
  (null, 'gift', (select id from channels where name = 'whatsapp'), 'gift_ready_for_delivery', null, null,
    'Good news -- your gift is ready! We''ll dispatch it as scheduled.', true),
  (null, 'gift', (select id from channels where name = 'instagram'), 'gift_ready_for_delivery', null, null,
    'Good news -- your gift is ready! We''ll dispatch it as scheduled.', true),
  (null, 'gift', (select id from channels where name = 'whatsapp'), 'gift_out_for_delivery', null, null,
    'Your gift is out for delivery! It should arrive shortly.', true),
  (null, 'gift', (select id from channels where name = 'instagram'), 'gift_out_for_delivery', null, null,
    'Your gift is out for delivery! It should arrive shortly.', true),
  (null, 'gift', (select id from channels where name = 'whatsapp'), 'gift_delivered_confirmation', null, null,
    'Your gift has been delivered! We hope it brought a smile.', true),
  (null, 'gift', (select id from channels where name = 'instagram'), 'gift_delivered_confirmation', null, null,
    'Your gift has been delivered! We hope it brought a smile.', true),
  (null, 'gift', (select id from channels where name = 'whatsapp'), 'gift_thank_you', null, null,
    'Thank you so much for your order! We''d love to help with your next special occasion too.', true),
  (null, 'gift', (select id from channels where name = 'instagram'), 'gift_thank_you', null, null,
    'Thank you so much for your order! We''d love to help with your next special occasion too.', true)
on conflict (business_id, vertical, channel_id, template_key, language) do update set
  category = excluded.category,
  approval_status = excluded.approval_status,
  reply_text = excluded.reply_text,
  active = excluded.active;
