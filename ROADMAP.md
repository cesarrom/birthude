# Roadmap

The invitation builder, per-guest RSVP pages, raffle, trivia and payment flows work. This file lists what comes next, in rough priority order.

## Next

- [ ] **Automated tests** (the first gap to close): unit tests for RSVP and slot assignment, and for payment callbacks; an end-to-end test of create invitation, share link, guest RSVP.
- [ ] **CI**: a GitHub Actions workflow that runs type checks, lint and the tests on every pull request.
- [ ] **Payments hardening**: make dLocal Go and PayPal callbacks idempotent and test them against the providers' sandboxes, including failed and refunded payments.
- [ ] **Translation coverage check**: a script that fails when a key exists in `messages/en` but not in `es`, `fr` or `pt`.

## Later

- [ ] **More live games** beyond the raffle and trivia (for example a photo-voting round).
- [ ] **Host dashboard**: guest list export, reminders to guests who have not answered, and a view of who has seen the invitation.
- [ ] **Accessibility pass** on the guest page: keyboard navigation, contrast and screen-reader labels.
- [ ] **Self-hosting guide** covering the optional Contento file storage and the Docker setup.
