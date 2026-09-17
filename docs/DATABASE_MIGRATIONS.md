# Clean Supabase Migration History

Supabase project:

```text
wzrqlquspbipvrzidcxe
```

The live clean project currently reports these migrations:

| Version | Migration |
|---|---|
| 20260917000244 | create_core_catalogue_and_store_config |
| 20260917000255 | tighten_core_security_functions |
| 20260917000300 | remove_public_admin_helper |
| 20260917003105 | complete_checkout_state_machine |
| 20260917003109 | schedule_reservation_expiry |
| 20260917003139 | tighten_checkout_function_grants |
| 20260917003155 | move_privileged_functions_private |
| 20260917003216 | polish_rls_and_indexes |
| 20260917063908 | make_paystack_attempt_creation_idempotent |
| 20260917064239 | preserve_pending_paystack_statuses |

The final two migration files are now mirrored under `supabase/migrations/` in this repository.

The first eight migrations were applied to the clean Supabase project before the migration source was mirrored into this repository. Their database effects have been verified against the live project, but their original SQL files are not yet present in GitHub. Reconstructing and committing those eight baseline migration files is therefore a release-gate task; the current live database remains the authoritative runtime database until that source synchronization is complete.

Do not treat the migration list alone as a substitute for the missing baseline SQL. The goal is eventual reproducibility: a fresh Supabase project should be buildable from repository migrations without depending on undocumented dashboard state.
