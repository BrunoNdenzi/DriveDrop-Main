import assert from 'node:assert/strict';

process.env['SUPABASE_URL'] ||= 'https://example.supabase.co';
process.env['SUPABASE_ANON_KEY'] ||= 'example-anon-key';
process.env['SUPABASE_SERVICE_ROLE_KEY'] ||= 'example-service-key';
process.env['SELLBIRD_INTEGRATION_SECRET'] = 'current-example-secret';
process.env['SELLBIRD_INTEGRATION_SECRET_PREVIOUS'] = 'previous-example-secret';

async function main() {
  const {
    isSellbirdSecretValid,
    onboardingUrl,
    parseSellbirdAcceptedLead,
  } = await import('../src/services/sellbirdAcceptedLead.service');

  const parsed = parseSellbirdAcceptedLead({
    idempotency_key: 'sellbird:example',
    email: ' Person@Example.com ',
    first_name: ' Taylor ',
  });
  assert.equal(parsed.email, 'person@example.com');
  assert.equal(parsed.firstName, 'Taylor');
  assert.equal(isSellbirdSecretValid('Bearer current-example-secret'), true);
  assert.equal(isSellbirdSecretValid('Bearer previous-example-secret'), true);
  assert.equal(isSellbirdSecretValid('Bearer wrong-secret'), false);
  assert.equal(isSellbirdSecretValid(undefined), false);
  assert.throws(
    () => parseSellbirdAcceptedLead({ idempotency_key: 'sellbird:example', email: 'invalid' }),
    /valid email/,
  );
  assert.throws(
    () => parseSellbirdAcceptedLead({ email: 'person@example.com' }),
    /idempotency_key/,
  );

  process.env['FRONTEND_URL'] = 'https://example.com/';
  const signupUrl = onboardingUrl();
  assert.equal(signupUrl, 'https://example.com/signup?role=client&product=route-planner&source=sellbird');
  assert.ok(!signupUrl.includes('person%40example.com'));

  console.log('Sellbird integration contract tests passed');
}

void main();