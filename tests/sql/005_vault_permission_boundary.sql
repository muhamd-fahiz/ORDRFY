-- Confirms the Vault credential functions (20260828120026) are reachable only by
-- service_role -- the fix for the default-ACL grant leak documented in
-- docs/decisions/2026-08-28-encryption-and-credentials-hardening.md: Supabase's platform
-- grants EXECUTE on new public-schema functions directly to anon/authenticated, so a plain
-- `revoke ... from public` alone is not enough; anon and authenticated must be revoked by
-- name too.
begin;

create or replace function pg_temp.assert(condition boolean, message text)
returns void language plpgsql as $$
begin
  if not condition then
    raise exception 'ASSERTION FAILED: %', message;
  end if;
end;
$$;

-- anon must be denied.
set local role anon;
do $$
declare
  call_succeeded boolean := false;
begin
  begin
    perform store_provider_credential('ci_test_secret_anon', 'should-not-be-stored', null);
    call_succeeded := true;
  exception when others then
    call_succeeded := false;
  end;
  if call_succeeded then
    raise exception 'ASSERTION FAILED: anon must not be able to call store_provider_credential';
  end if;
end $$;
reset role;

-- authenticated must be denied too -- credential access has no legitimate client-side path.
set local role authenticated;
do $$
declare
  call_succeeded boolean := false;
begin
  begin
    perform store_provider_credential('ci_test_secret_authenticated', 'should-not-be-stored', null);
    call_succeeded := true;
  exception when others then
    call_succeeded := false;
  end;
  if call_succeeded then
    raise exception 'ASSERTION FAILED: authenticated must not be able to call store_provider_credential';
  end if;
end $$;
reset role;

-- service_role is the one sanctioned caller -- full store/get/update/delete round trip.
set local role service_role;

select pg_temp.assert(
  store_provider_credential('ci_test_secret_service_role', 'super-secret-token-value', 'CI permission-boundary test secret') is not null,
  'service_role should be able to store a credential and receive back a secret id'
);

do $$
declare
  v_secret_id uuid;
  v_value text;
begin
  select store_provider_credential('ci_test_secret_roundtrip', 'roundtrip-value-1', null) into v_secret_id;

  select get_provider_credential(v_secret_id) into v_value;
  if v_value is distinct from 'roundtrip-value-1' then
    raise exception 'ASSERTION FAILED: get_provider_credential did not return the value that was stored';
  end if;

  perform update_provider_credential(v_secret_id, 'roundtrip-value-2');
  select get_provider_credential(v_secret_id) into v_value;
  if v_value is distinct from 'roundtrip-value-2' then
    raise exception 'ASSERTION FAILED: update_provider_credential did not update the stored value';
  end if;

  perform delete_provider_credential(v_secret_id);

  -- get_provider_credential does a plain (non-STRICT) SELECT INTO -- on zero matching rows
  -- that leaves the variable NULL rather than raising, so the post-delete contract is "the
  -- credential resolves to NULL," not "the call throws."
  select get_provider_credential(v_secret_id) into v_value;
  if v_value is not null then
    raise exception 'ASSERTION FAILED: get_provider_credential should return NULL after delete_provider_credential, got %', v_value;
  end if;
end $$;

reset role;

do $$ begin raise notice 'Vault credential permission-boundary test: PASSED'; end $$;

rollback;
